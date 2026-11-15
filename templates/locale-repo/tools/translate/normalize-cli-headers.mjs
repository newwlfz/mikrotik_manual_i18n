#!/usr/bin/env node
/**
 * Chinese metadata labels for the CLI Reference pages.
 *
 * `cli-tables.mjs` owns the argument-table header row (`<ArgTable c1="...">`),
 * which is structure and comes from `config/cli-labels.yml`. The three metadata
 * lines above that table (`**Package:**`, `**Type:**`, `**Syscap:**`) are plain
 * bold prose, so they were left in English while their values were already
 * Chinese — the one residue of the "CLI 中文模型" pass. Menu names and console
 * paths stay English by policy (config/translation-rules.yml: cli-heading-english);
 * only the label token changes here.
 *
 * Scope is deliberate and narrow:
 *   - only `<overlay>/cli-reference/**` of the docs sections (current, 7.25, 7.24);
 *   - only a whole bold label (`**Type:**`, `**Type：**`, any case, spaces
 *     around the word/colon); inline code, fenced code, links and sentences are
 *     untouched because the token must be the entire `**...**` span;
 *   - the value after the colon is never rewritten;
 *   - `cli-reference/compare-versions.md` also gets its two front-matter fields
 *     from an explicit map, and only while they do not contain Chinese.
 *
 *   node tools/translate/normalize-cli-headers.mjs            # apply (default)
 *   node tools/translate/normalize-cli-headers.mjs --check    # report, exit 1 if work remains
 *   node tools/translate/normalize-cli-headers.mjs --section docs-7.25
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import YAML from 'yaml';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter, readField, withFields} from './lib/frontmatter.mjs';

/** English label -> the one Chinese wording (glossary: type/package/syscap). */
export const CLI_LABELS = [
  ['Type', '类型'],
  ['Package', '软件包'],
  ['Syscap', '系统能力'],
];

const CHINESE_LABEL = new Map(CLI_LABELS.map(([english, chinese]) => [english.toLowerCase(), chinese]));

/** A whole bold label: `**Type:**`, `**type :**`, `**Syscap：**`, ... */
const LABEL_PATTERN = /\*\*[ \t]*(Type|Package|Syscap)[ \t]*[:：][ \t]*\*\*/gi;

/** The one page whose front matter is mapped explicitly (no model, no guessing). */
export const COMPARE_VERSIONS = 'compare-versions.md';
export const COMPARE_VERSIONS_FIELDS = {
  title: 'CLI 参考版本对比',
  description: '比较两个 RouterOS CLI 参考版本之间的参数差异。',
};

const CJK = /[\u3400-\u9fff]/;

export function hasChinese(value) {
  return CJK.test(String(value ?? ''));
}

/** `config/cli-labels.yml` `compare_versions` table, read once. */
let compareLabelsCache = null;
export function compareVersionLabels() {
  if (compareLabelsCache) return compareLabelsCache;
  compareLabelsCache = new Map();
  const file = path.join(REPO, 'config/cli-labels.yml');
  if (fs.existsSync(file)) {
    const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    for (const [english, chinese] of Object.entries(parsed.compare_versions || {})) {
      compareLabelsCache.set(String(english).trim().toLowerCase(), {
        english: String(english).trim(),
        chinese: String(chinese),
      });
    }
  }
  return compareLabelsCache;
}

/**
 * A whole emphasis span that is exactly one compare-versions label.
 *
 * The page states its own legend in prose (`**Parameters**`, `*New commands*`),
 * so the label is a token between `**` or `*`, not any occurrence of the word:
 * a sentence that mentions parameters must keep its wording.
 */
const EMPHASIS_LABEL = /(\*\*|\*)([^*\n]+?)\1/g;

/**
 * Rewrite the compare-versions labels that appear in the page Markdown.
 *
 * Fenced code and inline code are skipped, and only an emphasis span whose whole
 * text is a configured label is touched, so the rewriter is idempotent and can
 * never change a sentence. Returns the new body and how many labels changed.
 */
