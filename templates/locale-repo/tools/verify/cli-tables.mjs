#!/usr/bin/env node
/**
 * Verify the CLI Reference argument tables.
 *
 * `translate verify` skips every block that starts with `<`, so a CLI page can
 * be 100% English and still report `untranslatedBlocks: 0`. This is the missing
 * measurement, and it is also a structural check: translating a row must never
 * touch `arg=` or `typ=`, and the header must never keep an English label.
 *
 * Rules:
 *   - an argument row is "English" when its description is still English prose.
 *     Pure identifiers and enum values (`managed`, `yes/no`, `hw-offloaded`,
 *     `BGP VPLS`) are allowed to stay in English;
 *   - `arg` and `typ` must equal the English source row for every paired row;
 *   - `c1`/`c2`/`c3` must not contain `Argument`, `Type`, `Description`, `Flag`
 *     or `Name` in any overlay table;
 *   - the page metadata labels (`**Type:**`, `**Package:**`, `**Syscap:**`) must
 *     not remain in English anywhere in the three `cli-reference` overlay trees;
 *   - `cli-reference/compare-versions.md` must have a Chinese `title` and
 *     `description` (its wording is mapped by normalize-cli-headers.mjs);
 *   - that page's "How the comparison works" list must not be English prose on
 *     a zh-Hans/zh-Hant site. It is plain prose, not an `<ArgTable>` row, so the
 *     table report above cannot see a whole-body fallback to English.
 *
 *   node tools/verify/cli-tables.mjs
 *   node tools/verify/cli-tables.mjs --pages          # worst pages
 *   node tools/verify/cli-tables.mjs --threshold=0    # stricter than CI
 *
 * Exit code 1 when a version exceeds the English-row budget, a header keeps an
 * English label, an `arg`/`typ` value drifted, or the compare-versions body is
 * still English prose on a Chinese site.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {SECTIONS, REPO, DEFAULT_TARGET_LOCALE, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {attrsOf, hasProse, parseTables, stripForProse} from '../translate/lib/arg-tables.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {currentVersion, sectionNameFor} from '../sync/lib/versions.mjs';
import {
  COMPARE_VERSIONS,
  englishCliLabels,
  hasChinese,
} from '../translate/normalize-cli-headers.mjs';

/**
 * Fixed required front-matter fields for the compare-versions overlay.
 * This used to be `compareVersionsFields()` read from `config/cli-labels.yml`;
 * when that table was empty the loop below checked zero fields and passed
 * vacuously. The required set is policy, not configuration.
 */
const COMPARE_VERSIONS_FIELDS = Object.freeze({title: 'title', description: 'description'});

// --- compare-versions body: pointed English-prose assertion ------------------
// The four bullets under `## How the comparison works` are plain Markdown
// prose, not `<ArgTable>` rows, so the table report above is blind to a
// whole-body fallback to English. verify.mjs cannot fix this globally ("has any
// CJK" would misjudge CLI heading blocks), so the check lives here and only on
// this one page. It reuses the SAME CJK-based `hasProse()` decision as the
// argument rows, so it cannot be looser than the existing gate.
const COMPARE_BODY_HEADING =
  /^##[ \t].*(?:\{#how-the-comparison-works\}|How the comparison works)[ \t]*$/;

/** Strict by design: a translated list may keep zero English-prose words. */
const COMPARE_BODY_ENGLISH_LIMIT = 1;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The `compare_versions` table in config/cli-labels.yml (27 legend tokens such
 * as `Parameters`, `Flags`, `New commands`), longest first. They are labels,
 * not prose, so they are stripped before the English-word count.
 */
