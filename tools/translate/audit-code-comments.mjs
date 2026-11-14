#!/usr/bin/env node
/**
 * Audit line-leading `#` lines inside code fences before translating any.
 *
 * The point is to answer three questions with numbers:
 *   - which fences are in a language the rule covers;
 *   - which lines are real comments and which are RouterOS print output;
 *   - what the translator would be asked to translate, exactly.
 *
 *   node tools/translate/audit-code-comments.mjs [--write]
 *
 * Without `--write` it prints a summary. With `--write` it also refreshes
 * `reports/code-comments-audit.md` and `reports/code-comments-audit.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, REPO, walkMarkdown, relative, ensureDir} from './lib/paths.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {
  scanFences,
  commentLines,
  classifyComment,
  isCommentLanguage,
  commentKey,
} from './lib/code-comments.mjs';

const KIND_ORDER = [
  'comment',
  'table-header',
  'output',
  'command',
  'decoration',
  'label',
  'code',
  'ambiguous',
  'empty',
  'already-chinese',
  'opaque',
  'file-dump',
];

/** Scan one section and return per-line records plus fence statistics. */
export function auditSection(section) {
  const base = path.join(REPO, section.source);
  const records = [];
  const fences = {total: 0, byLanguage: {}, commentLanguage: 0};
  for (const file of walkMarkdown(base)) {
    const rel = relative(base, file);
    const {body} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
    for (const block of scanFences(body)) {
      fences.total++;
      const lang = block.language || '(none)';
      fences.byLanguage[lang] = (fences.byLanguage[lang] || 0) + 1;
      if (isCommentLanguage(block.language)) fences.commentLanguage++;
    }
    for (const entry of commentLines(body)) {
      const verdict = entry.blockSkip
        ? {kind: entry.blockSkip}
        : classifyComment(entry.text, entry.next, entry.hashes.length);
      records.push({
        section: section.name,
        rel,
        line: entry.lineNumber,
        language: entry.language,
        kind: verdict.kind,
        text: entry.text.trim(),
        indent: entry.indent,
      });
    }
  }
  return {records, fences};
}

function tally(records, field) {
  const out = {};
  for (const record of records) out[record[field]] = (out[record[field]] || 0) + 1;
  return out;
}

export function audit() {
  const sections = {};
  const all = [];
  const fenceStats = {};
  for (const section of SECTIONS) {
    const {records, fences} = auditSection(section);
    sections[section.name] = {
      lines: records.length,
      kinds: tally(records, 'kind'),
      languages: tally(records, 'language'),
    };
    fenceStats[section.name] = fences;
    all.push(...records);
  }

  const unique = new Map();
  for (const record of all) {
    const key = commentKey(record.language, record.text);
    const entry = unique.get(key) || {language: record.language, text: record.text, kind: record.kind, count: 0, pages: []};
    entry.count++;
    if (entry.pages.length < 3) entry.pages.push(`${record.section}/${record.rel}:${record.line}`);
    unique.set(key, entry);
  }

  const uniqueByKind = {};
  for (const entry of unique.values()) {
    uniqueByKind[entry.kind] = (uniqueByKind[entry.kind] || 0) + 1;
  }

  const translatable = [...unique.values()]
    .filter((entry) => entry.kind === 'comment')
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));

  return {
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, '+00:00'),
    sections,
    fenceStats,
    totalLines: all.length,
    unique: unique.size,
    kinds: tally(all, 'kind'),
    uniqueByKind,
    languages: tally(all, 'language'),
    translatable,
    records: all,
  };
}

function pct(part, total) {
  return total === 0 ? '0%' : `${((part / total) * 100).toFixed(1)}%`;
}

