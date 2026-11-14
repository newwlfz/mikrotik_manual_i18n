#!/usr/bin/env node
/**
 * Translate the CLI Reference argument tables.
 *
 * The CLI pages are MDX, not pipe tables:
 *
 *   <ArgTable c1="Argument" c2="Type" c3="Description">
 *   <ArgTableRow arg="name" typ="string">Network name.</ArgTableRow>
 *   </ArgTable>
 *
 * `apply` and `derive` rebuild every page from the English source plus the
 * translation memory. A table is one block, so writing Chinese into the overlay
 * without a memory entry is worthless: the next rebuild puts the English back.
 * This tool therefore writes both:
 *
 *   1. harvest — a row that is already Chinese (the canonical 7.24 wording) is
 *      stored line by line as `english line -> chinese line`, which makes the
 *      same row free in 7.25/7.26;
 *   2. headers — `<ArgTable c1="Argument" ...>` is deterministic, from
 *      `config/cli-labels.yml`; it never goes to the model;
 *   3. identity — every structural line (`<ArgTable …>`, `</ArgTable>`, an
 *      argument without a description, a type-only row) is stored as
 *      English -> English. `lookupBlockLines` needs *every* line of the block,
 *      so one missing identity line makes the whole table fall back to English;
 *   4. translate — the remaining prose rows go to the model in batches of 8 and
 *      are accepted only when the row shape (attributes, tags, code, links,
 *      line count) is unchanged.
 *
 * Section order matters: the canonical version (7.24) is translated first, then
 * the releases that derive from it, so a row translated once is reused. The
 * default order is therefore oldest -> newest, not the Docusaurus section order.
 *
 *   node tools/translate/cli-tables.mjs --section=docs-7.24 --dry-run
 *   node tools/translate/cli-tables.mjs --section=docs-7.24 --no-api   # harvest only
 *   node tools/translate/cli-tables.mjs --section=docs-7.24 --concurrency 2
 *   node tools/translate/cli-tables.mjs                                 # all versions
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {Client, loadConfig, USAGE_FILE} from './lib/provider.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {canonicalDocLink, normalize} from './lib/blocks.mjs';
import {loadModelMemory, saveModelMemory, MODEL_MEMORY} from './lib/model-memory.mjs';
import {
  CJK,
  attrsOf,
  canonicalDefaults,
  codesOf,
  entitiesOf,
  hasProse,
  linkTargetsOf,
  parseTables,
  scanTagEnd,
  tagsOf,
} from './lib/arg-tables.mjs';

const arg = (name, fallback) => {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const DRY = has('dry-run');
const NO_API = has('no-api');
const ONLY_SECTION = arg('section', '');
const ONLY_FILE = arg('file', '');
const CONCURRENCY = Math.max(1, Number(arg('concurrency', '2')) || 1);
const BATCH = Math.max(1, Number(arg('batch', '8')) || 8);
const LIMIT = Number(arg('limit', '0')) || 0;
const MAX_CHARS = Number(arg('max-chars', '8000')) || 8000;

const LABELS_FILE = path.join(REPO, 'config/cli-labels.yml');
const labels = (() => {
  if (!fs.existsSync(LABELS_FILE)) return new Map();
  const parsed = YAML.parse(fs.readFileSync(LABELS_FILE, 'utf8')) || {};
  return new Map(Object.entries(parsed.headers || {}));
})();

/** Oldest document version first: 7.24 is canonical and feeds the rest. */
function versionOrder(section) {
  const version = /version-(\d+)\.(\d+)/.exec(section.source);
  if (version) return [Number(version[1]), Number(version[2]), 0];
  // `docs` is the current release: always the newest.
  return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1];
}

const docsSections = SECTIONS.filter((section) => section.name === 'docs' || /^docs-/.test(section.name)).sort(
  (a, b) => {
    const left = versionOrder(a);
    const right = versionOrder(b);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  },
);

const sections = ONLY_SECTION
  ? SECTIONS.filter((section) => section.name === ONLY_SECTION)
  : docsSections;
if (!sections.length) {
  console.error(`unknown section: ${ONLY_SECTION}`);
  process.exit(2);
}

const config = DRY || NO_API ? null : loadConfig();
const client = DRY || NO_API ? null : new Client(config);

