#!/usr/bin/env node
/**
 * Translate table rows and, more importantly, record them in the block memory.
 *
 * A table is one block for `apply`/`derive`, so it is only rebuilt when *every*
 * line of it has a translation-memory entry (`lookupBlockLines`). Writing the
 * overlay alone is therefore worthless: the next `apply` regenerates the page
 * from the English source plus the memory and the rows fall back to English.
 *
 * This tool therefore does three things per row:
 *
 *   1. harvest — a row that is already Chinese (canonical 7.24) is stored as
 *      `english line -> chinese line`, which makes the same row free in 7.25/7.26;
 *   2. deterministic — `Default:` becomes `默认值：` outside inline code, exactly
 *      like the canonical wording, with no model call;
 *   3. translate — the remaining prose rows go to the model in small batches and
 *      are accepted only if the table shape is unchanged.
 *
 * Every line of a table (header, separator, identifier-only row, empty cells)
 * gets an entry, identity included: one missing line makes the whole table fall
 * back to English.
 *
 *   node tools/translate/tables.mjs --section=docs-7.24 --dry-run
 *   node tools/translate/tables.mjs --section=docs-7.24 --no-api   # harvest only
 *   node tools/translate/tables.mjs --section=docs-7.24 --concurrency 2
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, REPO, WORK_DIR, walkMarkdown, relative} from './lib/paths.mjs';
import {Client, loadConfig, USAGE_FILE} from './lib/provider.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {fenceMask, normalize} from './lib/blocks.mjs';
import {loadModelMemory, saveModelMemory, MODEL_MEMORY} from './lib/model-memory.mjs';

const arg = (name, fallback) => {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline ? inline.split('=').slice(1).join('=') : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const sectionName = arg('section', 'docs');
const section = SECTIONS.find((entry) => entry.name === sectionName);
if (!section) {
  console.error(`unknown section: ${sectionName}`);
  process.exit(2);
}

const DRY = has('dry-run');
const NO_API = has('no-api');
const ONLY = arg('file', '');
const CONCURRENCY = Number(arg('concurrency', '2'));
const BATCH = Number(arg('batch', '8'));
const LIMIT = Number(arg('limit', '0'));
const TABLE_MEMORY = path.join(WORK_DIR, 'table-memory.json');

const CJK = /[\u4e00-\u9fff]/;

/** Header words; a table whose first row is data must not be queued. */
const HEADER_WORDS = new Set(
  `property description name parameter value type default comment option attribute field setting command example meaning format unit range address port protocol status level action result note timeout interface path package menu keyword argument return syntax parameter`.split(/\s+/),
);
const SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/;

/** Canonical header wording; these rows are pure structure, not prose. */
const HEADERS = new Map([
  ['| Property | Description |', '| 属性 | 说明 |'],
  ['| Name | Description |', '| 名称 | 说明 |'],
  ['| Parameter | Description |', '| 参数 | 说明 |'],
  ['| Attribute | Description |', '| 属性 | 说明 |'],
  ['| Option | Description |', '| 选项 | 说明 |'],
]);