export function normalizeCompareVersionLabels(text) {
  const labels = compareVersionLabels();
  const counts = {};
  let fence = null;
  const body = String(text)
    .split('\n')
    .map((line) => {
      const fenceMatch = /^[ \t]*(`{3,}|~{3,})/.exec(line);
      if (fenceMatch) {
        const marker = fenceMatch[1][0];
        if (!fence) fence = marker;
        else if (fence === marker) fence = null;
        return line;
      }
      if (fence) return line;
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, index) => {
          if (index % 2 === 1) return part; // inline code span
          return part.replace(EMPHASIS_LABEL, (whole, marker, inner) => {
            const hit = labels.get(inner.trim().toLowerCase());
            if (!hit || hit.chinese === inner.trim()) return whole;
            counts[hit.english] = (counts[hit.english] || 0) + 1;
            return `${marker}${hit.chinese}${marker}`;
          });
        })
        .join('');
    })
    .join('\n');
  return {body, counts};
}

/** Label tokens still in English, with their spelling, for the verifier. */
export function englishCliLabels(text) {
  return [...String(text).matchAll(LABEL_PATTERN)].map((match) => ({
    label: match[1].toLowerCase(),
    token: match[0],
  }));
}

/**
 * Rewrite the label tokens in a body.
 *
 * Fenced code and inline code spans are skipped: a `**Type:**` there would be
 * sample text, not a metadata label. Returns the new body and per-label counts.
 */
export function normalizeCliLabels(text) {
  const counts = {type: 0, package: 0, syscap: 0};
  let fence = null;

  const rewriteLine = (line) => {
    const fenceMatch = /^[ \t]*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      return line;
    }
    if (fence) return line;
    return line
      .split(/(`+[^`]*`+)/)
      .map((part, index) => {
        if (index % 2 === 1) return part; // inline code span
        return part.replace(LABEL_PATTERN, (_whole, name) => {
          const key = name.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
          return `**${CHINESE_LABEL.get(key)}：**`;
        });
      })
      .join('');
  };

  const body = String(text)
    .split('\n')
    .map(rewriteLine)
    .join('\n');
  return {body, counts};
}

/**
 * Every field that is not Chinese yet needs the mapped wording, and a missing
 * field counts: the 7.25 English page ships no `description`, so the overlay
 * would otherwise keep `null` and lose its `<meta name="description">` (the
 * table verifier requires both keys to be Chinese on every version that has
 * the page).
 */
export function compareVersionsValues(frontMatter) {
  const values = {};
  for (const [key, chinese] of Object.entries(COMPARE_VERSIONS_FIELDS)) {
    const current = readField(frontMatter, key);
    if (hasChinese(current)) continue;
    values[key] = chinese;
  }
  return values;
}

/** The CLI Reference overlay trees this pass owns. */
export function cliSections() {
  return SECTIONS.filter((section) => section.name === 'docs' || /^docs-/.test(section.name)).map(
    (section) => ({
      name: section.name,
      dir: path.join(REPO, section.overlay, 'cli-reference'),
    }),
  );
}

export function main() {
  const CHECK = process.argv.includes('--check');
  const APPLY = !CHECK;
  const inline = process.argv.find((value) => value.startsWith('--section='));
  const flagIndex = process.argv.indexOf('--section');
  const ONLY_SECTION =
    (inline && inline.split('=').slice(1).join('=')) ||
    (flagIndex !== -1 ? process.argv[flagIndex + 1] : '') ||
    '';

  const all = cliSections();
  const sections = ONLY_SECTION ? all.filter((section) => section.name === ONLY_SECTION) : all;
  if (!sections.length) {
    console.error(`unknown section: ${ONLY_SECTION}`);
    console.error(`known sections: ${all.map((section) => section.name).join(', ')}`);
    process.exit(2);
  }

  const summary = {};
  let totalFiles = 0;
  let totalLabels = 0;
  let totalFrontMatter = 0;

  for (const section of sections) {
    const data = {
      files: 0,
      scanned: 0,
      labels: {type: 0, package: 0, syscap: 0},
      compareLabels: 0,
      frontMatter: 0,
    };
    if (!fs.existsSync(section.dir)) {
      summary[section.name] = data;
      continue;
    }

    for (const file of walkMarkdown(section.dir)) {
      data.scanned++;
      const rel = relative(section.dir, file);
      const text = fs.readFileSync(file, 'utf8');
      const {frontMatter, body} = splitFrontMatter(text);

      const normalized = normalizeCliLabels(body);
      const compare =
        rel === COMPARE_VERSIONS ? normalizeCompareVersionLabels(normalized.body) : null;
      if (compare) normalized.body = compare.body;
      const nextFields =
        rel === COMPARE_VERSIONS ? compareVersionsValues(frontMatter) : {};
      if (Object.keys(nextFields).length) data.frontMatter++;

      const changedLabels =
        Object.values(normalized.counts).reduce((sum, value) => sum + value, 0) +
        (compare ? Object.values(compare.counts).reduce((sum, value) => sum + value, 0) : 0);
      if (!changedLabels && !Object.keys(nextFields).length) continue;

      data.files++;
      for (const [key, value] of Object.entries(normalized.counts)) data.labels[key] += value;
      if (compare) data.compareLabels += Object.values(compare.counts).reduce((sum, value) => sum + value, 0);
      totalFiles++;
      totalLabels += changedLabels;

      if (!APPLY) continue;
      const nextFrontMatter = Object.keys(nextFields).length
        ? withFields(frontMatter, nextFields)
        : frontMatter;
      const head = text.slice(0, text.length - body.length);
      const nextHead =
        nextFrontMatter === frontMatter ? head : head.replace(frontMatter, () => nextFrontMatter);
      fs.writeFileSync(file, `${nextHead}${normalized.body}`);
    }

    totalFrontMatter += data.frontMatter;
    summary[section.name] = data;
    const detail = CLI_LABELS.map(([english]) => `${english} ${data.labels[english.toLowerCase()]}`).join(
      ' ',
    );
    console.log(
      `${CHECK ? 'would change' : 'changed'} ${section.name}: files=${data.files}/${data.scanned} ` +
        `labels=${detail} frontMatter=${data.frontMatter}`,
    );
  }

  console.log(
    JSON.stringify({
      mode: CHECK ? 'check' : 'apply',
      sections: summary,
      totals: {files: totalFiles, labels: totalLabels, frontMatter: totalFrontMatter},
    }),
  );

  if (CHECK && (totalLabels || totalFrontMatter)) process.exitCode = 1;
}

// Importing this module must not run the pass or print a second JSON line.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