const memory = loadModelMemory();
/** normalize(line) -> value, so a line translated for one section is reused in the others. */
const index = new Map();
for (const [raw, value] of memory) {
  const at = raw.indexOf('\u0000');
  if (at === -1) continue;
  const key = raw.slice(at + 1);
  const text = String(value);
  if (text.includes('\n')) continue;
  // An identity entry must never hide a real translation that another section
  // already produced.
  if (normalize(text) === key && index.has(key)) continue;
  index.set(key, text);
}

const memoryKey = (sectionName, line) => `${sectionName}\u0000${normalize(line)}`;

/**
 * Overlay links always use the canonical route (`/docs/...`). A line translated
 * for 7.25 carries `/docs/7.25/...` when the model copied the source link; when
 * the current version reuses that line the prefix would point at the archive.
 */
const stripDocVersion = (text) =>
  String(text).replace(/\/docs\/(?:7\.\d+|current)\//g, '/docs/');

function setMemory(sectionName, line, value) {
  if (line.trim() === '') return;
  const key = normalize(line);
  memory.set(memoryKey(sectionName, line), value);
  index.set(key, value);
}

function lookupLine(line) {
  const hit = index.get(normalize(line));
  if (hit === undefined) return null;
  if (String(hit).includes('\n')) return null;
  return hit;
}

/** Header value replacement; attribute names, order and spacing stay. */
function translateHeader(header) {
  return header.replace(/(\b(?:c[1-9])=")([^"]*)(")/g, (whole, open, value, close) =>
    labels.has(value) ? `${open}${labels.get(value)}${close}` : whole,
  );
}

function headerIsMapping(header) {
  const attrs = attrsOf(header);
  return ['c1', 'c2', 'c3'].some((name) => attrs[name] && labels.has(attrs[name]));
}

/** A parsed `<ArgTableRow …>text</ArgTableRow>` element. */
function parseRow(raw) {
  if (!raw.startsWith('<ArgTableRow')) return null;
  const openEnd = scanTagEnd(raw, 0);
  if (openEnd < 0) return null;
  const open = raw.slice(0, openEnd);
  if (open.endsWith('/>')) return {open, text: '', raw};
  if (!raw.endsWith('</ArgTableRow>')) return null;
  const closeStart = raw.length - '</ArgTableRow>'.length;
  if (closeStart < openEnd) return null;
  return {open, text: raw.slice(openEnd, closeStart), raw};
}

/**
 * Keep every part of the row that is not prose. The opening tag is rebuilt from
 * the English source, so `arg`/`typ`/`mandatory`/`unset`/`syscap` are byte
 * identical even if the model rewrote them.
 */
function validateText(sourceText, targetText) {
  if (targetText.includes('</ArgTableRow>') || /<ArgTableRow\b/.test(targetText)) {
    return 'row tag inside description';
  }
  const sourceLines = sourceText.split('\n');
  const targetLines = targetText.split('\n');
  if (sourceLines.length !== targetLines.length) return 'line count changed';
  for (let i = 0; i < sourceLines.length; i++) {
    if (sourceLines[i].trim() === '' && targetLines[i].trim() !== '') return 'blank line filled';
    if (sourceLines[i].trim() !== '' && targetLines[i].trim() === '') return 'line removed';
  }
  if (tagsOf(sourceText).join('\u0001') !== tagsOf(targetText).join('\u0001')) return 'HTML tags changed';
  // A Chinese sentence may move an inline value (`size`, for example
  // `file-size=1G`) to another position; the set of code spans must survive,
  // their order inside the sentence need not.
  const sorted = (items) => [...items].sort().join('\u0001');
  if (sorted(codesOf(sourceText)) !== sorted(codesOf(targetText))) return 'inline code changed';
  // The source of an archived version points at `/docs/7.25/...`; the overlay
  // uses the current `/docs/...` route, and `apply` rewrites that prefix anyway.
  const links = (text) =>
    linkTargetsOf(text).map((entry) => {
      const at = entry.indexOf('|');
      return `${entry.slice(0, at + 1)}${canonicalDocLink(entry.slice(at + 1))}`;
    });
  if (links(sourceText).join('\u0001') !== links(targetText).join('\u0001')) {
    return 'link targets changed';
  }
  if (entitiesOf(sourceText).join('\u0001') !== entitiesOf(targetText).join('\u0001')) {
    return 'HTML entities changed';
  }
  if (!CJK.test(targetText)) return 'answer is not Chinese';
  // `Default: yes.` may only change its label; the value is configuration.
  for (const match of sourceText.matchAll(/Default:\s*([^\s,.;:)]+)/g)) {
    if (!targetText.includes(match[1])) return `default value changed: ${match[1]}`;
  }
  return null;
}