const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/);
const pipesOf = (line) => (String(line).match(/(?<!\\)\|/g) || []).length;
const brNormal = (line) => String(line).replace(/<br\s*\/?>/gi, '<br/>');
const tagsOf = (line) => (brNormal(line).match(/<\/?[A-Za-z][^>]*>/g) || []).map((tag) => tag.trim()).sort();
const codesOf = (line) => (String(line).match(/`[^`]*`/g) || []).map((code) => code.trim()).sort();
const htmlCodesOf = (line) => (String(line).match(/<code>[\s\S]*?<\/code>/gi) || []).map((code) => code).sort();
const listItemsOf = (line) => (String(line).match(/<li\b/gi) || []).length;
const entitiesOf = (line) =>
  (String(line).match(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi) || []).map((entity) => entity.toLowerCase()).sort();
const urlsOf = (line) => (String(line).match(/\]\(([^)]+)\)/g) || []).map((link) => link.slice(2)).sort();

const plainWords = (text) =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ')
    .split(/[|\s]+/)
    .map((word) => word.replace(/^[*_#]+|[*_#]+$/g, ''))
    .filter((word) => /^[A-Za-z]{3,}$/.test(word));

/** Brand/product rows (`DigiCert Inc | DigiCert Root CA`) are identifiers. */
const hasLowerWord = (line) => plainWords(line).some((word) => /^[a-z]{3,}$/.test(word));

/** A cell that holds a phrase, not a single identifier or value. */
const hasPhrase = (line) =>
  line
    .replace(/^\s*\||\|\s*$/g, '')
    .split(/(?<!\\)\|/)
    .some((cell) => plainWords(cell).length >= 2);

/**
 * Data rows (`| 2.4ghz-onlyg | 6 | 0-7 |`) are not English prose and must never
 * be sent to the model; only a cell with a real phrase is translated.
 */
function isEnglishRow(line, header) {
  if (SEPARATOR.test(line)) return false;
  if (CJK.test(line)) return false;
  if (pipesOf(line) < 2) return false;
  // A header row is a phrase per cell (`| Property | Description |`), so the
  // "two words in one cell" rule would skip it forever. Every header that
  // carries Latin letters is translatable.
  if (header) {
    return plainWords(line).some((word) => HEADER_WORDS.has(word.toLowerCase())) || hasPhrase(line);
  }
  if (!hasPhrase(line)) return false;
  if (!hasLowerWord(line)) return false;
  return plainWords(line).length >= 2;
}

/** `Default:` -> `默认值：`, outside inline code. */
function deterministicRow(line) {
  const target = HEADERS.get(line.trim());
  if (target) return target;
  let out = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '`') {
      inCode = !inCode;
      out += char;
      continue;
    }
    if (!inCode && line.startsWith('Default:', i)) {
      out += '默认值：';
      i += 'Default:'.length - 1;
      continue;
    }
    if (!inCode && line.startsWith('Default', i) && !/[A-Za-z]/.test(line[i + 'Default'.length] || '')) {
      out += '默认值';
      i += 'Default'.length - 1;
      continue;
    }
    out += char;
  }
  return out;
}

/** Column count, HTML, code, entities, list items and link targets. */
function validRow(source, target) {
  if (pipesOf(source) !== pipesOf(target)) return 'cell count changed';
  if (tagsOf(source).join('|') !== tagsOf(target).join('|')) return 'HTML tags changed';
  if (codesOf(source).join('|') !== codesOf(target).join('|')) return 'inline code changed';
  if (htmlCodesOf(source).join('|') !== htmlCodesOf(target).join('|')) return 'HTML code changed';
  if (listItemsOf(source) !== listItemsOf(target)) return 'list item count changed';
  if (entitiesOf(source).join('|') !== entitiesOf(target).join('|')) return 'HTML entities changed';
  if (urlsOf(source).join('|') !== urlsOf(target).join('|')) return 'link targets changed';
  if (target.trim() === source.trim()) return null;
  if (!CJK.test(target)) return 'answer is not Chinese';
  return null;
}

/** Consecutive `|` lines outside fenced code, per page. */
function tablesOf(body) {
  const lines = body.split('\n');
  const mask = fenceMask(body);
  const out = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    if (!mask[i] && /^\s*\|/.test(lines[i])) {
      if (!current) {
        current = {start: i, lines: []};
        out.push(current);
      }
      current.lines.push(i);
    } else {
      current = null;
    }
  }
  return {lines, tables: out};
}

const config = loadConfig();
const client = DRY || NO_API ? null : new Client(config);
const model = loadModelMemory();
const tableCache = fs.existsSync(TABLE_MEMORY)
  ? JSON.parse(fs.readFileSync(TABLE_MEMORY, 'utf8')).rows || {}
  : {};

const memoryKey = (english) => `${section.name}\u0000${normalize(english)}`;

/** Cross-version lookup: the same English line may already live in any section. */
function cachedTranslation(english) {
  const key = normalize(english);
  const hit = model.get(memoryKey(english));
  if (hit !== undefined) return hit;
  for (const [raw, value] of model) {
    const at = raw.indexOf('\u0000');
    if (at === -1) continue;
    if (raw.slice(at + 1) === key) return value;
  }
  if (tableCache[english.trim()]) return tableCache[english.trim()];
  return null;
}

