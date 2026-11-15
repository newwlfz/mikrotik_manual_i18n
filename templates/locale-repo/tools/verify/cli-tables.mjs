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
 *     `description` (its wording is mapped by normalize-cli-headers.mjs).
 *
 *   node tools/verify/cli-tables.mjs
 *   node tools/verify/cli-tables.mjs --pages          # worst pages
 *   node tools/verify/cli-tables.mjs --threshold=0    # stricter than CI
 *
 * Exit code 1 when a version exceeds the English-row budget, a header keeps an
 * English label, or an `arg`/`typ` value drifted.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {SECTIONS, REPO, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {attrsOf, hasProse, parseTables} from '../translate/lib/arg-tables.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {currentVersion, sectionNameFor} from '../sync/lib/versions.mjs';
import {
  COMPARE_VERSIONS,
  COMPARE_VERSIONS_FIELDS,
  englishCliLabels,
  hasChinese,
} from '../translate/normalize-cli-headers.mjs';

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
