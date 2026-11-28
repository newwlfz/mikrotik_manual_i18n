#!/usr/bin/env node
/**
 * Chinese metadata labels for the CLI Reference pages.
 *
 * `cli-tables.mjs` owns the argument-table header row (`<ArgTable c1="...">`),
 * which is structure and comes from `config/cli-labels.yml`. The three metadata
 * lines above that table (`**Package:**`, `**Type:**`, `**Syscap:**`) are plain
 * bold prose. Their *target wording* is now also locale-driven: it is read from
 * `config/cli-labels.yml` `cli_labels:<locale>` by the same mechanism as
 * `compare_versions_frontmatter`, so a zh-Hant overlay can never be filled with
 * zh-Hans glyphs. Menu names and console paths stay English by policy
 * (config/translation-rules.yml: cli-heading-english).
 *
 * Scope is deliberate and narrow:
 *   - only `<overlay>/cli-reference/**` of the docs sections (current, 7.25, 7.24);
 *   - only a whole bold label (`**Type:**`, `**type :**`, `**Syscap：**`,
 *     `**类型：**`, `**系統能力：**`, ... any case, spaces around the word/colon);
 *     inline code, fenced code, links and sentences are untouched because the
 *     token must be the entire `**...**` span;
 *   - the value after the colon is never rewritten. A label already equal to
 *     the requested locale's wording is left alone (no churn, `--check` stays 0);
 *   - `cli-reference/compare-versions.md` also gets its front matter from
 *     `config/cli-labels.yml` `compare_versions_frontmatter`, picked by target
 *     locale. A field is rewritten only when its current value differs from
 *     that locale's expected wording (no "contains Chinese" guessing);
 *   - that page's four-bullet "How the comparison works" list is replaced as a
 *     WHOLE block from `config/cli-labels.yml` `compare_versions_body:<locale>`.
 *     The anchor and inline code in the translated block are kept verbatim, and
 *     the 4 whole-span label injection runs before this pass, so a replaced
 *     block already containing its labels is never injected twice.
 *
 *   node tools/translate/normalize-cli-headers.mjs            # apply (default)
 *   node tools/translate/normalize-cli-headers.mjs --check    # report, exit 1 if work remains
 *   node tools/translate/normalize-cli-headers.mjs --section docs-7.25
 *   node tools/translate/normalize-cli-headers.mjs --locale=zh-Hant --check
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import YAML from 'yaml';
import {
  REPO,
  DEFAULT_TARGET_LOCALE,
  sectionsFor,
  walkMarkdown,
  relative,
} from './lib/paths.mjs';
import {splitFrontMatter, readField, withFields} from './lib/frontmatter.mjs';

/** English source tokens; their Chinese wording always comes from config. */
const CLI_LABEL_KEYS = ['Type', 'Package', 'Syscap'];

/** Whole bold **English** label — used by `englishCliLabels()` for the verifier. */
const ENGLISH_LABEL_PATTERN = /\*\*[ \t]*(Type|Package|Syscap)[ \t]*[:：][ \t]*\*\*/gi;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Per-locale metadata label wording from `config/cli-labels.yml`
 * (`cli_labels:<locale>: {Type, Package, Syscap}`), read once. Empty or missing
 * entries are skipped: a new locale without reviewed wording keeps its current
 * labels instead of getting another locale's glyphs.
 */
let cliLabelsCache = null;
export function cliLabelsByLocale() {
  if (cliLabelsCache) return cliLabelsCache;
  cliLabelsCache = new Map();
  const file = path.join(REPO, 'config/cli-labels.yml');
  if (fs.existsSync(file)) {
    const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    for (const [locale, entries] of Object.entries(parsed.cli_labels || {})) {
      const labels = new Map();
      for (const english of CLI_LABEL_KEYS) {
        const value = String(entries?.[english] ?? '').trim();
        if (value) labels.set(english.toLowerCase(), value);
      }
      if (labels.size) cliLabelsCache.set(String(locale).trim(), labels);
    }
  }
  return cliLabelsCache;
}

/** Expected metadata labels for one locale; empty when the locale is not reviewed. */
export function cliLabels(locale = DEFAULT_TARGET_LOCALE) {
  return cliLabelsByLocale().get(String(locale ?? '').trim()) || new Map();
}

