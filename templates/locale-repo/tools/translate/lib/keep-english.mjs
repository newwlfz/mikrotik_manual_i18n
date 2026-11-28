/**
 * Units the model returns unchanged, remembered outside the translation memory.
 *
 * `work/translate/model-memory.json` is ~26 MB and `translation-memory.json`
 * another ~19 MB. Committing them on every batch would grow the repository by
 * tens of megabytes per push, so the batch workflow commits only this compact
 * ledger: the *identity* subset — units whose "translation" is the English text
 * itself, because they are technical notation (identifier lists, grammar
 * fragments, numeric tables, product names) that must stay English.
 *
 * Two kinds of unit are locked here:
 *
 *   blocks  body blocks the model returned unchanged *and* that carry no
 *           translatable prose (commands, paths, parameters, links, symbols);
 *   titles  page titles that are a proper noun (`MACsec`, `VLAN`, `SXT-2`), so
 *           the model answers with the title it was given. A title that still
 *           contains an English sentence is not locked: it stays pending until
 *           it is translated, and the batch retries it once. A sidebar label is
 *           the same kind of unit and gets its own list, because a proper-noun
 *           *title* does not imply the label is English too (`Profiler` stays a
 *           title, `分析器` is its label).
 *
 * Why it has to be persisted at all: without it every batch re-sends those
 * units, the model answers with the same English text, the page stays
 * `partial`, and `pending` never reaches zero — so the deploy gate would never
 * open. `planSection` skips a block or a title that is locked here exactly the
 * way it skipped identity entries from the TM; `config/force-translate.yml` and
 * the fenced-admonition exception still override a block lock.
 *
 * Block keys are `normalize()`d (see `lib/blocks.mjs`), so whitespace
 * differences do not create new entries. The file is sorted, which keeps a diff
 * readable and lets two runs merge without reordering.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  WORK_DIR,
  glossaryFile,
  writeFileAtomic,
} from './paths.mjs';
import {normalize} from './blocks.mjs';

export const LOCKS_FILE = path.join(WORK_DIR, 'keep-english.json');
export const LOCKS_SCHEMA = 3;
/** Recorded reason for a title the model answered with the English title. */
export const TITLE_LOCK_REASON = 'model-kept-proper-noun';

/** Empty ledger shape. */
function emptyLocks() {
  return {blocks: new Set(), titles: new Set(), labels: new Set()};
}

/**
 * Read the locks; seed them from the model memory when the ledger is new.
 *
 * Seeding only happens where a full translation memory exists (the local
 * mono-workspace), and it is a one-time migration: the file written here is what
 * CI commits, so a fresh checkout never has to load the big memories to know
 * which blocks are deliberately English.
 */
export function loadLocks({seedFrom = null, warn = () => {}} = {}) {
  if (fs.existsSync(LOCKS_FILE)) {
    const raw = JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf8'));
    // Schema 1 was a plain array of blocks (and a schema-1 object with `blocks`).
    const blocks = Array.isArray(raw) ? raw : raw.blocks || [];
    const titles = Array.isArray(raw) ? [] : raw.titles || [];
    const labels = Array.isArray(raw) ? [] : raw.labels || [];
    const locks = emptyLocks();
    for (const block of blocks) {
      if (typeof block === 'string' && block.trim() !== '') locks.blocks.add(normalize(block));
    }
    const read = (list, target) => {
      for (const entry of list) {
        const text = typeof entry === 'string' ? entry : entry?.key || entry?.original;
        if (typeof text === 'string' && text.trim() !== '') target.add(normalize(text));
      }
    };
    read(titles, locks.titles);
    read(labels, locks.labels);
    return locks;
  }
  if (!seedFrom) return emptyLocks();
  const locks = emptyLocks();
  for (const [key, value] of seedFrom.entries()) {
    const separator = key.indexOf('\u0000');
    // `title:<english>` / `description:<english>` keys are not blocks.
    if (separator === -1) continue;
    const english = key.slice(separator + 1);
    if (normalize(value) === normalize(english)) locks.blocks.add(normalize(english));
  }
  if (locks.blocks.size > 0) {
    const file = path.relative(WORK_DIR, LOCKS_FILE);
    warn(`seeded ${locks.blocks.size} keep-English lock(s) into ${file} from the model memory`);
    saveLocks(locks);
  }
  return locks;
}

/**
 * Persist the locks.
 *
 * A `Set` of blocks is still accepted (the seeding path passes one). Blocks are
 * a sorted array of strings; titles are sorted objects carrying the key, the
 * original title and the reason it is English, so a reviewer can tell a proper
 * noun from a failed translation without opening the page.
 */
