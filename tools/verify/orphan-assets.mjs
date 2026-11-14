#!/usr/bin/env node
/**
 * `static/img/` 的引用完整性断言，顺带报告没人引用的孤儿文件。
 *
 * 站内图片的公开 URL 是 `/img/<file>`，物理文件只有 `static/img/<file>`
 * 一个来源；因此「被引用」的判据是源码里出现指向 `img/<file>` 的静态引用。
 * 早前从旧镜像整批导入的 `static/img/` 从未剪枝，多数文件早已没有页面引用
 * （同步/物料化把图片引用改写到了每页自己的 `img/` 目录），于是 static 目录
 * 一直膨胀。这个脚本做两件事：
 *
 *   1. 断言：每个被引用的 `/img/<file>` 都在 `static/img/` 里存在（缺失即 exit 1）；
 *   2. 报告：列出 `static/img/` 里没有任何引用的文件；`--strict` 时 exit 1。
 *
 * 扫描口径（与人工勘察一致）：
 *   - 内容树：`docs/`、`versioned_docs/`、`hardware/`、`blog/`、`changelog/`、
 *     `i18n/`、`guides/` 下的 `.md`/`.mdx`（跳过围栏代码与行内代码）；
 *   - 原始快照：`upstream/`（物料化的输入；其中若出现站内绝对图片引用，
 *     同样必须保留对应文件）；
 *   - 页面修正：`corrections/`（YAML 里可能内联正文）；
 *   - 代码：`src/` 下 `.ts/.tsx/.js/.jsx/.mjs/.cjs`（先剥注释，只认字符串）
 *     与 `.css` 的 `url(...)`；
 *   - 配置与数据：`docusaurus.config.ts`、`sidebars*.ts`、`versions.json`、
 *     `config/`、`data/`；
 *   - 抓取的独立页：`static/assets/` 下的 HTML；
 *   - 根文档：`README.md`、`ARCHITECTURE.md`、`TRANSLATION.md`。
 *
 * 解析规则：
 *   - 站内绝对 `/img/<name>`（含可选的 baseUrl 前缀）→ `static/img/<name>`；
 *   - `docusaurus.config.ts` 里的裸 `img/<name>` → `static/img/<name>`
 *     （Docusaurus 的静态资源相对 `static/` 解析，favicon/logo 即此形式）；
 *   - `./img/…`、`../img/…` 与 Markdown 里的裸 `img/…` → 相对页面目录，
 *     只在报告里统计，不参与 `static/img/` 判定（它们不是 static 资源）；
 *   - 其余（`http(s)://`、`//`、`data:`、`mailto:`）不算站内引用。
 *
 * 动态构造：源码里 `` `/img/${…}` ``、`"/img/" + x` 这类引用无法枚举。
 * 没有根绝对路径的动态构造时退出码不受影响；一旦出现，就无法证明
 * 「被引用的一个都不少」，脚本按失败处理。相对路径模板（`./img/${x}`）
 * 只生成页面相对引用，不影响 `static/img/`，单独列出供人工确认。
 *
 * Usage:
 *   node tools/verify/orphan-assets.mjs                     # 断言 + 孤儿报告
 *   node tools/verify/orphan-assets.mjs --strict            # 有孤儿即 exit 1
 *   node tools/verify/orphan-assets.mjs --json              # 机器可读，走 stdout
 *   node tools/verify/orphan-assets.mjs --json=work/orphan-assets.json
 *                                                           # 写清单（文件不入库）
 *
 * 退出码：1 = 有引用缺文件 / 有根绝对路径动态构造 /（`--strict`）有孤儿。
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeBaseUrl, resolveBaseUrl} from '../lib/site-config.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IMG_DIR = path.join(REPO, 'static/img');
const CONFIG_FILE = 'docusaurus.config.ts';

/**
 * 按角色命名、由 `docusaurus.config.ts` 引用的文件。即使配置文件以后改成
 * 别的写法，这两个也不能被当成孤儿删掉。
 */
const PROTECTED = new Set(['logo.svg', 'favicon.svg']);