const files = walkMarkdown(path.join(REPO, section.overlay)).filter((file) => {
  const rel = relative(path.join(REPO, section.overlay), file);
  return !ONLY || rel.includes(ONLY);
});

const stats = {
  pages: 0,
  tables: 0,
  rows: 0,
  harvested: 0,
  deterministic: 0,
  fromMemory: 0,
  sent: 0,
  translated: 0,
  identity: 0,
  rejected: 0,
  skippedPages: 0,
};

const queue = [];
let planned = 0;

for (const file of files) {
  const rel = relative(path.join(REPO, section.overlay), file);
  const overlayText = fs.readFileSync(file, 'utf8');
  const sourceText = fs.readFileSync(path.join(REPO, section.source, rel), 'utf8');
  const overlayBody = splitFrontMatter(overlayText).body;
  const overlay = tablesOf(overlayBody);
  const source = tablesOf(splitFrontMatter(sourceText).body);
  if (overlay.tables.length !== source.tables.length) {
    stats.skippedPages++;
    console.warn(`skip ${rel}: ${source.tables.length} source table(s) vs ${overlay.tables.length} overlay`);
    continue;
  }
  if (!source.tables.length) continue;
  stats.pages++;

  const replacements = new Map();
  for (let t = 0; t < source.tables.length; t++) {
    const src = source.tables[t];
    const ovl = overlay.tables[t];
    if (src.lines.length !== ovl.lines.length) {
      stats.skippedPages++;
      console.warn(`skip ${rel} table#${t + 1}: ${src.lines.length} rows vs ${ovl.lines.length}`);
      continue;
    }
    stats.tables++;
    for (let i = 0; i < src.lines.length; i++) {
      const english = source.lines[src.lines[i]];
      const current = overlay.lines[ovl.lines[i]];
      const lineIndex = ovl.lines[i];
      // `i === 0` alone is not enough: a table whose first row is data must not
      // be sent merely because it comes first. A header is followed by the
      // separator row.
      const isHeader =
        i === 0 && src.lines.length > 1 && SEPARATOR.test(source.lines[src.lines[1]]);
      const proseRow = isEnglishRow(english, isHeader);
      stats.rows++;

      if (SEPARATOR.test(english)) {
        model.set(memoryKey(english), english);
        stats.identity++;
        continue;
      }
      if (CJK.test(current) && current.trim() !== english.trim()) {
        // Harvest the canonical wording; it is what makes 7.25/7.26 free.
        model.set(memoryKey(english), current);
        stats.harvested++;
        continue;
      }
      const cached = cachedTranslation(english);
      // An identity entry is only valid for a row that has no prose: storing
      // "English -> English" for a description would make `apply` believe the
      // table is translated and rebuild it in English.
      if (cached !== null && (CJK.test(cached) || !proseRow)) {
        stats.fromMemory++;
        if (cached !== current) replacements.set(lineIndex, cached);
        model.set(memoryKey(english), cached);
        if (cached.trim() === english.trim()) stats.identity++;
        continue;
      }
      const guessed = deterministicRow(english);
      if (guessed.trim() !== english.trim() && CJK.test(guessed) && !validRow(english, guessed)) {
        stats.deterministic++;
        replacements.set(lineIndex, guessed);
        model.set(memoryKey(english), guessed);
        continue;
      }
      if (proseRow) {
        queue.push({file, rel, lineIndex, english, table: `${t + 1}`});
        planned++;
      } else {
        model.set(memoryKey(english), english);
        stats.identity++;
      }
    }
  }
  if (replacements.size && !DRY) {
    // Indices are body-relative; keep the front matter byte for byte.
    const lines = overlayBody.split('\n');
    for (const [lineIndex, value] of replacements) lines[lineIndex] = value;
    const prefix = overlayText.slice(0, overlayText.length - overlayBody.length);
    fs.writeFileSync(file, `${prefix}${lines.join('\n')}`);
  }
}

if (DRY) {
  console.log(
    `${sectionName}: pages=${stats.pages} tables=${stats.tables} rows=${stats.rows} ` +
      `harvested=${stats.harvested} deterministic=${stats.deterministic} ` +
      `fromMemory=${stats.fromMemory} toTranslate=${planned} skippedPages=${stats.skippedPages}`,
  );
  process.exit(0);
}