export function renderMarkdown(report) {
  const lines = [];
  const out = (line = '') => lines.push(line);
  const total = report.totalLines;

  out('# 代码块内 `#` 注释审计');
  out();
  out(`生成时间：${report.generated_at}`);
  out();
  out('本报告只做分类与统计，不改动任何页面。结论决定“哪些行可以翻译”，');
  out('以及“哪些行必须保持英文”——RouterOS `print` 输出表头与命令输出混在代码块里，');
  out('误翻会破坏表格，因此先审计、再翻译。');
  out();
  out('## 1. 规则范围');
  out();
  out('- 只处理围栏代码块（``` / ~~~）内、行首的 `#` 注释：可缩进，`#` 后可有空格。');
  out('- 只处理语言标记为 `ros`、`routeros`、`bash`、`sh`、`shell` 的围栏。');
  out('- 非注释代码行逐字节保持英文；字符串内或行尾的 `#` 不动。');
  out('- 表头、命令输出、注释掉的命令、装饰性分隔线一律不动。');
  out();
  out('## 2. 总体');

  out();
  out('| 指标 | 数量 |');
  out('| --- | ---: |');
  out(`| 允许语言围栏内行首 \`#\` 行 | ${total} |`);
  out(`| 去重后的不同注释文本 | ${report.unique} |`);
  out(`| 判定为“可翻译注释”的行 | ${report.kinds.comment || 0}（${pct(report.kinds.comment || 0, total)}） |`);
  out(`| 判定为“可翻译注释”的去重文本 | ${report.uniqueByKind.comment || 0} |`);
  out();

  out('## 3. 分类明细（按行）');
  out();
  out('| 分类 | 行数 | 占比 | 含义 |');
  out('| --- | ---: | ---: | --- |');
  const meaning = {
    comment: '自然语言注释，可翻译',
    'table-header': 'RouterOS print 表头，保持原样',
    output: '命令/导出输出（时间戳、key = value、Flags:），保持原样',
    command: '被注释掉的命令，保持原样',
    decoration: '装饰性横幅或分隔线，保持原样',
    label: '硬件/示意图标签，保持原样',
    code: '单个标识符或文件名，保持原样',
    ambiguous: '无法确定，保持原样并复核',
    empty: '空注释（只有 #）',
    'already-chinese': '已含中文',
    opaque: '密钥/证书或 TLS 辅助块，整块不动',
    'file-dump': '`cat`/`less` 之后的文件内容，整块不动',
  };
  for (const kind of KIND_ORDER) {
    const count = report.kinds[kind] || 0;
    if (count === 0) continue;
    out(`| \`${kind}\` | ${count} | ${pct(count, total)} | ${meaning[kind]} |`);
  }
  out();

  out('## 4. 按版本/板块');
  out();
  out('| 板块 | 行首 # 行 | 可翻译 | 表头 | 输出 | 命令 | 其他 |');
  out('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [name, stat] of Object.entries(report.sections)) {
    const k = stat.kinds;
    const other =
      (k.decoration || 0) + (k.label || 0) + (k.code || 0) + (k.ambiguous || 0) + (k.empty || 0) + (k['already-chinese'] || 0);
    out(
      `| ${name} | ${stat.lines} | ${k.comment || 0} | ${k['table-header'] || 0} | ${k.output || 0} | ${k.command || 0} | ${other} |`,
    );
  }
  out();

  out('## 5. 围栏语言分布');
  out();
  out('| 板块 | 围栏总数 | 允许语言围栏 | 语言分布（前 8） |');
  out('| --- | ---: | ---: | --- |');
  for (const [name, stat] of Object.entries(report.fenceStats)) {
    const top = Object.entries(stat.byLanguage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([lang, count]) => `${lang}:${count}`)
      .join(' ');
    out(`| ${name} | ${stat.total} | ${stat.commentLanguage} | ${top} |`);
  }
  out();

  out('## 6. 将被翻译的注释（去重，按出现次数排序）');
  out();
  out(`共 ${report.translatable.length} 条，合计 ${report.translatable.reduce((sum, entry) => sum + entry.count, 0)} 行。`);
  out();
  const shown = report.translatable.slice(0, 400);
  out('| # | 次数 | 语言 | 英文原文 |');
  out('| ---: | ---: | --- | --- |');
  shown.forEach((entry, index) => {
    out(`| ${index + 1} | ${entry.count} | ${entry.language} | ${entry.text.replace(/\|/g, '\\|')} |`);
  });
  if (report.translatable.length > shown.length) {
    out();
    out(`（仅列出前 ${shown.length} 条；完整列表见 JSON。）`);
  }
  out();

  const samples = (kind, limit = 15) => {
    const seen = new Set();
    const out2 = [];
    for (const record of report.records) {
      if (record.kind !== kind) continue;
      if (seen.has(record.text)) continue;
      seen.add(record.text);
      out2.push(record);
      if (out2.length >= limit) break;
    }
    return out2;
  };

  out('## 7. 明确跳过：表头样例');
  out();
  out('| 位置 | 文本 |');
  out('| --- | --- |');
  for (const record of samples('table-header')) {
    out(`| ${record.section}/${record.rel}:${record.line} | \`${record.text.replace(/\|/g, '\\|')}\` |`);
  }
  out();

  out('## 8. 明确跳过：命令与输出样例');
  out();
  out('| 分类 | 位置 | 文本 |');
  out('| --- | --- | --- |');
  for (const kind of ['command', 'output']) {
    for (const record of samples(kind, 10)) {
      out(
        `| ${kind} | ${record.section}/${record.rel}:${record.line} | \`${record.text.replace(/\|/g, '\\|')}\` |`,
      );
    }
  }
  out();

  const ambiguous = samples('ambiguous', 20);
  if (ambiguous.length) {
    out('## 9. 待人工确认（ambiguous，默认不翻译）');
    out();
    out('| 位置 | 文本 |');
    out('| --- | --- |');
    for (const record of ambiguous) {
      out(`| ${record.section}/${record.rel}:${record.line} | \`${record.text.replace(/\|/g, '\\|')}\` |`);
    }
    out();
  }

  out('## 10. 验收口径');
  out();
  out('- 非注释代码行与英文逐字节一致（`verify` 的 `fenceDiff` 为 0）。');
  out('- 只有允许语言、判定为 `comment` 的行会变。');
  out('- 表头行保持原样（`verify` 的 `commentDiff` 不包含它们）。');
  out('- 未翻译的注释单独统计为 `commentUntranslated`，不算围栏错误。');
  out();

  return `${lines.join('\n')}\n`;
}