export function saveLocks(input) {
  const blocks = [...(input?.blocks ?? input ?? [])].filter((block) => typeof block === 'string');
  const titles = [...(input?.titles ?? [])].filter((title) => typeof title === 'string');
  const labels = [...(input?.labels ?? [])].filter((label) => typeof label === 'string');
  const payload = {
    schema: LOCKS_SCHEMA,
    note:
      'Units the model returned unchanged: technical notation, grammar, identifiers and ' +
      'proper-noun titles. The planner never queues them again; config/force-translate.yml ' +
      'overrides a block lock.',
    blocks: blocks.sort(),
    titles: titles
      .map((title) => ({key: normalize(title), original: title, reason: TITLE_LOCK_REASON}))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
    labels: labels
      .map((label) => ({key: normalize(label), original: label, reason: TITLE_LOCK_REASON}))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
  writeFileAtomic(LOCKS_FILE, `${JSON.stringify(payload, null, 1)}\n`);
}

/**
 * Product-name whitelist, derived from configuration only.
 *
 * This is the single "keep the model verbatim" authority shared by the prompt,
 * the planner, harvest, the TM read path and the independent verifier:
 *
 *   - `config/glossary/<locale>.yml` self-mappings (`source === target`) are the
 *     agreed spelling; an entry marked `kind: model` is a hardware model;
 *   - `config/technical-headings.yml#keep_exact` adds proper nouns the heading
 *     policy already pins in English; `model_prefixes` names model families.
 *
 * Nothing here is threshold or model output. A missing/unreadable config yields
 * an empty whitelist, so a partially bootstrapped locale keeps its old behaviour
 * instead of crashing. Cached per locale because planning visits every page.
 */
const productCache = new Map();
const TECHNICAL_HEADINGS = 'config/technical-headings.yml';

export function productNames(locale = DEFAULT_TARGET_LOCALE) {
  const key = locale || DEFAULT_TARGET_LOCALE;
  if (productCache.has(key)) return productCache.get(key);
  const exact = new Map(); // lower-case -> canonical spelling
  const models = new Set(); // canonical model names (glossary `kind: model`)
  const modelPrefixes = []; // lower-case prefixes from technical-headings
  try {
    const file = glossaryFile(key);
    if (fs.existsSync(file)) {
      const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
      for (const term of Array.isArray(parsed.terms) ? parsed.terms : []) {
        const source = String(term?.source ?? '').trim();
        const target = String(term?.target ?? '').trim();
        if (!source || source !== target) continue;
        exact.set(source.toLowerCase(), source);
        if (term?.kind === 'model') models.add(source);
      }
    }
  } catch {
    // No glossary must never break a read-only run.
  }
  try {
    const file = path.join(REPO, TECHNICAL_HEADINGS);
    if (fs.existsSync(file)) {
      const data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
      for (const item of Array.isArray(data.keep_exact) ? data.keep_exact : []) {
        const text = String(item).trim();
        if (text) exact.set(text.toLowerCase(), text);
      }
      for (const prefix of Array.isArray(data.model_prefixes) ? data.model_prefixes : []) {
        const text = String(prefix).trim().toLowerCase();
        if (text) modelPrefixes.push(text);
      }
    }
  } catch {
    // No heading policy must never break a read-only run.
  }
  const result = {exact, models, modelPrefixes};
  productCache.set(key, result);
  return result;
}

/**
 * Canonical English spelling when `text` is a configured *model*, else null.
 *
 * Deliberately narrower than `productNames().exact`: that map also contains
 * `keep_exact` headings such as "Firewall" or "Log", which stay English as
 * headings but have perfectly valid Chinese front-matter titles. Only glossary
 * entries marked `kind: model` may drive a repair, a harvest skip or a
 * tombstone. A case-insensitive match returns the configured spelling.
 */
export function canonicalProductName(text, locale = DEFAULT_TARGET_LOCALE) {
  const value = String(text ?? '').trim();
  if (!value || /[\u4e00-\u9fff]/.test(value)) return null;
  const lower = value.toLowerCase();
  for (const model of productNames(locale).models) {
    if (model.toLowerCase() === lower) return model;
  }
  return null;
}

/** True when `text` is a configured product / proper noun (never translate). */
export function isProductName(text, locale = DEFAULT_TARGET_LOCALE) {
  return canonicalProductName(text, locale) !== null;
}