const ROW_SYSTEM = `You translate the argument descriptions of the MikroTik RouterOS CLI Reference from English to Simplified Chinese.

The input is one <ArgTableRow> element per line group; an element may span several lines. Return exactly the same number of lines, in the same order, with no preface, no explanation and no code fence.

Rules, in order of importance:
1. Reproduce the <ArgTableRow ...> opening tag and the </ArgTableRow> closing tag byte for byte, including every attribute (arg, typ, mandatory, unset, deprecated, syscap), its quotes, its spacing and its line breaks. Translate only the text between the two tags.
2. Reproduce every inline code span (\`...\`), every HTML tag (<strong>, <em>, <span>, <br/>, <code>) and every Markdown link target exactly. Only prose and link text may change.
2b. Keep the Markdown links in the exact order they appear in the input: do not move a link to another position in the sentence.
3. Translate prose only: descriptions, notes, list items inside the description.
4. Never translate identifiers: CLI commands and menu paths, argument and parameter names, type names,
   enum values (yes, no, auto, none, disabled, ...), default values, numbers, RouterOS/MikroTik
   product and protocol names, anything in backticks or written in kebab-case, snake_case or camelCase.
5. \`Default:\` becomes \`默认值：\`; the value after it stays exactly as written
   (\`Default: yes.\` -> \`默认值：yes.\`).
6. Keep the exact line breaks of the element: the number of lines of the Chinese description must
   equal the number of lines of the English description. Do not add or remove blank lines.`;

/** One model round trip: input = raw rows, output = the same number of lines. */
async function translateBatch(items, strict) {
  const totalLines = items.reduce((sum, item) => sum + item.sourceLines.length, 0);
  const input = items.map((item) => item.raw).join('\n');
  const prompt = strict
    ? `${input}\n\nThe answer must contain exactly ${totalLines} lines, one per input line, including empty lines.`
    : input;
  const answer = await client.chat(prompt, {system: ROW_SYSTEM});
  const lines = answer.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length !== totalLines) {
    return {accepted: [], rejected: items.map((item) => ({item, reason: `line count ${lines.length} != ${totalLines}`}))};
  }

  const accepted = [];
  const rejected = [];
  let offset = 0;
  for (const item of items) {
    const chunk = lines.slice(offset, offset + item.sourceLines.length);
    offset += item.sourceLines.length;
    const translatedRaw = chunk.join('\n');
    const parsed = parseRow(translatedRaw);
    if (!parsed) {
      rejected.push({item, reason: 'not an <ArgTableRow> element'});
      continue;
    }
    const text = stripDocVersion(canonicalDefaults(parsed.text));
    const problem = validateText(item.sourceText, text);
    if (problem) {
      rejected.push({item, reason: problem});
      continue;
    }
    const targetRow = `${item.open}${text}</ArgTableRow>`;
    const targetLines = targetRow.split('\n');
    if (targetLines.length !== item.sourceLines.length) {
      rejected.push({item, reason: 'line count changed after rebuild'});
      continue;
    }
    accepted.push({item, targetRow, targetLines, text});
  }
  return {accepted, rejected};
}

async function translateWithRetries(items) {
  let pending = items.map((item) => ({item, reason: ''}));
  const accepted = [];
  for (let attempt = 0; attempt <= 2 && pending.length; attempt++) {
    const result = await translateBatch(
      pending.map((entry) => entry.item),
      attempt > 0,
    );
    accepted.push(...result.accepted);
    pending = result.rejected;
  }
  // A batch whose lines were reflowed cannot be sliced reliably even when the
  // total line count matches. Translate the survivors one by one: a single
  // element has no neighbour to shift into, and a lone row almost always
  // round-trips exactly.
  const stillRejected = [];
  for (const entry of pending) {
    try {
      const single = await translateBatch([entry.item], true);
      if (single.accepted.length) accepted.push(...single.accepted);
      else stillRejected.push(...single.rejected);
    } catch (error) {
      stillRejected.push({item: entry.item, reason: error.message});
    }
  }
  return {accepted, rejected: stillRejected};
}