function main() {
  const write = process.argv.includes('--write');
  const report = audit();
  process.stdout.write(
    `lines=${report.totalLines} unique=${report.unique} translatable=${report.kinds.comment || 0}\n`,
  );
  for (const kind of KIND_ORDER) {
    if (!report.kinds[kind]) continue;
    process.stdout.write(`  ${kind}: ${report.kinds[kind]}\n`);
  }
  for (const [name, stat] of Object.entries(report.sections)) {
    process.stdout.write(`  ${name}: lines=${stat.lines} comment=${stat.kinds.comment || 0}\n`);
  }
  if (!write) return;
  const reports = path.join(REPO, 'reports');
  ensureDir(reports);
  fs.writeFileSync(path.join(reports, 'code-comments-audit.md'), renderMarkdown(report));
  fs.writeFileSync(
    path.join(reports, 'code-comments-audit.json'),
    `${JSON.stringify(
      {
        generated_at: report.generated_at,
        totalLines: report.totalLines,
        unique: report.unique,
        kinds: report.kinds,
        uniqueByKind: report.uniqueByKind,
        sections: report.sections,
        fenceStats: report.fenceStats,
        translatable: report.translatable,
      },
      null,
      1,
    )}\n`,
  );
  process.stdout.write('wrote reports/code-comments-audit.md and .json\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