/** 扫源码时跳过的目录：产物、依赖、缓存与工作区。 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', '.docusaurus', '.work', 'work', '.cache-loader',
]);

const MARKDOWN_EXT = new Set(['.md', '.mdx']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const DATA_EXT = new Set(['.yml', '.yaml', '.json']);
const HTML_EXT = new Set(['.html', '.htm']);
const CSS_EXT = new Set(['.css']);

const SCAN_ROOTS = [
  'docs',
  'versioned_docs',
  'hardware',
  'blog',
  'changelog',
  'i18n',
  'upstream',
  'corrections',
  'guides',
  'src',
  'config',
  'data',
  'static/assets',
];

const SCAN_FILES = [
  CONFIG_FILE,
  'sidebars.ts',
  'sidebars-hardware.ts',
  'versions.json',
  'README.md',
  'ARCHITECTURE.md',
  'TRANSLATION.md',
];

// 引用语法：Markdown 图片/链接目标、HTML/MDX 标签属性、裸的站内绝对路径。
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)/g;
const MARKDOWN_LINK_RE = /(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)/g;
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
const ABSOLUTE_IMG_RE = /(?:^|[\s"'`(=:,])(\/img\/[A-Za-z0-9._%+-]+)/gm;
const IMAGE_ATTRS = new Set(['src', 'srcset', 'poster']);
const META_IMAGE_KEYS = new Set(['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);
// 无法枚举的构造：`/img/${x}`、`"/img/" + x`、`img/${x}`。
const DYNAMIC_RE = /((?:\/|\.{1,2}\/)?img\/)(?:\$\{|["'`]\s*\+)/g;
const EXPRESSION_RE = /\$\{|\{\s*[A-Za-z_$]/;
const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|gif|svg|avif|ico)$/i;

/**
 * 只统计看起来是图片的引用：Markdown 链接目标里大量是页面链接（`../foo`），
 * 把它们算进「图片引用」会让统计和缺失告警失去意义。
 */
function looksLikeImage(url) {
  return IMAGE_EXT_RE.test(url) || /(?:^|\/)img\//.test(url);
}

function usage() {
  return [
    'usage: node tools/verify/orphan-assets.mjs [--strict] [--json[=<path>]]',
    '                                         [--asset-origin=<url>]',
    '',
    '  --strict        孤儿文件非空时 exit 1（默认只报告）',
    '  --json          把清单打印到 stdout',
    '  --json=<path>   把清单写入文件（相对仓库根），同时打印摘要',
    '  --asset-origin=<url>  共享资源源站（默认 $ASSET_ORIGIN）。设置且无',
    '                  `static/img` 时跳过：语种仓不保存 static/，资源在英文站',
    '  --help          显示本帮助',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    strict: false,
    json: false,
    jsonPath: null,
    assetOrigin: String(process.env.ASSET_ORIGIN || '').trim().replace(/\/+$/, '') || null,
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--strict') options.strict = true;
    else if (arg === '--json') options.json = true;
    else if (arg.startsWith('--json=')) {
      options.jsonPath = arg.slice('--json='.length);
      if (!options.jsonPath) throw new Error('--json= needs a path');
    } else if (arg.startsWith('--asset-origin=')) {
      options.assetOrigin = arg.slice('--asset-origin='.length).trim().replace(/\/+$/, '') || null;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function walk(root, visit) {
  if (!fs.existsSync(root)) return;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    visit(root);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.isFile()) visit(full);
  }
}

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** 等长掩码：把不参与判定的区间换成空格，保留换行以维持行号。 */
function mask(chars, start, end) {
  for (let i = start; i < end; i++) {
    if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
  }
}

/**
 * Markdown 里围栏代码块和行内代码不是引用（文档示例常写 `<Img src="/img/x">`）。
 * 逐行处理，掩码后长度与换行不变。
 */
function maskMarkdown(source) {
  // `split('')` keeps the index in UTF-16 code units, the unit the line offsets
  // below are measured in; `[...source]` counts code points and shifts every
  // mask after the first astral character.
  const chars = source.split('');
  let offset = 0;
  let fence = null;
  for (const line of source.split('\n')) {
    const start = offset;
    offset += line.length + 1;
    // A fence may open inside a list item (`9. \`\`\`ros`): the official pages
    // do that, and a start-of-line-only pattern desynchronises there, masking the
    // prose between two list-item fences and hiding real references.
    const marker = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?(`{3,}|~{3,})/.exec(line);
    if (marker) {
      mask(chars, start, start + line.length);
      if (!fence) fence = marker[1][0];
      else if (fence === marker[1][0]) fence = null;
      continue;
    }
    if (fence) {
      mask(chars, start, start + line.length);
      continue;
    }
    let i = 0;
    while (i < line.length) {
      if (line[i] !== '`') {
        i++;
        continue;
      }
      let run = 1;
      while (line[i + run] === '`') run++;
      const close = line.indexOf('`'.repeat(run), i + run);
      if (close === -1) {
        i += run;
        continue;
      }
      mask(chars, start + i, start + close + run);
      i = close + run;
    }
  }
  return chars.join('');
}

