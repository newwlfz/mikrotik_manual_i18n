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
 * back to English. Every translated row is written to both translation memories
 * (`model-memory` and `table-memory`) so `apply`/`derive` rebuild it
 * deterministically on the next run.
 *
 * Non-language spans are hidden behind numbered tokens before the model call:
 * inline code, `<code>` blocks, HTML tags, link targets and entities are sent
 * as `⟦0⟧`-style placeholders, so an HTML-dense description cannot come back
 * with a rewritten tag or code span. The answer is validated as a *multiset* of
 * protected spans, then the tokens are restored byte for byte.
 *
 * Section and locale are pipeline-driven: `--section` restricts the run, no
 * section means every docs release (oldest first, 7.24 feeds the others), and
 * `--locale` identifies this repository's single target locale.
 *
 *   node tools/translate/tables.mjs --section=docs-7.24 --dry-run
 *   node tools/translate/tables.mjs --section=docs-7.24 --no-api   # harvest only
 *   node tools/translate/tables.mjs --section=docs-7.24 --concurrency 2
 *   node tools/translate/tables.mjs                                 # all releases
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, REPO, WORK_DIR, DEFAULT_TARGET_LOCALE, walkMarkdown, relative} from './lib/paths.mjs';
import {Client, loadConfig, USAGE_FILE} from './lib/provider.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {fenceMask, normalize} from './lib/blocks.mjs';
import {loadModelMemory, saveModelMemory, MODEL_MEMORY} from './lib/model-memory.mjs';

