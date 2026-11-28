#!/usr/bin/env node
/**
 * Table coverage baseline.
 *
 * `translate:verify` deliberately ignores blocks that start with `|`, so a page
 * whose whole table is English still reports `untranslatedBlocks: 0`. This is
 * the missing measurement: how many table rows are still English, per section.
 *
 *   node tools/verify/table-coverage.mjs
 *   node tools/verify/table-coverage.mjs --pages
 *   node tools/verify/table-coverage.mjs --check   # exit 1 unless both counts are 0
 *
 * The check is an absolute gate, not a budget: every English table header and
 * every English prose row must be 0 in every docs release. The old budget let
 * hundreds of untranslated rows pass; tables.mjs now translates them (behind
 * placeholders, with one TM entry per row), so a remaining English row is a
 * real defect rather than an allowance.
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, REPO, walkMarkdown} from '../translate/lib/paths.mjs';

const CJK = /[\u4e00-\u9fff]/;
const SEP = /^\s*\|[\s:|-]+\|\s*$/;
const prose = (line) =>
  (
    line
      .replace(/<[^>]+>/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
      .replace(/[*_>#|]/g, ' ')
      .match(/[A-Za-z]{2,}/g) || []
  ).length;

/**
 * The verbosity metric above counts any two Latin words, so a data row such as
 * `| 2.4ghz-onlyg | 6 | 0-7 |` looks "English". A row is actionable only when
 * some *cell* holds a phrase of two or more plain words (letters only): that is
 * prose, and everything else is an identifier or a value.
 */
// Code is not language. Strip `<code>…</code>` and inline code *with their
// contents* before extracting words, the same way tables.mjs protects spans:
// a cell made only of a RouterOS command (`/interface/bridge add …`) is an
// identifier, not an English prose sentence, even though its comment reads
// like one.
const stripCode = (text) =>
  text.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ').replace(/`[^`]*`/g, ' ');