/**
 * 代码里的注释不是引用（`tools/verify/*.mjs` 的说明里就写着示例路径）。
 * 只剥注释，字符串原样留下：字符串里的 `//`（URL）不会被误判。
 */
function maskCodeComments(source) {
  const chars = source.split('');
  let state = 'code';
  let quote = '';
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') {
        const end = source.indexOf('\n', i);
        const stop = end === -1 ? source.length : end;
        mask(chars, i, stop);
        i = stop - 1;
      } else if (char === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        const stop = end === -1 ? source.length : end + 2;
        mask(chars, i, stop);
        i = stop - 1;
      } else if (char === '"' || char === "'" || char === '`') {
        state = 'string';
        quote = char;
      }
      continue;
    }
    if (char === '\\') {
      i++;
      continue;
    }
    if (char === quote) state = 'code';
  }
  return chars.join('');
}

function stripBaseUrl(value, baseUrl) {
  if (baseUrl === '/') return value;
  const bare = baseUrl.replace(/\/$/, '');
  if (value === bare) return '/';
  if (value.startsWith(`${bare}/`)) return value.slice(bare.length);
  return value;
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitSrcset(value) {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/** `img/<name>` 里只接受单段文件名；子目录属于未覆盖形态，单独报告。 */
function siteNameOf(value) {
  const name = value.replace(/^\/?img\//, '');
  if (!name || name.includes('/') || name.includes('\\')) return null;
  return name;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(IMG_DIR) || !fs.statSync(IMG_DIR).isDirectory()) {
    if (options.assetOrigin) {
      // Localized repository: `static/` is not content here. `asset-refs.mjs`
      // checks the absolute shared-origin URLs instead; there is no local
      // inventory to scan for orphans.
      const report = {
        schema: 'orphan-assets/1',
        skipped: 'static/img absent; shared asset origin',
        asset_origin: options.assetOrigin,
        static_img: null,
      };
      if (options.json) console.log(JSON.stringify(report, null, 2));
      console.log(
        `orphan-assets: static/img not found and ASSET_ORIGIN=${options.assetOrigin} is set; ` +
          'skipping the orphan scan (assets are served by the shared origin)',
      );
      process.exit(0);
    }
    throw new Error(`static/img not found: ${IMG_DIR}`);
  }

  const baseUrl = normalizeBaseUrl(resolveBaseUrl().value);

  const files = new Map(); // 绝对路径 -> 类型
  const kindOf = (file) => {
    const ext = path.extname(file).toLowerCase();
    if (MARKDOWN_EXT.has(ext)) return 'markdown';
    if (CODE_EXT.has(ext)) return 'code';
    if (DATA_EXT.has(ext)) return 'data';
    if (HTML_EXT.has(ext)) return 'html';
    if (CSS_EXT.has(ext)) return 'css';
    return null;
  };
  for (const root of SCAN_ROOTS) {
    walk(path.join(REPO, root), (file) => {
      const kind = kindOf(file);
      if (kind) files.set(file, kind);
    });
  }
  for (const relative of SCAN_FILES) {
    const file = path.join(REPO, relative);
    if (!fs.existsSync(file)) continue;
    const kind = kindOf(file);
    if (kind) files.set(file, kind);
  }
  const ordered = [...files.entries()].sort(([a], [b]) => a.localeCompare(b));

  const inventory = fs
    .readdirSync(IMG_DIR, {withFileTypes: true})
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const inventorySet = new Set(inventory);
  const subdirectories = fs
    .readdirSync(IMG_DIR, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const referenced = new Map(); // name -> {file, line}
  const seenRefs = new Set(); // 同一位置被多种语法命中也只算一次
  const missingSeen = new Set();
  const missing = [];
  const weak = [];
  const dynamic = new Map();
  const relativeStats = {refs: 0, resolved: 0, missing: 0};
  const relativeMissing = [];
  let refs = 0;
  let staticRefs = 0;
  let external = 0;

  const recordStatic = (name, file, content, index, ref) => {
    const decoded = decodePath(name);
    const line = lineOf(content, index);
    const key = `${path.relative(REPO, file)}:${line}:${decoded}`;
    if (!seenRefs.has(key)) {
      seenRefs.add(key);
      staticRefs += 1;
    }
    if (!referenced.has(decoded)) {
      referenced.set(decoded, {file: path.relative(REPO, file), line});
    }
    if (!inventorySet.has(decoded)) {
      if (!missingSeen.has(key)) {
        missingSeen.add(key);
        missing.push({file: path.relative(REPO, file), line, ref, name: decoded});
      }
    }
  };

  const addDynamic = (item) => {
    const key = `${item.file}:${item.line}:${item.affects_static}`;
    const previous = dynamic.get(key);
    if (!previous || item.ref.length > previous.ref.length) dynamic.set(key, item);
  };

  const record = (raw, file, content, index) => {
    if (!raw) return;
    let value = String(raw).trim();
    if (!value) return;
    if (value.startsWith('<') && value.endsWith('>')) value = value.slice(1, -1);
    if (!value || value.startsWith('#') || value.startsWith('?')) return;

    const [withoutFragment] = value.split('#');
    const url = withoutFragment.split('?')[0];
    if (!url || !looksLikeImage(url)) return;

    refs += 1;
    const rel = path.relative(REPO, file);

    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value) || /^(?:data|mailto|tel|javascript):/i.test(value)) {
      external += 1;
      return;
    }

    if (url.startsWith('/')) {
      const bare = stripBaseUrl(url, baseUrl);
      if (!bare.startsWith('/img/')) return;
      const name = siteNameOf(bare);
      if (!name) {
        weak.push({file: rel, line: lineOf(content, index), ref: value, reason: 'nested path'});
        return;
      }
      recordStatic(name, file, content, index, value);
      return;
    }

    // `docusaurus.config.ts` 的裸 `img/x` 按 `static/` 解析（favicon/logo）。
    if (rel === CONFIG_FILE && url.startsWith('img/')) {
      recordStatic(url.slice('img/'.length), file, content, index, value);
      return;
    }

    // `./img/…`、`../img/…` 与裸 `img/…`：页面相对引用，解析到源码旁边。
    const target = path.resolve(path.dirname(file), decodePath(url));
    const insideStatic = target === IMG_DIR || target.startsWith(`${IMG_DIR}${path.sep}`);
    if (insideStatic) {
      recordStatic(path.basename(target), file, content, index, value);
      return;
    }

    relativeStats.refs += 1;
    if (fs.existsSync(target)) relativeStats.resolved += 1;
    else {
      relativeStats.missing += 1;
      if (relativeMissing.length < 50) relativeMissing.push({file: rel, line: lineOf(content, index), ref: value});
    }

    // 裸 `img/x` 若恰好与 static/img 同名，按「可能指向静态资源」保守保留。
    if (!url.startsWith('./') && !url.startsWith('../')) {
      const bareName = url.startsWith('img/') ? url.slice('img/'.length) : null;
      if (bareName && inventorySet.has(bareName) && !referenced.has(bareName)) {
        referenced.set(bareName, {file: rel, line: lineOf(content, index)});
        weak.push({file: rel, line: lineOf(content, index), ref: value, reason: 'bare name matches static/img'});
      }
    }
  };

  const scanTags = (file, content) => {
    for (const tagMatch of content.matchAll(TAG_RE)) {
      const tag = tagMatch[1].toLowerCase();
      const attributes = Object.create(null);
      for (const attr of tagMatch[0].matchAll(ATTR_RE)) {
        attributes[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? '';
      }
      const check = (key) => {
        const value = attributes[key];
        if (value === undefined) return;
        if (EXPRESSION_RE.test(value)) {
          if (!value.includes('img/') && !value.includes('/img')) return;
          addDynamic({
            file: path.relative(REPO, file),
            line: lineOf(content, tagMatch.index),
            ref: `<${tag} ${key}=${value}>`.slice(0, 160),
            affects_static: value.includes('/img/'),
          });
          return;
        }
        if (key === 'srcset') for (const url of splitSrcset(value)) record(url, file, content, tagMatch.index);
        else record(value, file, content, tagMatch.index);
      };
      for (const key of IMAGE_ATTRS) check(key);
      if (tag === 'meta') {
        const metaKey = (attributes.property || attributes.name || '').toLowerCase();
        if (META_IMAGE_KEYS.has(metaKey)) check('content');
      } else if (tag === 'a' || tag === 'link') {
        check('href');
      }
    }
  };

  const scanMarkdown = (file, content) => {
    const text = maskMarkdown(content);
    for (const match of text.matchAll(MARKDOWN_IMAGE_RE)) record(match[1], file, text, match.index);
    for (const match of text.matchAll(MARKDOWN_LINK_RE)) record(match[1], file, text, match.index);
    scanTags(file, text);
    for (const match of text.matchAll(ABSOLUTE_IMG_RE)) record(match[1], file, text, match.index);
    for (const match of text.matchAll(DYNAMIC_RE)) {
      addDynamic({
        file: path.relative(REPO, file),
        line: lineOf(text, match.index),
        ref: match[0].slice(0, 160),
        affects_static: match[1].startsWith('/img/'),
      });
    }
  };

  const scanCode = (file, content) => {
    const text = maskCodeComments(content);
    for (const match of text.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*?)\1/gs)) {
      const value = match[2];
      if (!value.includes('img/')) continue;
      if (match[1] === '`' && value.includes('${')) {
        addDynamic({
          file: path.relative(REPO, file),
          line: lineOf(text, match.index),
          ref: value.slice(0, 160),
          affects_static: /(?:^|[^.\w])\/img\/\$\{/.test(value),
        });
        continue;
      }
      record(value, file, text, match.index);
    }
    for (const match of text.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) {
      record(match[2], file, text, match.index);
    }
    for (const match of text.matchAll(ABSOLUTE_IMG_RE)) record(match[1], file, text, match.index);
    for (const match of text.matchAll(DYNAMIC_RE)) {
      addDynamic({
        file: path.relative(REPO, file),
        line: lineOf(text, match.index),
        ref: match[0].slice(0, 160),
        affects_static: match[1].startsWith('/img/'),
      });
    }
  };

  const scanData = (file, content) => {
    for (const match of content.matchAll(/(['"])((?:(?!\1)[^\\]|\\.)*?)\1/gs)) {
      if (match[2].includes('img/')) record(match[2], file, content, match.index);
    }
    for (const match of content.matchAll(ABSOLUTE_IMG_RE)) record(match[1], file, content, match.index);
    // YAML 的裸值：`favicon: img/x.svg`。
    for (const match of content.matchAll(/^\s*[\w.-]+\s*:\s*(?:\.{0,2}\/)?img\/[^\s#'"]+/gm)) {
      const value = match[0].slice(match[0].indexOf(':') + 1).trim();
      record(value, file, content, match.index);
    }
  };

  const scanHtml = (file, content) => {
    scanTags(file, content);
    for (const match of content.matchAll(ABSOLUTE_IMG_RE)) record(match[1], file, content, match.index);
  };

  const scanCss = (file, content) => {
    const text = maskCodeComments(content);
    for (const match of text.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) {
      record(match[2], file, text, match.index);
    }
  };

  for (const [file, kind] of ordered) {
    const content = fs.readFileSync(file, 'utf8');
    if (kind === 'markdown') scanMarkdown(file, content);
    else if (kind === 'code') scanCode(file, content);
    else if (kind === 'data') scanData(file, content);
    else if (kind === 'html') scanHtml(file, content);
    else if (kind === 'css') scanCss(file, content);
  }

  // 角色命名的文件永远不算孤儿；配置文件解析失败时也不能丢。
  const protectedMissing = [];
  for (const name of PROTECTED) {
    if (!inventorySet.has(name) && !missing.some((item) => item.name === name)) {
      protectedMissing.push({name, reason: 'role-named asset missing', file: CONFIG_FILE, line: 0});
    }
    if (!referenced.has(name)) referenced.set(name, {file: CONFIG_FILE, line: 0});
  }

  const referencedNames = [...referenced.keys()].sort();
  const orphanNames = inventory.filter((name) => !referenced.has(name));
  const bytesOf = (name) => fs.statSync(path.join(IMG_DIR, name)).size;
  const orphans = orphanNames.map((name) => ({name, bytes: bytesOf(name)}));
  const referencedBytes = referencedNames
    .filter((name) => inventorySet.has(name))
    .reduce((sum, name) => sum + bytesOf(name), 0);
  const orphanBytes = orphans.reduce((sum, item) => sum + item.bytes, 0);
  const totalBytes = inventory.reduce((sum, name) => sum + bytesOf(name), 0);
  const missingAll = [...missing, ...protectedMissing];
  const dynamicList = [...dynamic.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const affectsStatic = dynamicList.filter((item) => item.affects_static);

  const report = {
    schema: 'orphan-assets/1',
    base_url: baseUrl,
    scanned: {
      files: ordered.length,
      refs,
      static_refs: staticRefs,
      external,
      relative_refs: relativeStats.refs,
      relative_resolved: relativeStats.resolved,
      relative_missing: relativeStats.missing,
    },
    inventory: {files: inventory.length, bytes: totalBytes, subdirectories},
    referenced: referencedNames,
    referenced_count: referencedNames.length,
    referenced_bytes: referencedBytes,
    orphans,
    orphan_count: orphans.length,
    orphan_bytes: orphanBytes,
    missing: missingAll,
    dynamic: dynamicList,
    weak,
    relative_missing: relativeMissing,
  };

  const payload = JSON.stringify(report, null, 2);
  const failed = missingAll.length > 0 || affectsStatic.length > 0 || (options.strict && orphans.length > 0);

  if (options.json) {
    console.log(payload);
    process.exit(failed ? 1 : 0);
  }

  if (options.jsonPath) {
    const target = path.resolve(REPO, options.jsonPath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, `${payload}\n`);
  }

  const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
  console.log(
    `orphan-assets: scanned ${ordered.length} source files, ${refs} image refs ` +
      `(${staticRefs} static, ${external} external, ${relativeStats.refs} page-relative)`,
  );
  console.log(
    `orphan-assets: static/img = ${inventory.length} files (${mib(totalBytes)} MiB), ` +
      `referenced = ${referencedNames.length} (${mib(referencedBytes)} MiB)`,
  );
  console.log(`orphan-assets: missing referenced files = ${missingAll.length}`);
  for (const item of missingAll.slice(0, 20)) {
    console.log(`  MISSING ${item.name ?? item.ref}  <- ${item.file}:${item.line}`);
  }
  if (relativeStats.missing > 0) {
    console.log(
      `orphan-assets: note: ${relativeStats.missing} page-relative image ref(s) do not resolve ` +
        '(per-page img/ dirs, not static/img; reported only)',
    );
  }
  console.log(
    `orphan-assets: dynamic refs = ${dynamicList.length} (${affectsStatic.length} could target static/img)`,
  );
  for (const item of dynamicList.slice(0, 10)) {
    console.log(`  DYNAMIC ${item.file}:${item.line}: ${item.ref}${item.affects_static ? ' [static]' : ''}`);
  }
  console.log(
    `orphan-assets: orphans = ${orphans.length} (${mib(orphanBytes)} MiB / ${orphanBytes} bytes)` +
      `, protected = ${[...PROTECTED].join(', ')}`,
  );
  const sorted = [...orphans].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  for (const item of sorted.slice(0, 20)) {
    console.log(`  ORPHAN ${item.name}  ${item.bytes}`);
  }
  if (sorted.length > 20) console.log(`  ... and ${sorted.length - 20} more`);
  if (subdirectories.length > 0) {
    console.log(`orphan-assets: WARN static/img subdirectories are not scanned: ${subdirectories.join(', ')}`);
  }

  if (failed) {
    if (missingAll.length > 0) console.error('orphan-assets: FAIL referenced static image is missing');
    if (affectsStatic.length > 0) console.error('orphan-assets: FAIL dynamic static image reference cannot be enumerated');
    if (options.strict && orphans.length > 0) console.error('orphan-assets: FAIL unreferenced static images exist (--strict)');
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`orphan-assets: ${error.message}`);
  process.exit(1);
}