/** Split a file's queue into model batches, bounded by rows and characters. */
function batchesOf(items) {
  const out = [];
  let current = [];
  let chars = 0;
  for (const item of items) {
    if (current.length >= BATCH || (current.length > 0 && chars + item.raw.length > MAX_CHARS)) {
      out.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += item.raw.length + 1;
  }
  if (current.length) out.push(current);
  return out;
}

const stats = new Map();
function sectionStats(name) {
  if (!stats.has(name)) {
    stats.set(name, {
      section: name,
      pages: 0,
      tables: 0,
      rows: 0,
      harvested: 0,
      headers: 0,
      fromMemory: 0,
      identity: 0,
      planned: 0,
      sent: 0,
      translated: 0,
      rejected: 0,
      skippedPages: 0,
      skippedTables: 0,
      missingOverlays: 0,
      headerUnmapped: 0,
    });
  }
  return stats.get(name);
}

const queue = [];

/**
 * A harvested row is copied byte for byte into the memory, so it must still be
 * the same element: same argument and type, same tags, code spans, link targets
 * and entities. A legacy row that lost a link is not safe to reuse.
 */
function harvestIsSafe(sourceRow, overlayRow) {
  const source = attrsOf(sourceRow.open);
  const overlay = attrsOf(overlayRow.open);
  // `typ` carries an internal newline in the English source; an older rebuild
  // collapsed it to a space. Whitespace is repaired by rebuilding the opening
  // tag from the source, so it must not throw a good Chinese row away.
  const collapse = (value) => String(value ?? '').replace(/\s+/g, '');
  if (source.arg !== overlay.arg || collapse(source.typ) !== collapse(overlay.typ)) return false;
  for (const name of ['mandatory', 'unset', 'deprecated', 'syscap']) {
    if (collapse(source[name]) !== collapse(overlay[name])) return false;
  }
  if (tagsOf(sourceRow.text).join('\u0001') !== tagsOf(overlayRow.text).join('\u0001')) return false;
  if (codesOf(sourceRow.text).join('\u0001') !== codesOf(overlayRow.text).join('\u0001')) return false;
  // The legacy capture points at `/docs/7.24/...` while the overlay already
  // uses the current `/docs/...` route; that is presentation, not content.
  const links = (text) =>
    linkTargetsOf(text).map((entry) => {
      const at = entry.indexOf('|');
      return `${entry.slice(0, at + 1)}${canonicalDocLink(entry.slice(at + 1))}`;
    });
  if (links(sourceRow.text).join('\u0001') !== links(overlayRow.text).join('\u0001')) {
    return false;
  }
  if (entitiesOf(sourceRow.text).join('\u0001') !== entitiesOf(overlayRow.text).join('\u0001')) {
    return false;
  }
  return true;
}

/** Phase 1: harvest, headers, identity and memory hits; write the table shape. */
function processPage(section, sourcePath, overlayPath) {
  const stat = sectionStats(section.name);
  const rel = relative(path.join(REPO, section.source), sourcePath);
  const sourceBody = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body;
  const sourceTables = parseTables(sourceBody);
  if (!sourceTables.length) return;

  const overlayText = fs.readFileSync(overlayPath, 'utf8');
  const overlaySplit = splitFrontMatter(overlayText);
  const overlayBody = overlaySplit.body;
  const overlayTables = parseTables(overlayBody);
  if (overlayTables.length !== sourceTables.length) {
    stat.skippedPages++;
    console.warn(`skip ${rel}: ${sourceTables.length} source tables vs ${overlayTables.length} overlay`);
    return;
  }
  stat.pages++;

  const targets = [];
  let changed = false;
  for (let t = 0; t < sourceTables.length; t++) {
    const sourceTable = sourceTables[t];
    const overlayTable = overlayTables[t];
    if (sourceTable.rows.length !== overlayTable.rows.length) {
      stat.skippedTables++;
      targets.push(null);
      console.warn(`skip ${rel} table#${t + 1}: ${sourceTable.rows.length} rows vs ${overlayTable.rows.length}`);
      continue;
    }
    stat.tables++;

    const header = translateHeader(sourceTable.header);
    if (header === sourceTable.header && headerIsMapping(sourceTable.header)) stat.headerUnmapped++;
    if (header !== overlayTable.header) changed = true;
    if (header !== sourceTable.header) stat.headers++;
    setMemory(section.name, sourceTable.header, header);

    const parts = [header];
    for (let r = 0; r < sourceTable.rows.length; r++) {
      const sourceRow = sourceTable.rows[r];
      const overlayRow = overlayTable.rows[r];
      const sourceLines = sourceRow.raw.split('\n');
      stat.rows++;

      let targetLines = null;
      let source = '';

      // 1. Harvest the canonical Chinese wording, line by line.
      if (
        CJK.test(overlayRow.text) &&
        overlayRow.text.split('\n').length === sourceRow.text.split('\n').length &&
        overlayRow.text.trim() !== sourceRow.text.trim() &&
        harvestIsSafe(sourceRow, overlayRow)
      ) {
        // Keep the Chinese text but take the element structure (and therefore
        // `arg`/`typ` byte for byte) from the English source.
        targetLines = `${sourceRow.open}${overlayRow.text}</ArgTableRow>`.split('\n');
        source = 'harvest';
      }

      // 2. Reuse a line already translated in this or another version.
      if (!targetLines) {
        const hits = sourceLines.map((line) => (line.trim() === '' ? line : lookupLine(line)));
        if (sourceLines.every((line, i) => line.trim() === '' || hits[i] !== null)) {
          targetLines = hits;
          source = 'memory';
        }
      }

      // 3. No prose: identity entries keep the table addressable as a block.
      if (!targetLines && !hasProse(sourceRow.text)) {
        targetLines = sourceLines;
        source = 'identity';
      }

      // 4. Still English prose: queue it; leave the English line in the overlay
      //    until the batch comes back (a rebuild in between is harmless because
      //    the memory will hold the result).
      if (!targetLines) {
        targetLines = sourceLines;
        source = 'queue';
        queue.push({
          section: section.name,
          rel,
          overlayPath,
          tableIndex: t,
          rowIndex: r,
          raw: sourceRow.raw,
          open: sourceRow.open,
          sourceText: sourceRow.text,
          sourceLines,
        });
        stat.planned++;
      }

      if (source === 'harvest') stat.harvested++;
      else if (source === 'memory') stat.fromMemory++;
      else if (source === 'identity') stat.identity++;

      // A queued prose line must not be stored as English -> English: that
      // identity would make `apply` believe the table is translated. Its entry
      // is written only after the model returns a Chinese line.
      if (source !== 'queue') {
        targetLines = targetLines.map(stripDocVersion);
        for (let i = 0; i < sourceLines.length; i++) {
          if (sourceLines[i].trim() === '') continue;
          setMemory(section.name, sourceLines[i], targetLines[i]);
        }
      }
      const targetRow = targetLines.join('\n');
      if (targetRow !== overlayRow.raw) changed = true;
      parts.push(targetRow);
    }
    parts.push('</ArgTable>');
    setMemory(section.name, '</ArgTable>', '</ArgTable>');
    targets.push(parts.join('\n'));
  }

  if (!changed) return;
  let body = overlayBody;
  for (let t = targets.length - 1; t >= 0; t--) {
    const target = targets[t];
    if (target === null) continue;
    body = body.slice(0, overlayTables[t].start) + target + body.slice(overlayTables[t].end);
  }
  if (DRY) return;
  const prefix = overlayText.slice(0, overlayText.length - overlayBody.length);
  fs.writeFileSync(overlayPath, `${prefix}${body}`);
}

/** Phase 2: write one accepted row back into its overlay. */
function writeRow(item, targetRow) {
  const stat = sectionStats(item.section);
  const text = fs.readFileSync(item.overlayPath, 'utf8');
  const split = splitFrontMatter(text);
  const tables = parseTables(split.body);
  const table = tables[item.tableIndex];
  const row = table?.rows[item.rowIndex];
  if (!row) {
    stat.rejected++;
    console.warn(`lost row ${item.rel} table#${item.tableIndex + 1} row#${item.rowIndex + 1}`);
    return false;
  }
  const body = `${split.body.slice(0, row.start)}${targetRow}${split.body.slice(row.end)}`;
  fs.writeFileSync(item.overlayPath, `${text.slice(0, text.length - split.body.length)}${body}`);
  return true;
}

// Phase 1 — every section, oldest first.
for (const section of sections) {
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(sourceBase)) continue;
  const stat = sectionStats(section.name);
  const files = walkMarkdown(sourceBase).filter((file) => {
    const rel = relative(sourceBase, file);
    return !ONLY_FILE || rel.includes(ONLY_FILE);
  });
  for (const sourcePath of files) {
    const rel = relative(sourceBase, sourcePath);
    const overlayPath = path.join(overlayBase, rel);
    if (!fs.existsSync(overlayPath)) {
      // `processPage` would crash on a missing overlay; count it so the
      // verification threshold shows a page that no other pass translated.
      if (parseTables(splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body).length) {
        stat.missingOverlays++;
      }
      continue;
    }
    processPage(section, sourcePath, overlayPath);
  }
  if (!DRY) saveModelMemory(memory);
}