const arg = (name, fallback) => {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline ? inline.split('=').slice(1).join('=') : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const ONLY_SECTION = arg('section', '');
// The pipeline forwards both --section and --locale. A locale repository has a
// single target locale, so the value identifies the overlay/TM being written;
// it never silently switches the glyphs of another locale's table.
const LOCALE = arg('locale', DEFAULT_TARGET_LOCALE);
const ONLY = arg('file', '');
const DRY = has('dry-run');
// `translate:apply/derive` are pure-local rebuilds and set I18N_OFFLINE=1;
// CI's translate:batch path keeps full provider access.
const NO_API = has('no-api') || process.env.I18N_OFFLINE === '1';
const CONCURRENCY = Math.max(1, Number(arg('concurrency', '2')) || 1);
const BATCH = Math.max(1, Number(arg('batch', '8')) || 8);
const LIMIT = Number(arg('limit', '0')) || 0;
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

/**
 * Hide every non-language span behind a numbered token before the model call.
 * Code blocks and inline code are hidden whole (including their content), link
 * labels stay translatable while only their targets are hidden, and HTML tags
 * and entities are hidden as-is. `restoreRow` puts the exact bytes back.
 */
const TOKEN_OPEN = '\u27e6'; // ⟦
const TOKEN_CLOSE = '\u27e7'; // ⟧
const TOKEN_RE = /\u27e6(\d+)\u27e7/g;

function protectRow(line) {
  const saved = [];
  const stash = (value) => {
    const index = saved.length;
    saved.push(value);
    return `${TOKEN_OPEN}${index}${TOKEN_CLOSE}`;
  };
  let out = String(line);
  // Whole code blocks first: the tag pass below must never see markup that is
  // part of a code sample.
  out = out.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, (whole) => stash(whole));
  out = out.replace(/`[^`]*`/g, (whole) => stash(whole));
  out = out.replace(/(\]\()([^)]+)(\))/g, (_whole, open, target, close) => `${open}${stash(target)}${close}`);
  out = out.replace(/<\/?[A-Za-z][^>]*>/g, (whole) => stash(whole));
  out = out.replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole) => stash(whole));
  return {masked: out, saved};
}

function restoreRow(line, saved) {
  return String(line).replace(TOKEN_RE, (whole, digits) => {
    const value = saved[Number(digits)];
    return value === undefined ? whole : value;
  });
}

/** Sorted occurrences form a multiset: a missing or duplicated token is visible. */
const tokensOf = (line) => (String(line).match(TOKEN_RE) || []).sort();
const sameMultiset = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * Structural check of a rebuilt row. The model only sees the natural language
 * (protected spans travel as tokens), so the check compares *multisets* of tags,
 * code, links, entities and tokens rather than demanding a byte-for-byte copy
 * of the whole row. A protected span may move between cells, but none may be
 * added, dropped or rewritten. When `saved` is given, `source` and `target` are
 * the masked rows and the token multiset is the decisive invariant.
 */
function validRow(source, target, saved = null) {
  if (pipesOf(source) !== pipesOf(target)) return 'cell count changed';
  if (!sameMultiset(tagsOf(source), tagsOf(target))) return 'HTML tags changed';
  if (!sameMultiset(codesOf(source), codesOf(target))) return 'inline code changed';
  if (!sameMultiset(htmlCodesOf(source), htmlCodesOf(target))) return 'HTML code changed';
  if (listItemsOf(source) !== listItemsOf(target)) return 'list item count changed';
  if (!sameMultiset(entitiesOf(source), entitiesOf(target))) return 'HTML entities changed';
  if (!sameMultiset(urlsOf(source), urlsOf(target))) return 'link targets changed';
  if (saved && !sameMultiset(tokensOf(source), tokensOf(target))) return 'protected span changed';
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

// The provider is only loaded when a row actually has to be translated: an
// offline apply/derive rebuild has no LLM configuration and must still run.
let client = null;
function getClient() {
  if (!client) client = new Client(loadConfig());
  return client;
}
const model = loadModelMemory();
const tableCache = fs.existsSync(TABLE_MEMORY)
  ? JSON.parse(fs.readFileSync(TABLE_MEMORY, 'utf8')).rows || {}
  : {};

const memoryKey = (section, english) => `${section.name}\u0000${normalize(english)}`;

/** Cross-version lookup: the same English line may already live in any section. */
function cachedTranslation(section, english) {
  const key = normalize(english);
  const hit = model.get(memoryKey(section, english));
  if (hit !== undefined) return hit;
  for (const [raw, value] of model) {
    const at = raw.indexOf('\u0000');
    if (at === -1) continue;
    if (raw.slice(at + 1) === key) return value;
  }
  if (tableCache[english.trim()]) return tableCache[english.trim()];
  return null;
}

/** Oldest document release first: 7.24 is canonical and feeds the rest. */
function versionOrder(section) {
  const match = /version-(\d+)\.(\d+)/.exec(section.source);
  if (match) return [Number(match[1]), Number(match[2]), 0];
  return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1];
}
const docsSections = SECTIONS.filter((section) => /^docs/.test(section.name)).sort((a, b) => {
  const left = versionOrder(a);
  const right = versionOrder(b);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
});
const sections = ONLY_SECTION
  ? SECTIONS.filter((section) => section.name === ONLY_SECTION)
  : docsSections;
if (!sections.length) {
  console.error(`unknown section: ${ONLY_SECTION}`);
  process.exit(2);
}

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

for (const section of sections) {
  const files = walkMarkdown(path.join(REPO, section.overlay)).filter((file) => {
    const rel = relative(path.join(REPO, section.overlay), file);
    return !ONLY || rel.includes(ONLY);
  });

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
          model.set(memoryKey(section, english), english);
          stats.identity++;
          continue;
        }
        if (CJK.test(current) && current.trim() !== english.trim()) {
          // Harvest the canonical wording; it is what makes 7.25/7.26 free.
          model.set(memoryKey(section, english), current);
          stats.harvested++;
          continue;
        }
        const cached = cachedTranslation(section, english);
        // An identity entry is only valid for a row that has no prose: storing
        // "English -> English" for a description would make `apply` believe the
        // table is translated and rebuild it in English.
        if (cached !== null && (CJK.test(cached) || !proseRow)) {
          stats.fromMemory++;
          if (cached !== current) replacements.set(lineIndex, cached);
          model.set(memoryKey(section, english), cached);
          if (cached.trim() === english.trim()) stats.identity++;
          continue;
        }
        const guessed = deterministicRow(english);
        if (guessed.trim() !== english.trim() && CJK.test(guessed) && !validRow(english, guessed)) {
          stats.deterministic++;
          replacements.set(lineIndex, guessed);
          model.set(memoryKey(section, english), guessed);
          continue;
        }
        if (proseRow) {
          const {masked, saved} = protectRow(english);
          queue.push({file, rel, lineIndex, english, masked, saved, table: `${t + 1}`, section: section.name});
          planned++;
        } else {
          model.set(memoryKey(section, english), english);
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
}

if (DRY) {
  console.log(
    `sections=${sections.map((entry) => entry.name).join(',')} locale=${LOCALE}: ` +
      `pages=${stats.pages} tables=${stats.tables} rows=${stats.rows} ` +
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

// The target language, style and terminology are not repeated here: they come
// from the locale profile and the relevant glossary terms in `client.system()`.
// Only the table shape is local to this tool.
const ROW_RULES = `Table rows of the MikroTik RouterOS documentation.

The input is one table row per line, each starting and ending with a pipe character.
Code spans, HTML tags, link targets and entities have been replaced by numbered
tokens such as ⟦0⟧ and ⟦1⟧; only the words between them are natural language.

Return exactly the same number of lines, in the same order, with no preface, no explanation and no code fence.

Rules, in order of importance:
1. Keep the number of cells and every unescaped | separator exactly as they are. An escaped pipe is part of a cell's text.
2. Reproduce every ⟦n⟧ token verbatim, in the same row and in the same order. A token stands for code, a tag, a URL or an entity - never prose. Never translate, expand, drop or reorder it.
3. Translate prose only: descriptions, notes, headings inside a cell.
4. Never translate identifiers: CLI commands, menu and parameter names, enum values, flags, numbers,
   RouterOS and MikroTik, anything hidden behind a token, or words written in kebab-case, snake_case or camelCase.
5. An empty cell stays empty.`;

async function translateBatch(items) {
  const input = items.map((item) => item.masked.trim()).join('\n');
  const c = getClient();
  const system = `${c.system(input)}\n\n${ROW_RULES}`;
  let answer = await c.chat(input, {system});
  let lines = answer.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('|'));
  if (lines.length !== items.length) {
    answer = await c.chat(`${input}\n\nReturn exactly ${items.length} lines, one per input row.`, {
      system,
    });
    lines = answer.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('|'));
  }
  const accepted = [];
  const rejected = [];
  for (let i = 0; i < items.length; i++) {
    const maskedTarget = lines[i];
    if (!maskedTarget) {
      rejected.push({item: items[i], reason: 'missing line'});
      continue;
    }
    // The masked answer must keep every protected span; only then is it safe to
    // restore the exact bytes and check the rebuilt row once more.
    const problem = validRow(items[i].masked, maskedTarget, items[i].saved);
    if (problem) {
      rejected.push({item: items[i], reason: problem});
      continue;
    }
    const target = restoreRow(maskedTarget, items[i].saved);
    const rebuiltProblem = validRow(items[i].english, target);
    if (rebuiltProblem) {
      rejected.push({item: items[i], reason: rebuiltProblem});
      continue;
    }
    accepted.push({item: items[i], target});
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
          // One TM entry per translated row, keyed by its section and its
          // normalized English line: apply/derive rebuild it deterministically.
          model.set(memoryKey(sections.find((entry) => entry.name === item.section) || sections[0], item.english), target);
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
              `REJECTED ${relative(REPO, file)} (${item.section}/${item.table}): ${reason} — ${item.english.slice(0, 90)}`,
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
if (!DRY && !NO_API) {
  await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
  client.log(USAGE_FILE);
}
fs.writeFileSync(TABLE_MEMORY, `${JSON.stringify({schema: 1, rows: tableCache}, null, 1)}\n`);

console.log(
  JSON.stringify({
    sections: sections.map((entry) => entry.name),
    locale: LOCALE,
    ...stats,
    tokens_prompt: client?.usage.prompt || 0,
    tokens_completion: client?.usage.completion || 0,
    model_memory: MODEL_MEMORY,
  }),
);
