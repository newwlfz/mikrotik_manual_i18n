#!/usr/bin/env node
/**
 * 归一 Markdown 的 fenced code block info string。
 *
 * 只改语言标识（```routeros → ```ros、```text → ```plaintext …），
 * 代码内容一个字节都不动；没有语言标识但首行命中规则（`config/code-fence-languages.yml`
 * 的 `path_rules` / `auto_detect`）的块补一个语言。
 *
 *   node tools/build/normalize-fences.mjs            # 改写 docs/ 与 versioned_docs/
 *   node tools/build/normalize-fences.mjs --check    # 只报告，不写文件（退出码 0）
 *   node tools/build/normalize-fences.mjs --check --json
 *
 * 归一表是唯一事实源：`config/code-fence-languages.yml`。同一份
 * `prism_languages` 也被 `docusaurus.config.ts` 读去做
 * `prism.additionalLanguages`，所以归一后的语言一定注册过。
 *
 * 匹配逻辑在 `src/lib/fence-rules.mjs`，渲染侧 `src/remark/fence-language.mjs`
 * 复用同一份代码，因此 `--check` 报出的块数就是构建时实际会改的块数。
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  canonicalDocPath,
  firstContentLine,
  loadFenceConfig,
  resolveFenceLanguage,
} from '../../src/lib/fence-rules.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(REPO, 'config/code-fence-languages.yml');
const ROOTS = ['docs', 'versioned_docs'];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const asJson = args.has('--json');

const config = loadFenceConfig(CONFIG_PATH);

// Prism 里默认已打包、或由客户端模块注册的语言：既不用改写也不需要警告。
const BUILTIN = new Set([
  'markup', 'html', 'xml', 'svg', 'mathml', 'css', 'clike', 'javascript', 'js',
  'jsx', 'tsx', 'typescript', 'ts', 'json', 'yaml', 'yml', 'bash', 'sh',
  'shell', 'powershell', 'python', 'sql', 'ini', 'plaintext', 'plain', 'text',
  'none', 'diff', 'markdown', 'md', 'mermaid', 'ros', 'routeros',
]);

const stats = {
  files: 0,
  filesChanged: 0,
  blocks: 0,
  bare: 0,
  aliased: 0,
  autoAdded: 0,
  unknown: new Map(),
  samples: [],
  changedFiles: [],
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * 处理单个文件的文本，返回 `{text, changed, blocks}`。
 * 逐行扫描：只有处于「围栏外」且匹配开围栏的行才进入围栏，围栏内原样输出，
 * 因此代码里的 ``` 不会被误判（同长度、同字符的围栏才闭合）。
 */
function normalizeText(source, docPath) {
  const lines = source.split('\n');
  const out = [];
  let changed = 0;
  let blocks = 0;
  let open = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (open) {
      // 闭合围栏：同字符、长度不短于开围栏、后面没有 info string。
      const close = /^(\s*)(`{3,}|~{3,})\s*$/.exec(line);
      if (close && close[2][0] === open.char && close[2].length >= open.length) {
        open = null;
      }
      out.push(line);
      continue;
    }

    const match = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (!match) {
      out.push(line);
      continue;
    }

    const [, indent, fence, rest] = match;
    blocks += 1;
    const info = rest.trim();
    if (!info) stats.bare += 1;

    let firstLine = '';
    let content = '';
    if (!info) {
      const closeRe = new RegExp(`^\\s*${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
      let end = i + 1;
      while (end < lines.length && !closeRe.test(lines[end])) end += 1;
      content = lines.slice(i + 1, end).join('\n');
      firstLine = firstContentLine(content);
    }

    const resolved = resolveFenceLanguage({config, info, firstLine, content, docPath});
    if (resolved.kind === 'auto') {
      stats.autoAdded += 1;
      if (stats.samples.length < 8) {
        stats.samples.push({kind: 'auto', lang: resolved.info, rule: resolved.reason, first: firstLine});
      }
    } else if (resolved.kind === 'alias') {
      stats.aliased += 1;
      if (stats.samples.length < 8) {
        stats.samples.push({kind: 'alias', from: resolved.from, to: resolved.to});
      }
    } else if (info) {
      const lang = info.split(/\s+/)[0];
      if (!BUILTIN.has(lang.toLowerCase()) && !config.aliases.has(lang.toLowerCase())) {
        stats.unknown.set(lang, (stats.unknown.get(lang) || 0) + 1);
      }
    }

    if (resolved.changed) {
      changed += 1;
      out.push(`${indent}${fence}${resolved.info}`);
    } else {
      out.push(line);
    }
    open = {char: fence[0], length: fence.length};
  }

  return {text: out.join('\n'), changed, blocks};
}

const files = ROOTS.flatMap((root) => walk(path.join(REPO, root)));
for (const file of files) {
  stats.files += 1;
  const source = fs.readFileSync(file, 'utf8');
  const docPath = canonicalDocPath(file);
  const {text, changed, blocks} = normalizeText(source, docPath);
  stats.blocks += blocks;
  if (!changed) continue;
  stats.filesChanged += 1;
  stats.changedFiles.push({
    path: path.relative(REPO, file).split(path.sep).join('/'),
    blocks: changed,
  });
  if (!checkOnly) fs.writeFileSync(file, text);
}

const unknown = [...stats.unknown.entries()].sort((a, b) => b[1] - a[1]);
const report = {
  mode: checkOnly ? 'check' : 'write',
  files: stats.files,
  filesChanged: stats.filesChanged,
  blocks: stats.blocks,
  bareBlocks: stats.bare,
  aliasNormalized: stats.aliased,
  autoDetected: stats.autoAdded,
  unknownLanguages: unknown,
  changedFiles: stats.changedFiles,
  samples: stats.samples,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`fence 归一（${report.mode}）：`);
  console.log(`  扫描文件        ${report.files}`);
  console.log(`  代码块          ${report.blocks}`);
  console.log(`  无语言标识      ${report.bareBlocks}`);
  console.log(`  别名归一        ${report.aliasNormalized}`);
  console.log(`  自动补语言      ${report.autoDetected}`);
  console.log(`  需改写文件      ${report.filesChanged}`);
  if (unknown.length) {
    console.log(`  未注册语言      ${unknown.map(([k, v]) => `${k}×${v}`).join(', ')}`);
  }
  for (const item of report.changedFiles.slice(0, 20)) {
    console.log(`  · ${item.path}  ${item.blocks} 块`);
  }
  if (report.changedFiles.length > 20) {
    console.log(`  … 另有 ${report.changedFiles.length - 20} 个文件（--json 查看完整列表）`);
  }
  for (const sample of report.samples) console.log(`  · ${JSON.stringify(sample)}`);
  if (checkOnly) console.log('  （--check：未写入任何文件）');
}