function compareLabelTokens() {
  const file = path.join(REPO, 'config/cli-labels.yml');
  const parsed = fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) || {} : {};
  // Read the raw table: two keys differ only by case, so a lowercased Map would
  // silently drop one of the 27 tokens.
  return Object.keys(parsed.compare_versions || {})
    .map((key) => String(key).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

/** Contiguous list block below the locale-independent `{#...}` heading. */
function compareBodyBlock(body) {
  const lines = String(body).split(/\r?\n/);
  const heading = lines.findIndex((line) => COMPARE_BODY_HEADING.test(line));
  if (heading < 0) return null;
  const block = [];
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!block.length && !line.trim()) continue; // blank line before the first bullet
    if (/^[-*+][ \t]/.test(line)) {
      block.push(line);
      continue;
    }
    if (block.length && /^[ \t]+\S/.test(line)) {
      block.push(line); // wrapped bullet line
      continue;
    }
    if (block.length && !line.trim() && /^[ \t]+\S/.test(lines[i + 1] || '')) {
      block.push(line);
      continue;
    }
    break;
  }
  return block.length ? block.join('\n') : null;
}

/** English prose words in that list after dropping inline code and the labels. */
function compareBodyEnglish(block, tokens) {
  let words = 0;
  for (const line of block.split(/\r?\n/)) {
    if (!/^[-*+][ \t]/.test(line)) continue;
    let clean = line.replace(/`+[^`]*`+/g, ' ');
    for (const token of tokens) {
      clean = clean.replace(
        new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(token)}(?![A-Za-z0-9])`, 'gi'),
        ' ',
      );
    }
    clean = stripForProse(clean.replace(/\*+/g, ' '));
    if (!hasProse(clean)) continue; // the existing CJK decision, unchanged
    words += (clean.match(/[A-Za-z]{2,}/g) || []).filter((word) => /[a-z]/.test(word)).length;
  }
  return words;
}

const arg = (name, fallback) => {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
};

const THRESHOLD = Number(arg('threshold', '50'));
const ONLY_SECTION = arg('section', '');
const SHOW_PAGES = process.argv.includes('--pages');
const JSON_OUT = process.argv.includes('--json');

const LABELS_FILE = path.join(REPO, 'config/cli-labels.yml');
const ENGLISH_HEADERS = new Set(
  fs.existsSync(LABELS_FILE)
    ? Object.keys(YAML.parse(fs.readFileSync(LABELS_FILE, 'utf8'))?.headers || {})
    : ['Argument', 'Type', 'Description', 'Flag', 'Name', 'Read-only Argument', 'Read-only Flag'],
);

// --- Repository role ---------------------------------------------------------
// This verifier audits one locale repository's CLI overlays against its English
// source. The hub is the *source* repository: it has no locale overlay tree, so
// the compare-versions front-matter assertion below (originally at :242-250)
// fails unconditionally even though there is nothing to audit. Detect that role
// up front and skip cleanly instead of reporting a design mismatch as a real
// CI regression. A locale repository with overlays keeps the exact same strict
// gate: THRESHOLD stays 50 and headers/attrMismatch must still be zero.
const HAS_LABELS_CONFIG = fs.existsSync(LABELS_FILE);
const HAS_LOCALE_OVERLAY = SECTIONS.some((section) =>
  fs.existsSync(path.join(REPO, section.overlay)),
);
if (!HAS_LABELS_CONFIG || !HAS_LOCALE_OVERLAY) {
  const reason = !HAS_LABELS_CONFIG
    ? 'no config/cli-labels.yml'
    : 'no locale overlay directory';
  console.log(`skipped: hub/non-locale repository (${reason})`);
  process.exit(0);
}

function versionOrder(section) {
  const version = /version-(\d+)\.(\d+)/.exec(section.source);
  if (version) return [Number(version[1]), Number(version[2]), 0];
  return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1];
}

const docsSections = SECTIONS.filter((section) => section.name === 'docs' || /^docs-/.test(section.name)).sort(
  (a, b) => {
    const left = versionOrder(a);
    const right = versionOrder(b);
    // Newest first in the report: it is the version a reader lands on.
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  },
);
const sections = ONLY_SECTION
  ? docsSections.filter((section) => section.name === ONLY_SECTION)
  : docsSections;

if (!sections.length) {
  console.error(`unknown section: ${ONLY_SECTION}`);
  process.exit(2);
}

const report = {};
let failed = false;