const planned = LIMIT ? queue.slice(0, LIMIT) : queue;

if (DRY || NO_API) {
  if (!DRY) saveModelMemory(memory);
  for (const data of stats.values()) {
    console.log(
      `${data.section}: pages=${data.pages} tables=${data.tables} rows=${data.rows} ` +
        `headers=${data.headers} harvested=${data.harvested} memory=${data.fromMemory} ` +
        `identity=${data.identity} toTranslate=${data.planned} ` +
        `skippedPages=${data.skippedPages} skippedTables=${data.skippedTables} missingOverlays=${data.missingOverlays}`,
    );
  }
  console.log(
    JSON.stringify({
      mode: DRY ? 'dry-run' : 'no-api',
      sections: Object.fromEntries(stats),
      toTranslate: queue.length,
      memory: MODEL_MEMORY,
    }),
  );
  process.exit(0);
}

// Phase 2 — model batches, grouped by file so one worker owns one overlay.
const byFile = new Map();
for (const item of planned) {
  if (!byFile.has(item.overlayPath)) byFile.set(item.overlayPath, []);
  byFile.get(item.overlayPath).push(item);
}

const work = [...byFile.values()];
let cursor = 0;

async function worker() {
  for (;;) {
    const index = cursor++;
    if (index >= work.length) return;
    const items = work[index];
    for (const batch of batchesOf(items)) {
      const stat = sectionStats(batch[0].section);
      let result;
      try {
        stat.sent += batch.length;
        result = await translateWithRetries(batch);
      } catch (error) {
        stat.rejected += batch.length;
        console.log(`FAILED ${batch[0].rel}: ${error.message}`);
        saveModelMemory(memory);
        continue;
      }
      for (const {item, targetRow, targetLines} of result.accepted) {
        if (!writeRow(item, targetRow)) continue;
        for (let i = 0; i < item.sourceLines.length; i++) {
          if (item.sourceLines[i].trim() === '') continue;
          setMemory(item.section, item.sourceLines[i], targetLines[i]);
        }
        stat.translated++;
      }
      for (const {item, reason} of result.rejected) {
        stat.rejected++;
        if (stat.rejected <= 20) {
          console.log(`REJECTED ${item.rel} (table#${item.tableIndex + 1}): ${reason} — ${item.raw.slice(0, 90)}`);
        }
      }
      saveModelMemory(memory);
    }
  }
}

saveModelMemory(memory);
await Promise.all(Array.from({length: Math.min(CONCURRENCY, Math.max(1, work.length))}, () => worker()));
if (client) client.log(USAGE_FILE);
saveModelMemory(memory);

for (const data of stats.values()) {
  console.log(
    `${data.section}: pages=${data.pages} tables=${data.tables} rows=${data.rows} ` +
      `headers=${data.headers} harvested=${data.harvested} memory=${data.fromMemory} ` +
      `identity=${data.identity} sent=${data.sent} translated=${data.translated} ` +
      `rejected=${data.rejected} skippedPages=${data.skippedPages} skippedTables=${data.skippedTables} ` +
      `missingOverlays=${data.missingOverlays}`,
  );
}
console.log(
  JSON.stringify({
    sections: Object.fromEntries(stats),
    toTranslate: queue.length,
    planned: planned.length,
    tokens_prompt: client?.usage.prompt || 0,
    tokens_completion: client?.usage.completion || 0,
    calls: client?.usage.calls || 0,
    memory: MODEL_MEMORY,
  }),
);