/**
 * Stale spellings recognised for rewrite: the English tokens plus *every*
 * configured wording (e.g. the Simplified glyphs from `zh-Hans`). This is how a
 * wrongly applied Simplified label is repaired without hardcoding one in JS.
 */
function cliLabelAliases() {
  const aliases = new Map();
  for (const english of CLI_LABEL_KEYS) aliases.set(english.toLowerCase(), english.toLowerCase());
  for (const labels of cliLabelsByLocale().values()) {
    for (const [key, chinese] of labels) aliases.set(chinese.toLowerCase(), key);
  }
  return aliases;
}

/** A whole bold label whose token is a known English or configured spelling. */
function staleLabelPattern() {
  const alternatives = [...cliLabelAliases().keys()].sort((a, b) => b.length - a.length);
  if (!alternatives.length) return null;
  return new RegExp(`\\*\\*[ \\t]*(${alternatives.map(escapeRegExp).join('|')})[ \\t]*[:：][ \\t]*\\*\\*`, 'gi');
}

/** The one page whose front matter is mapped explicitly (no model, no guessing). */
export const COMPARE_VERSIONS = 'compare-versions.md';

const CJK = /[\u3400-\u9fff]/;

/** Kept for tools/verify/cli-tables.mjs; the deterministic map no longer guesses by script. */
export function hasChinese(value) {
  return CJK.test(String(value ?? ''));
}

/**
 * Per-locale front-matter wording from `config/cli-labels.yml`
 * (`compare_versions_frontmatter:<locale>: {title, description}`), read once.
 * Empty or missing entries are skipped: a new locale without reviewed wording
 * keeps its current front matter instead of getting another locale's text.
 */
let compareFrontMatterCache = null;
export function compareVersionsFrontMatter() {
  if (compareFrontMatterCache) return compareFrontMatterCache;
  compareFrontMatterCache = new Map();
  const file = path.join(REPO, 'config/cli-labels.yml');
  if (fs.existsSync(file)) {
    const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    for (const [locale, fields] of Object.entries(parsed.compare_versions_frontmatter || {})) {
      const title = String(fields?.title ?? '').trim();
      const description = String(fields?.description ?? '').trim();
      if (!title || !description) continue;
      compareFrontMatterCache.set(String(locale).trim(), {title, description});
    }
  }
  return compareFrontMatterCache;
}

/** Expected fields for one locale; `{}` when the locale has no reviewed entry. */
export function compareVersionsFields(locale = DEFAULT_TARGET_LOCALE) {
  return compareVersionsFrontMatter().get(String(locale ?? '').trim()) || {};
}

/** Default-locale view of the map, for tools/verify/cli-tables.mjs (keys and wording). */
export const COMPARE_VERSIONS_FIELDS = compareVersionsFields();

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

/**
 * Per-locale full wording of the compare-versions "How the comparison works"
 * list, from `config/cli-labels.yml` `compare_versions_body`.
 *
 * Two shapes are accepted: a locale key mapped straight to a block scalar
 * (the three shipped locale repositories), or a locale key mapped to a map of
 * language -> block (the `{{LOCALE}}` scaffold, whose value must be a
 * replaceable multilingual structure so a newly added locale selects none of
 * the reviewed languages until its own wording exists). A locale with no entry
 * is left untouched — no English fallback from another locale.
 */
let compareBodiesCache = null;
export function compareVersionsBodies() {
  if (compareBodiesCache) return compareBodiesCache;
  compareBodiesCache = new Map();
  const file = path.join(REPO, 'config/cli-labels.yml');
  if (fs.existsSync(file)) {
    const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    for (const [locale, entry] of Object.entries(parsed.compare_versions_body || {})) {
      const tag = String(locale).trim();
      let value = null;
      if (typeof entry === 'string') value = entry;
      else if (entry && typeof entry === 'object') value = entry[tag] ?? entry[tag.toLowerCase()];
      if (typeof value === 'string' && value.trim()) compareBodiesCache.set(tag, value.trim());
    }
  }
  return compareBodiesCache;
}

/** Reviewed four-bullet block for one locale; '' when there is none. */
export function compareVersionsBody(locale = DEFAULT_TARGET_LOCALE) {
  return compareVersionsBodies().get(String(locale ?? '').trim()) || '';
}