const plainWords = (text) =>
  stripCode(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ')
    .split(/[|\s]+/)
    .map((word) => word.replace(/^[*_#]+|[*_#]+$/g, ''))
    .filter((word) => /^[A-Za-z]{3,}$/.test(word));

/**
 * A lowercase word alone is not prose: `Socket Secure`, `LtAP mini`,
 * `hAP be3 media`, `CRL URL` and `no/yes` are identifiers, enum values or
 * product names. A natural-language description additionally carries at
 * least one ordinary English word — the same class of word a translator can
 * actually render into Chinese. This refines *what* counts as prose; it never
 * relaxes the zero threshold below.
 */
const PROSE_WORDS = new Set(
  `the of to in on at with for from by and or is are was were be been will can should may
   when where which that this these those not only also then than into over under about
   after before through during via using used use using taken takes take kept keep
   name names value values length number count time interval delay address addresses
   packet packets traffic interface interfaces option options setting settings
   enabled disabled default defaults specifies specify allows allow enables enable
   sends send adds add sets set changes change determines determine controls control
   data type types list lists shows show supported support applies apply effect
   without within between must can will only effect effects`.split(/\s+/),
);
const hasProseSignal = (line) =>
  plainWords(line).some((word) => /^[a-z]{3,}$/.test(word) && PROSE_WORDS.has(word));
const hasPhrase = (line) =>
  line
    .replace(/^\s*\||\|\s*$/g, '')
    .split(/(?<!\\)\|/)
    .some((cell) => plainWords(cell).length >= 2);

/**
 * Header vocabulary. A first row such as `| 02010615ff... |` or
 * `| app set-mode &lt;mode> |` is a data row that happens to come first, not a
 * header: only a row made of these words (or holding a real phrase) is one.
 */
const HEADER_WORDS = new Set(
  `property description name parameter value type default comment option attribute field setting command example meaning format unit range address port protocol status level action result note timeout interface path package menu keyword argument return syntax parameter`.split(/\s+/),
);

const SHOW_PAGES = process.argv.includes('--pages');
const CHECK = process.argv.includes('--check');
const ENGLISH = /[A-Za-z]{3,}/;

const sections = SECTIONS.filter((section) => /^docs/.test(section.name));
const rowsBySection = new Map();

for (const section of sections) {
  const base = path.join(REPO, section.overlay);
  if (!fs.existsSync(base)) continue;
  let rows = 0;
  let english = 0;
  let proseCount = 0;
  let headerCount = 0;
  const headerPages = new Map();
  const pages = [];
  const englishRows = new Set();
  for (const file of walkMarkdown(base)) {
    let count = 0;
    let pageHeaders = 0;
    let previousWasRow = false;
    let inFence = false;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      // ASCII diagrams inside a fenced code block are code, not table prose.
      // They may look like pipe rows (`|  \------- netmask length ... |`) but
      // the translation pipeline is required to keep them byte-for-byte.
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        previousWasRow = false;
        continue;
      }
      if (inFence) continue;
      const isRow = /^\s*\|/.test(line);
      if (!isRow) {
        previousWasRow = false;
        continue;
      }
      const next = lines[index + 1] || '';
      const headerLike =
        !/[<]|&lt;/.test(line) &&
      (plainWords(line).some((word) => HEADER_WORDS.has(word.toLowerCase())) || hasPhrase(line));
      if (!previousWasRow && SEP.test(next) && !CJK.test(line) && /[A-Za-z]/.test(line) && headerLike) {
        headerCount++;
        pageHeaders++;
      }
      previousWasRow = true;
      if (SEP.test(line)) continue;
      rows++;
      if (!CJK.test(line) && prose(line) >= 2 && ENGLISH.test(line)) {
        english++;
        if (hasPhrase(line) && hasProseSignal(line)) {
          proseCount++;
          count++;
          englishRows.add(line.trim());
        }
      }
    }
    if (count) pages.push({file: path.relative(REPO, file), count});
    if (pageHeaders) headerPages.set(path.relative(REPO, file), pageHeaders);
  }
  rowsBySection.set(section.name, {
    rows,
    english,
    prose: proseCount,
    headers: headerCount,
    headerPages,
    pages: pages.length,
    englishRows,
    list: pages,
  });
  console.log(
    `${section.name}: rows=${rows} english=${english} prose=${proseCount} headers=${headerCount}` +
      ` pages=${pages.length} (${rows ? ((proseCount / rows) * 100).toFixed(1) : '0.0'}%)`,
  );
}

if (SHOW_PAGES && process.env.TABLE_HEADERS) {
  for (const [name, data] of rowsBySection) {
    if (!data.headers) continue;
    console.log(`\n${name}:`);
    for (const [file, count] of [...data.headerPages].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${count}\t${file}`);
    }
  }
}

if (SHOW_PAGES) {
  for (const [name, data] of rowsBySection) {
    if (!data.prose) continue;
    console.log(`\n${name}:`);
    for (const page of data.list.sort((a, b) => b.count - a.count).slice(0, 15)) {
      console.log(`  ${page.count}\t${page.file}`);
    }
  }
}

if (!CHECK) process.exit(0);

// Absolute gate: no English header and no English prose row in any release.
// `headers` used to be checked already; `prose` was compared to a budget that
// scaled with canonical overlap, which let hundreds of rows through.
let headersFailed = false;
let proseFailed = false;
for (const data of rowsBySection.values()) {
  if (data.headers > 0) headersFailed = true;
  if (data.prose > 0) proseFailed = true;
}
console.log(`${headersFailed ? 'FAIL' : 'ok  '} headers: english table headers must be 0`);
for (const [name, data] of rowsBySection) {
  const ok = data.prose === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: prose=${data.prose} (must be 0)`);
}
console.log(`${proseFailed ? 'FAIL' : 'ok  '} prose: english table prose rows must be 0`);
if (headersFailed || proseFailed) process.exitCode = 1;