for (const section of sections) {
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) continue;

  const data = {
    rows: 0,
    english: 0,
    pages: 0,
    headers: 0,
    attrMismatch: 0,
    unpairedRows: 0,
    unpairedTables: 0,
    englishPages: [],
  };
  const englishPages = new Map();
  const sourceTablesByFile = new Map();

  for (const sourceFile of walkMarkdown(sourceBase)) {
    const rel = relative(sourceBase, sourceFile);
    const tables = parseTables(fs.readFileSync(sourceFile, 'utf8'));
    if (tables.length) sourceTablesByFile.set(rel, tables);
  }

  for (const overlayFile of walkMarkdown(overlayBase)) {
    const rel = relative(overlayBase, overlayFile);
    const tables = parseTables(fs.readFileSync(overlayFile, 'utf8'));
    if (!tables.length) continue;
    data.pages = data.pages || 0;
    const sourceTables = sourceTablesByFile.get(rel) || [];
    let pageEnglish = 0;

    for (let t = 0; t < tables.length; t++) {
      const table = tables[t];
      const header = attrsOf(table.header);
      for (const name of ['c1', 'c2', 'c3']) {
        if (header[name] && ENGLISH_HEADERS.has(header[name])) {
          data.headers++;
          break;
        }
      }

      const sourceTable = sourceTables[t];
      if (!sourceTable || sourceTable.rows.length !== table.rows.length) {
        data.unpairedTables++;
      }
      for (let r = 0; r < table.rows.length; r++) {
        const row = table.rows[r];
        data.rows++;
        if (hasProse(row.text)) {
          data.english++;
          pageEnglish++;
        }
        if (!sourceTable || !sourceTable.rows[r]) {
          data.unpairedRows++;
          continue;
        }
        const source = attrsOf(sourceTable.rows[r].open);
        const overlay = attrsOf(row.open);
        if (source.arg !== overlay.arg || source.typ !== overlay.typ) {
          data.attrMismatch++;
          if (data.attrMismatch <= 10) {
            console.log(
              `DRIFT ${rel} table#${t + 1} row#${r + 1}: ` +
                `source arg=${JSON.stringify(source.arg)} typ=${JSON.stringify(source.typ)} ` +
                `overlay arg=${JSON.stringify(overlay.arg)} typ=${JSON.stringify(overlay.typ)}`,
            );
          }
        }
      }
    }
    if (pageEnglish) englishPages.set(rel, pageEnglish);
  }

  data.pages = englishPages.size;
  data.englishPages = [...englishPages.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([file, count]) => ({file, count}));

  const ok =
    data.english <= THRESHOLD && data.headers === 0 && data.attrMismatch === 0;
  if (!ok) failed = true;
  report[section.name] = data;

  if (JSON_OUT) continue;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${section.name}: rows=${data.rows} english=${data.english} ` +
      `pages=${data.pages} headers=${data.headers} attrMismatch=${data.attrMismatch} ` +
      `unpaired=${data.unpairedRows}/${data.unpairedTables}`,
  );
  if (SHOW_PAGES && data.englishPages.length) {
    for (const page of data.englishPages.slice(0, 15)) {
      console.log(`  ${page.count}\t${page.file}`);
    }
  }
}

// --- Metadata labels and the compare-versions front matter -------------------
//
// Independent of the table report above: the label check walks every CLI page,
// and the front-matter check is one explicit page. Both run for the selected
// sections (all three by default) and both fail the verifier.
const labelCounts = {};
const labelSamples = [];
let labelTotal = 0;
let metadataOk = true;

for (const section of sections) {
  const dir = path.join(REPO, section.overlay, 'cli-reference');
  if (!fs.existsSync(dir)) continue;
  let count = 0;
  for (const file of walkMarkdown(dir)) {
    const rel = relative(dir, file);
    const found = englishCliLabels(splitFrontMatter(fs.readFileSync(file, 'utf8')).body);
    if (!found.length) continue;
    count += found.length;
    if (labelSamples.length < 15) labelSamples.push(`${section.name}/${rel}: ${found.length}`);
  }
  labelTotal += count;
  labelCounts[section.name] = count;
}

const labelSummary = Object.entries(labelCounts)
  .map(([name, count]) => `${name}=${count}`)
  .join(' ');

if (labelTotal) {
  failed = true;
  metadataOk = false;
  console.error(`FAIL cli-metadata-labels: ${labelTotal} English label(s) remain (${labelSummary})`);
  for (const sample of labelSamples) console.error(`  ${sample}`);
}

let compareChecked = 0;
for (const section of sections) {
  const file = path.join(REPO, section.overlay, 'cli-reference', COMPARE_VERSIONS);
  if (!fs.existsSync(file)) continue;
  compareChecked++;
  const {frontMatter} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
  for (const key of Object.keys(COMPARE_VERSIONS_FIELDS)) {
    const value = readField(frontMatter, key);
    if (hasChinese(value)) continue;
    failed = true;
    metadataOk = false;
    console.error(
      `FAIL cli-metadata-labels: ${section.name}/${COMPARE_VERSIONS} ${key}=${JSON.stringify(value)} is not Chinese`,
    );
  }
}

if (!compareChecked && sections.some((section) => section.name === sectionNameFor(currentVersion()))) {
  failed = true;
  metadataOk = false;
  console.error(
    `FAIL cli-metadata-labels: no ${COMPARE_VERSIONS} overlay under ${sections
      .map((section) => section.name)
      .join(', ')}`,
  );
}

// --- the page body itself (plain prose, invisible to the table report) ------
let bodyChecked = 0;
let bodyEnglish = 0;
const bodyDetail = [];
const bodyTokens = compareLabelTokens();
const isEnglishSite = /^en(?:[-_]|$)/i.test(String(DEFAULT_TARGET_LOCALE ?? '').trim());

for (const section of sections) {
  const file = path.join(REPO, section.overlay, 'cli-reference', COMPARE_VERSIONS);
  if (!fs.existsSync(file)) continue;
  const {body} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
  const block = compareBodyBlock(body);
  if (!block) continue; // no recognisable list on this page: N/A, not a guess
  bodyChecked++;
  const english = compareBodyEnglish(block, bodyTokens);
  bodyEnglish += english;
  bodyDetail.push(`${section.name}=${english}`);
}

const bodyOk = isEnglishSite || bodyEnglish < COMPARE_BODY_ENGLISH_LIMIT;
if (!bodyOk) {
  failed = true; // its own gate; `metadataOk` stays about metadata labels only
  console.error(
    `FAIL compareVersionsBody: english=${bodyEnglish} >= ${COMPARE_BODY_ENGLISH_LIMIT} ` +
      `on ${DEFAULT_TARGET_LOCALE} (${bodyDetail.join(' ')})`,
  );
}
if (!JSON_OUT) {
  console.log(
    `${bodyOk ? 'ok  ' : 'FAIL'} compareVersionsBody: english=${bodyEnglish} ` +
      `limit=${COMPARE_BODY_ENGLISH_LIMIT} checked=${bodyChecked} (${bodyDetail.join(' ') || '-'})` +
      `${isEnglishSite ? ' en=pass' : ''}`,
  );
}

if (!JSON_OUT) {
  console.log(
    `${metadataOk ? 'ok  ' : 'FAIL'} cli-metadata-labels: english=${labelTotal} ` +
      `compareVersions=${compareChecked} (${labelSummary})`,
  );
}

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        threshold: THRESHOLD,
        sections: report,
        labels: {total: labelTotal, sections: labelCounts},
        compareVersions: {checked: compareChecked, fields: COMPARE_VERSIONS_FIELDS},
        compareVersionsBody: {
          english: bodyEnglish,
          limit: COMPARE_BODY_ENGLISH_LIMIT,
          checked: bodyChecked,
          labels: bodyTokens.length,
          locale: DEFAULT_TARGET_LOCALE,
          enSite: isEnglishSite,
        },
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    `${failed ? 'FAIL' : 'ok  '} cli-tables: english prose rows must be <= ${THRESHOLD}; ` +
      `table headers and arg/typ attributes must match the English source`,
  );
}

if (failed) process.exitCode = 1;