/** Heading that introduces the list (the overlay keeps its `{#...}` anchor). */
const COMPARE_BODY_HEADING = /^##[ \t].*(?:\{#how-the-comparison-works\}|How the comparison works)[ \t]*$/;

/**
 * Byte range of the contiguous list block after that heading. Exactly four
 * top-level bullets are required; anything else is left alone rather than
 * guessing at a different page layout.
 */
function compareBodyBlock(text) {
  const source = String(text);
  const lines = source.split('\n');
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  const heading = lines.findIndex((line) => COMPARE_BODY_HEADING.test(line));
  if (heading < 0) return null;
  let start = -1;
  let bullets = 0;
  let last = -1;
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i];
    if (start === -1) {
      if (!line.trim()) continue;
      if (!/^[-*+][ \t]/.test(line)) return null;
      start = i;
      bullets = 1;
      last = i;
      continue;
    }
    if (/^[-*+][ \t]/.test(line)) {
      bullets++;
      last = i;
      continue;
    }
    if (/^[ \t]+\S/.test(line)) {
      last = i; // wrapped bullet line
      continue;
    }
    if (!line.trim() && i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1])) {
      last = i;
      continue;
    }
    break;
  }
  if (start < 0 || bullets !== 4) return null;
  const from = offsets[start];
  const to = offsets[last] + lines[last].length;
  return {from, to, text: source.slice(from, to)};
}

/**
 * Replace the whole four-bullet list with this locale's reviewed wording.
 *
 * The heading (and its anchor) and everything after the list are outside the
 * replaced range; inline code inside the bullets lives in the configured
 * block scalar and is preserved byte for byte. An already-matching block is a
 * no-op, so repeated runs and `--check` stay stable.
 */
export function normalizeCompareVersionBody(text, locale = DEFAULT_TARGET_LOCALE) {
  const source = String(text);
  const wanted = compareVersionsBody(locale);
  if (!wanted) return {body: source, counts: {blocks: 0}};
  const block = compareBodyBlock(source);
  if (!block || block.text.trim() === wanted.trim()) return {body: source, counts: {blocks: 0}};
  return {
    body: source.slice(0, block.from) + wanted + source.slice(block.to),
    counts: {blocks: 1},
  };
}

/** English label tokens still in English, with their spelling, for the verifier. */
export function englishCliLabels(text) {
  return [...String(text).matchAll(ENGLISH_LABEL_PATTERN)].map((match) => ({
    label: match[1].toLowerCase(),
    token: match[0],
  }));
}

/**
 * Rewrite the metadata label tokens in a body for the requested locale.
 *
 * The wording is always taken from `cli_labels:<locale>` in config; a stale
 * spelling (English or another locale's wording) is rewritten only when the
 * target locale has a reviewed value. Fenced code and inline code spans are
 * skipped: a `**Type:**` there would be sample text, not a metadata label.
 * Returns the new body and per-label counts.
 */
