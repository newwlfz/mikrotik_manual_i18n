#!/usr/bin/env node
/**
 * Build the human review list of pages that are not fully translated.
 *
 * Three categories:
 *   missing  no legacy translation exists: the page is still English
 *   partial  an overlay exists but some paragraphs are still English
 *   stale    the legacy translation was adopted, but the English page changed
 *
 * The list is written to reports/translation-review.md (with a JSON twin) so the
 * user can walk it page by page and decide which ones need a real translation.
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, REPO, DEFAULT_LEGACY_ROOT, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {normalize, splitBlocks, englishSegments} from './lib/blocks.mjs';
import {untranslated} from './lib/verify.mjs';
import {isLegal} from './lib/legal.mjs';

const STATE = path.join(REPO, 'state/translation-state.json');
// Reports live in the repository, next to the other handoff documents.
const OUT_DIR = path.join(REPO, 'reports');

function routeBaseOf(section) {
  const versioned = /^versioned_docs\/version-(.+)$/.exec(section.source);
  if (versioned) return `/docs/${versioned[1]}`;
  if (section.source === 'docs') return '/docs';
  return `/${section.source}`;
}

function legacyEnglish(section, rel, legacyRoot) {
  // The legacy corpus has one `docs/` tree per captured version.
  const prefix = section.name.startsWith('docs') ? 'docs' : section.name;
  for (const area of section.legacy || []) {
    const file = path.join(legacyRoot, 'en', area, prefix, rel);
    if (fs.existsSync(file)) return file;
  }
  return null;
}


// A review entry should be a real sentence, not a technical label. Headings,
// table rows and bullet lists only count when they read like prose.
const FUNCTION_WORD = /\b(the|this|that|these|those|with|without|for|and|or|are|is|be|to|of|in|on|at|by|as|it|its|can|cannot|may|should|must|will|would|from|your|you|we|our|when|which|how|not|all|each|any|use|used|using|configure|configuration|example|examples|about|into|between|enabled|disabled|allows|requires)\b/i;

function isRealProse(segment) {
  const t = segment.trim();
  if (!FUNCTION_WORD.test(t)) return false;
  const words = (t.match(/[A-Za-z][A-Za-z'-]+/g) || []).length;
  if (/^#{1,6}\s/.test(t)) return words >= 3;
  if (/^\|/.test(t)) return /[.!?]/.test(t) && words >= 6;
  if (/^[*-]\s/.test(t)) return words >= 5;
  return words >= 5;
}

function newBlocks(sourceBody, legacyBody) {
  if (!legacyBody) return [];
  const known = new Set(splitBlocks(legacyBody).map(normalize));
  return splitBlocks(sourceBody).filter(
    (block) => !known.has(normalize(block)) && !/^[<|]/.test(block.trim()) && /[A-Za-z]{3,}/.test(block),
  );
}

function main() {
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const entries = [];

  for (const section of SECTIONS) {
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      const key = `${section.source}/${rel}`;
      const record = state.files[key];
      if (!record || record.status === 'full') continue;
      const overlayPath = path.join(overlayBase, rel);
      const source = fs.readFileSync(sourcePath, 'utf8');
      const {body: sourceBody} = splitFrontMatter(source);
      const overlay = fs.existsSync(overlayPath) ? fs.readFileSync(overlayPath, 'utf8') : null;
      const remaining = overlay
        ? englishSegments(splitFrontMatter(overlay).body)
        : splitBlocks(sourceBody);

      let changed = [];
      if (record.mode === 'adopted') {
        const legacyFile = legacyEnglish(section, rel, DEFAULT_LEGACY_ROOT);
        if (legacyFile) {
          const legacyBody = splitFrontMatter(fs.readFileSync(legacyFile, 'utf8')).body;
          changed = newBlocks(sourceBody, legacyBody);
        }
      }

      const prose = remaining.filter((segment) => !isLegal(segment) && isRealProse(segment));
      const legal = remaining.filter(isLegal);

      entries.push({
        section: section.name,
        source: key,
        route: `${routeBaseOf(section)}/${rel.replace(/\/index\.mdx?$/, '').replace(/\.mdx?$/, '')}`,
        status:
          record.mode === 'adopted' || record.status === 'preserved'
            ? 'stale'
            : record.status === 'none'
              ? 'missing'
              : record.status,
        overlay: Boolean(overlay),
        remaining: prose.length,
        legal: legal.length,
        remainingSamples: prose.slice(0, 2),
        changed: changed.length,
        changedSamples: changed.slice(0, 2).map((block) => block.trim().slice(0, 160)),
      });
    }
  }

  // Technical labels left in English are not review items: only pages with real
  // prose, legal text, or no translation at all need a human look.
  const interesting = entries.filter(
    (entry) =>
      entry.status === 'missing' || entry.status === 'stale' || entry.remaining > 0 || entry.legal > 0,
  );
  const order = {missing: 0, partial: 1, stale: 2};
  entries.length = 0;
  entries.push(...interesting);
  entries.sort((a, b) => order[a.status] - order[b.status] || b.remaining - a.remaining || a.source.localeCompare(b.source));

  const counts = entries.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {});

  const lines = [];
  lines.push('# zh-Hans 待核对清单');
  lines.push('');
  lines.push(`生成时间：${new Date().toISOString().replace('T', ' ').slice(0, 19)} · 共 ${entries.length} 页`);
  lines.push('');
  lines.push('| 类别 | 数量 | 含义 |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| missing | ${counts.missing || 0} | 旧项目没有这一页，整页仍是英文 |`);
  lines.push(`| partial | ${counts.partial || 0} | 有中文覆盖层，但仍有英文段落残留 |`);
  lines.push(`| stale | ${counts.stale || 0} | 已整页采纳旧译文，但英文原文已变化 |`);
  lines.push('');

  const titles = {
    missing: '一、没有旧译文（整页英文）',
    partial: '二、部分翻译（有英文残留）',
    stale: '三、已采纳旧译文，但英文已变化',
  };
  for (const status of ['missing', 'partial', 'stale']) {
    const group = entries.filter((entry) => entry.status === status);
    if (!group.length) continue;
    lines.push(`## ${titles[status]}`);
    lines.push('');
    lines.push('| # | 页面 | 路由 | 英文正文 | 合规英文 | 英文新增 | 样例 |');
    lines.push('| ---: | --- | --- | ---: | ---: | ---: | --- |');
    group.forEach((entry, index) => {
      const sample = (entry.changedSamples[0] || entry.remainingSamples[0] || '')
        .replace(/\|/g, '\\|')
        .replace(/\s+/g, ' ')
        .slice(0, 110);
      lines.push(
        `| ${index + 1} | \`${entry.source}\` | \`${entry.route}\` | ${entry.remaining} | ${entry.legal} | ${entry.changed} | ${sample || '—'} |`,
      );
    });
    lines.push('');
  }

  lines.push('备注：法规/合规声明（FCC、IC、CE、UKCA 等）按惯例保留英文，出现在“英文残留”里不算漏翻。');
  lines.push('');
  lines.push('## 复核方式');
  lines.push('');
  lines.push('1. 打开对应路由（本地 `npm run serve` 后加 `/zh-Hans` 前缀）；');
  lines.push('2. 判断中文是否仍然覆盖当前英文内容；');
  lines.push('3. 需要重译的页面执行：');
  lines.push('');
  lines.push('```bash');
  lines.push('node tools/translate/index.mjs translate --section=<docs|docs-<version>|hardware|changelog> --file=<相对路径>');
  lines.push('```');

  fs.mkdirSync(OUT_DIR, {recursive: true});
  fs.writeFileSync(path.join(OUT_DIR, 'translation-review.md'), `${lines.join('\n')}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'translation-review.json'), `${JSON.stringify({generatedAt: new Date().toISOString(), counts, entries}, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify({total: entries.length, ...counts})}\n`);
}

main();