const queueLimit = LIMIT ? queue.slice(0, LIMIT) : queue;
const byFile = new Map();
for (const item of queueLimit) {
  if (!byFile.has(item.file)) byFile.set(item.file, []);
  byFile.get(item.file).push(item);
}

const ROW_SYSTEM = `You translate the table rows of the MikroTik RouterOS documentation from English to Simplified Chinese.

The input is one table row per line, each starting and ending with a pipe character.
Return exactly the same number of lines, in the same order, with no preface, no explanation and no code fence.

Rules, in order of importance:
1. Keep the number of cells and every unescaped | separator exactly as they are. An escaped pipe is part of a cell's text.
2. Reproduce every HTML tag and attribute character for character, including <br/>, <ul>, <li>, <span> and <code>.
3. Reproduce every inline code span (\`...\`), every <code>...</code> block and every link target exactly; only prose is translated.
4. Translate prose only: descriptions, notes, headings inside a cell.
5. Never translate identifiers: CLI commands, menu and parameter names, enum values, flags, numbers,
   RouterOS and MikroTik, anything in backticks or written in kebab-case, snake_case or camelCase.
6. An empty cell stays empty.`;

async function translateBatch(items) {
  const input = items.map((item) => item.english.trim()).join('\n');
  let answer = await client.chat(input, {system: ROW_SYSTEM});
  let lines = answer.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('|'));
  if (lines.length !== items.length) {
    answer = await client.chat(`${input}\n\nReturn exactly ${items.length} lines, one per input row.`, {
      system: ROW_SYSTEM,
    });
    lines = answer.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('|'));
  }
  const accepted = [];
  const rejected = [];
  for (let i = 0; i < items.length; i++) {
    const target = lines[i];
    if (!target) {
      rejected.push({item: items[i], reason: 'missing line'});
      continue;
    }
    const problem = validRow(items[i].english, target);
    if (problem) rejected.push({item: items[i], reason: problem});
    else accepted.push({item: items[i], target});
  }
  return {accepted, rejected};
}

const work = [...byFile.entries()];
let cursor = 0;
async function worker() {
  for (;;) {
    const index = cursor++;
    if (index >= work.length) return;
    const [file, items] = work[index];
    for (let start = 0; start < items.length; start += BATCH) {
      const batch = items.slice(start, start + BATCH);
      try {
        stats.sent += batch.length;
        const {accepted, rejected} = await translateBatch(batch);
        for (const {item, target} of accepted) {
          model.set(memoryKey(item.english), target);
          tableCache[item.english.trim()] = target;
          stats.translated++;
          const text = fs.readFileSync(file, 'utf8');
          const body = splitFrontMatter(text).body;
          const lines = body.split('\n');
          lines[item.lineIndex] = target;
          fs.writeFileSync(file, `${text.slice(0, text.length - body.length)}${lines.join('\n')}`);
        }
        for (const {item, reason} of rejected) {
          stats.rejected++;
          if (stats.rejected <= 20) {
            console.log(
              `REJECTED ${relative(REPO, file)} (${item.table}): ${reason} — ${item.english.slice(0, 90)}`,
            );
          }
        }
      } catch (error) {
        stats.rejected += batch.length;
        console.log(`FAILED ${relative(REPO, file)}: ${error.message}`);
      }
      saveModelMemory(model);
      fs.writeFileSync(TABLE_MEMORY, `${JSON.stringify({schema: 1, rows: tableCache}, null, 1)}\n`);
    }
  }
}

saveModelMemory(model);
if (client) {
  await Promise.all(Array.from({length: Math.max(1, CONCURRENCY)}, () => worker()));
  client.log(USAGE_FILE);
}
fs.writeFileSync(TABLE_MEMORY, `${JSON.stringify({schema: 1, rows: tableCache}, null, 1)}\n`);

console.log(
  JSON.stringify({
    section: sectionName,
    ...stats,
    tokens_prompt: client?.usage.prompt || 0,
    tokens_completion: client?.usage.completion || 0,
    model_memory: MODEL_MEMORY,
  }),
);