export function normalizeCliLabels(text, locale = DEFAULT_TARGET_LOCALE) {
  const counts = Object.fromEntries(CLI_LABEL_KEYS.map((key) => [key.toLowerCase(), 0]));
  const expected = cliLabels(locale);
  const aliases = cliLabelAliases();
  const pattern = staleLabelPattern();
  if (!pattern || !expected.size) return {body: String(text), counts};
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
        return part.replace(pattern, (whole, name) => {
          const key = aliases.get(name.trim().toLowerCase());
          const wanted = key && expected.get(key);
          if (!wanted || name.trim() === wanted) return whole;
          counts[key] = (counts[key] || 0) + 1;
          return `**${wanted}：**`;
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
 * Any field that differs from its locale's expected wording is rewritten —
 * including a missing field (the 7.25 English page ships no `description`).
 * Comparing against the locale's exact value, rather than testing for Chinese
 * script, keeps zh-Hant pages from being filled with zh-Hans wording and keeps
 * an already-correct locale page untouched.
 */
export function compareVersionsValues(frontMatter, locale = DEFAULT_TARGET_LOCALE) {
  const expected = compareVersionsFields(locale);
  const values = {};
  for (const [key, wanted] of Object.entries(expected)) {
    const current = readField(frontMatter, key);
    if (String(current ?? '') === wanted) continue;
    values[key] = wanted;
  }
  return values;
}

/** The CLI Reference overlay trees this pass owns, for the requested locale. */
export function cliSections(locale = DEFAULT_TARGET_LOCALE) {
  return sectionsFor(locale)
    .filter((section) => section.name === 'docs' || /^docs-/.test(section.name))
    .map((section) => ({
      name: section.name,
      dir: path.join(REPO, section.overlay, 'cli-reference'),
    }));
}

export function main() {
  const CHECK = process.argv.includes('--check');
  const APPLY = !CHECK;
  // Locale comes from `--locale=<tag>` / `--locale <tag>`, or this repository's
  // DEFAULT_TARGET_LOCALE (tools/translate/lib/paths.mjs). It selects both the
  // overlay paths (sectionsFor) and the expected wording (labels + front matter).
  const localeInline = process.argv.find((value) => value.startsWith('--locale='));
  const localeFlag = process.argv.indexOf('--locale');
  const LOCALE =
    (localeInline && localeInline.slice('--locale='.length).trim()) ||
    (localeFlag !== -1 ? String(process.argv[localeFlag + 1] ?? '').trim() : '') ||
    DEFAULT_TARGET_LOCALE;
  const inline = process.argv.find((value) => value.startsWith('--section='));
  const flagIndex = process.argv.indexOf('--section');
  const ONLY_SECTION =
    (inline && inline.split('=').slice(1).join('=')) ||
    (flagIndex !== -1 ? process.argv[flagIndex + 1] : '') ||
    '';

  const all = cliSections(LOCALE);
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
      labels: Object.fromEntries(CLI_LABEL_KEYS.map((key) => [key.toLowerCase(), 0])),
      compareLabels: 0,
      compareBody: 0,
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

      const normalized = normalizeCliLabels(body, LOCALE);
      const compare =
        rel === COMPARE_VERSIONS ? normalizeCompareVersionLabels(normalized.body) : null;
      if (compare) normalized.body = compare.body;
      // The whole-block pass runs after the 4-label pass: its wording already
      // contains the labels, so no second injection is needed and no label is
      // left in the wrong locale's glyphs.
      const bodyPass =
        rel === COMPARE_VERSIONS
          ? normalizeCompareVersionBody(normalized.body, LOCALE)
          : null;
      if (bodyPass) normalized.body = bodyPass.body;
      const nextFields =
        rel === COMPARE_VERSIONS ? compareVersionsValues(frontMatter, LOCALE) : {};
      if (Object.keys(nextFields).length) data.frontMatter++;

      const changedLabels =
        Object.values(normalized.counts).reduce((sum, value) => sum + value, 0) +
        (compare ? Object.values(compare.counts).reduce((sum, value) => sum + value, 0) : 0) +
        (bodyPass ? Object.values(bodyPass.counts).reduce((sum, value) => sum + value, 0) : 0);
      if (!changedLabels && !Object.keys(nextFields).length) continue;

      data.files++;
      for (const [key, value] of Object.entries(normalized.counts)) data.labels[key] += value;
      if (compare) data.compareLabels += Object.values(compare.counts).reduce((sum, value) => sum + value, 0);
      if (bodyPass) data.compareBody += Object.values(bodyPass.counts).reduce((sum, value) => sum + value, 0);
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
    const detail = CLI_LABEL_KEYS.map(
      (english) => `${english} ${data.labels[english.toLowerCase()]}`,
    ).join(' ');
    console.log(
      `${CHECK ? 'would change' : 'changed'} ${section.name}: files=${data.files}/${data.scanned} ` +
        `labels=${detail} compareBody=${data.compareBody} frontMatter=${data.frontMatter}`,
    );
  }

  console.log(
    JSON.stringify({
      mode: CHECK ? 'check' : 'apply',
      locale: LOCALE,
      sections: summary,
      totals: {files: totalFiles, labels: totalLabels, frontMatter: totalFrontMatter},
    }),
  );

  if (CHECK && (totalLabels || totalFrontMatter)) process.exitCode = 1;
}

// Importing this module must not run the pass or print a second JSON line.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
