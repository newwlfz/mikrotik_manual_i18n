/**
 * The global translation memory.
 *
 * Today the same English sentence can live in four places: the legacy memory of
 * 7.24, the legacy memory of 7.25, the model memory (keyed by section), and the
 * comment memory. That duplication is why the same paragraph was translated two
 * or three times, and why 7,679 keys carry two different Chinese wordings.
 *
 * This module merges those stores into one index keyed by "kind + normalised
 * English", so a version or a section is a view, not part of the key.
 *
 *   block    paragraph, table, heading, list item
 *   comment  line-leading `#` comment inside a code fence
 *   title    page title
 *
 * Nothing here writes overlays. The dry-run builder (`translate tm`) reads this
 * store and reports what switching would change.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  DEFAULT_TARGET_LOCALE,
  WORK_DIR,
  ensureDir,
  glossaryFile,
  tmFile,
} from './paths.mjs';
import {normalize, fenceMask} from './blocks.mjs';
import {commentKey} from './code-comments.mjs';

/**
 * `work/translate/tm-global.<locale>.json`.
 *
 * One memory file per locale: the key is English, the value is language, so a
 * second language never shares (or overwrites) the first one's store.
 */
export function tmFileFor(locale = DEFAULT_TARGET_LOCALE) {
  return tmFile(locale);
}

export const TM_SCHEMA = 1;

/**
 * Priority, lowest first. A later source overwrites an earlier one; the model is
 * newest because this pipeline produced it, and 7.24 is canonical over 7.25.
 */
export const SOURCE_ORDER = ['legacy-7.25', 'legacy-7.24', 'model', 'comment'];

export function tmKey(kind, ...parts) {
  return [kind, ...parts].join('\u0000');
}

export function blockKey(english) {
  return tmKey('block', normalize(english));
}

export function commentTmKey(language, text) {
  return tmKey('comment', commentKey(language, text));
}

export function titleKey(title) {
  return tmKey('title', String(title || '').trim());
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

/**
 * Merge the source stores into one entry map.
 *
 * `sources` is `{legacy, model, comment}` in the shapes the pipeline writes
 * (`translation-memory.json`, `model-memory.json`, `comment-memory.json`).
 * Returns `{entries, conflicts, counts}`; `entries` is a Map so a caller can
 * iterate without re-parsing JSON.
 */
export function buildGlobalTm({legacy = {}, model = {}, comment = {}} = {}) {
  const entries = new Map();
  const conflicts = [];
  const counts = {written: 0, replaced: 0, same: 0, byKind: {}, byOrigin: {}};

  const put = (key, value, origin) => {
    const text = cleanText(value);
    if (text === null) return;
    // A block "translated" to itself is the model saying "keep English" (legal
    // wording, identifiers). It must never shadow a real translation from a
    // lower-priority source, and a real translation may replace it silently.
    const english = key.startsWith('block\u0000') ? key.slice('block\u0000'.length) : null;
    const identity = english !== null && normalize(text) === english;
    const previous = entries.get(key);
    if (!previous) {
      entries.set(key, {text, origin, identity});
      counts.written++;
      return;
    }
    if (previous.text === text) {
      previous.origin = origin;
      counts.same++;
      return;
    }
    if (identity && !previous.identity) {
      // Keep the real translation; record that this source had nothing better.
      counts.identitySkipped = (counts.identitySkipped || 0) + 1;
      return;
    }
    if (!identity && previous.identity) {
      entries.set(key, {text, origin, identity: false});
      counts.replaced++;
      return;
    }
    conflicts.push({
      key,
      kept: text,
      kept_origin: origin,
      dropped: previous.text,
      dropped_origin: previous.origin,
    });
    entries.set(key, {text, origin});
    counts.replaced++;
  };

  const legacyAreas = legacy.areas && typeof legacy.areas === 'object' ? legacy.areas : legacy;

  // Lowest priority first so the loop above can overwrite in place.
  for (const [english, chinese] of Object.entries(legacyAreas['v7.25'] || {})) {
    put(blockKey(english), chinese, 'legacy-7.25');
  }
  for (const [english, chinese] of Object.entries(legacyAreas['v7.24'] || {})) {
    put(blockKey(english), chinese, 'legacy-7.24');
  }
  for (const [rawKey, chinese] of Object.entries(model)) {
    // Titles and front-matter descriptions share the same short-text index:
    // `lookupTitle` is what `apply` / `derive` use for both.
    const shortPrefix = ['title:', 'description:'].find((prefix) => rawKey.startsWith(prefix));
    if (shortPrefix) {
      put(titleKey(rawKey.slice(shortPrefix.length)), chinese, 'model');
      continue;
    }
    const separator = rawKey.indexOf('\u0000');
    if (separator === -1) continue;
    // The section is dropped on purpose: the English is the same everywhere.
    put(blockKey(rawKey.slice(separator + 1)), chinese, 'model');
  }
  for (const [rawKey, chinese] of Object.entries(comment.entries || {})) {
    put(tmKey('comment', rawKey), chinese, 'comment');
  }

  for (const [key, entry] of entries) {
    const kind = key.slice(0, key.indexOf('\u0000'));
    counts.byKind[kind] = (counts.byKind[kind] || 0) + 1;
    counts.byOrigin[entry.origin] = (counts.byOrigin[entry.origin] || 0) + 1;
  }

  return {entries, conflicts, counts};
}

export function serializeTm({entries, conflicts, counts}, {locale = DEFAULT_TARGET_LOCALE} = {}) {
  const sorted = [...entries.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    schema: TM_SCHEMA,
    locale,
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, '+00:00'),
    counts,
    conflicts: {
      total: conflicts.length,
      by_pair: conflicts.reduce((acc, item) => {
        const pair = `${item.dropped_origin}>${item.kept_origin}`;
        acc[pair] = (acc[pair] || 0) + 1;
        return acc;
      }, {}),
      samples: conflicts.slice(0, 20),
    },
    entries: Object.fromEntries(sorted),
  };
}

export function saveTm(payload, {locale = payload?.locale || DEFAULT_TARGET_LOCALE} = {}) {
  const file = tmFileFor(locale);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 1)}\n`);
  return file;
}

/**
 * Read the three source stores and build the global memory in one call.
 *
 * The memory is rebuilt on every `apply` / `derive` run rather than cached in a
 * file, so a translation produced by `translate` is visible to the next rebuild
 * without a separate refresh step. Building 20k entries costs about a second.
 */
export function createGlobalTm({workDir = WORK_DIR, locale = DEFAULT_TARGET_LOCALE} = {}) {
  const readJson = (file, fallback) => {
    const full = path.join(workDir, file);
    if (!fs.existsSync(full)) return fallback;
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  };
  const legacy = readJson('translation-memory.json', null);
  if (!legacy) throw new Error('translation memory missing: run `import-legacy` first');
  const model = readJson('model-memory.json', {});
  const comment = readJson('comment-memory.json', {entries: {}});
  const built = buildGlobalTm({legacy, model, comment});
  built.locale = locale;
  return built;
}

export function loadTm(locale = DEFAULT_TARGET_LOCALE) {
  const file = tmFileFor(locale);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = new Map(Object.entries(raw.entries || {}));
  return {
    entries,
    counts: raw.counts || {},
    conflicts: raw.conflicts || {total: 0, samples: []},
    locale: raw.locale || locale,
  };
}

/**
 * The agreed terminology (`config/glossary/<locale>.yml`).
 *
 * Read once per locale per process: the file is policy, not data, and every
 * lookup below consults it.
 */
const glossaryCache = new Map();
export function glossaryTerms(locale = DEFAULT_TARGET_LOCALE) {
  if (glossaryCache.has(locale)) return glossaryCache.get(locale);
  let terms = [];
  const file = glossaryFile(locale);
  if (fs.existsSync(file)) {
    const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    terms = (parsed.terms || []).filter(
      (term) => term && typeof term.source === 'string' && typeof term.target === 'string',
    );
  }
  glossaryCache.set(locale, terms);
  return terms;
}

/**
 * The agreed wording for a string that *is* a term ("Back To Home"), or null.
 *
 * An exact term is the strongest case of "the glossary outranks the memory": the
 * memory may hold any paraphrase it likes, the agreed term wins. This is what
 * makes a product or feature name stable in titles, link text and list items.
 */
export function exactGlossaryTerm(english, locale = DEFAULT_TARGET_LOCALE) {
  const text = String(english ?? '').trim().toLowerCase();
  if (!text) return null;
  for (const {source, target} of glossaryTerms(locale)) {
    if (source === target) continue;
    if (source.trim().toLowerCase() === text) return target;
  }
  return null;
}

/**
 * Apply the glossary on top of a translated string.
 *
 * The glossary is a contract, so it outranks the memory: a memory entry that
 * kept the English product term is corrected here rather than trusted. Only a
 * term that is still literally English is touched, and only when its agreed
 * Chinese form is not already present, so the pass is idempotent and never
 * rewrites a paragraph the memory translated properly.
 */
export function applyGlossaryTerms(text, locale = DEFAULT_TARGET_LOCALE) {
  if (text === null || text === undefined) return text;
  let out = String(text);
  for (const {source, target} of glossaryTerms(locale)) {
    if (!source || !target || source === target) continue;
    if (!out.includes(source)) continue;
    if (out.includes(target)) continue;
    out = out.split(source).join(target);
  }
  return out;
}

/** Chinese text for an English block, or null. */
export function lookupBlock(tm, english) {
  if (!tm) return null;
  const locale = tm.locale || DEFAULT_TARGET_LOCALE;
  const exact = exactGlossaryTerm(english, locale);
  const text = tm.entries.get(blockKey(english))?.text ?? null;
  return exact ?? applyGlossaryTerms(text, locale);
}

/**
 * Block lookup that can fall back to a line-by-line match.
 *
 * A source list (`- a\n- b\n- c`) is one block here, while an earlier overlay may
 * have kept each item on its own block. When the whole block has no entry but
 * every line does, the translations are reassembled in order; otherwise nothing
 * is returned, so a half-translated paragraph never appears.
 */
/**
 * A whole-block translation of an argument table is only valid when it
 * translates the same arguments. The legacy memory contains at least one
 * misaligned entry (a `Flag | Name` table whose translation is the following
 * `Argument | Type` table), and using it silently drops a table from the page.
 * Row order is the structural fingerprint here: `arg` names are identifiers and
 * are never translated.
 */
function tableShapeMismatch(english, translated) {
  if (!/^<ArgTable\b/.test(String(english).trim())) return false;
  const argsOf = (text) =>
    [...String(text).matchAll(/<ArgTableRow\b[^>]*?\barg="([^"]*)"/g)].map((match) => match[1]);
  return argsOf(english).join('\u0001') !== argsOf(translated).join('\u0001');
}

export function lookupBlockLines(tm, english) {
  const whole = lookupBlock(tm, english);
  if (whole !== null && !tableShapeMismatch(english, whole)) return whole;
  const lines = String(english).split('\n');
  if (lines.length < 2) return null;
  const parts = lines.map((line) => (line.trim() === '' ? line : lookupBlock(tm, line)));
  if (parts.some((part, index) => part === null && lines[index].trim() !== '')) return null;
  return applyGlossaryTerms(parts.join('\n'), tm?.locale || DEFAULT_TARGET_LOCALE);
}

/**
 * Replace the still-English lines of rendered tables.
 *
 * A table rebuilt from an older capture can come back mixed: the rows were
 * translated but the header row was not, so the block as a whole is Chinese and
 * `lookupBlockLines` cannot help. Each English table line is looked up on its
 * own, which is safe because a Chinese line simply has no entry.
 */
export function translateTableLines(tm, body) {
  if (!tm) return {body, changed: 0};
  let changed = 0;
  const text = String(body);
  const lines = text.split('\n');
  // A fenced block can contain ASCII tables (`|  | | | |`); rewriting those
  // would change the code the page shows.
  const mask = fenceMask(text);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (mask[index]) continue;
    if (!/^\s*\|/.test(line)) continue;
    if (/[\u4e00-\u9fff]/.test(line)) continue;
    const hit = lookupBlock(tm, line);
    if (hit !== null && hit !== line) {
      lines[index] = hit;
      changed++;
    }
  }
  return {body: lines.join('\n'), changed};
}

/** Chinese text for a code-fence comment, or null. */
export function lookupComment(tm, language, text) {
  if (!tm) return null;
  return tm.entries.get(commentTmKey(language, text))?.text ?? null;
}

/**
 * Comment lookup by the key `translateCodeComments` produces (`<lang>\0<text>`).
 */
export function lookupCommentKey(tm, key) {
  if (!tm) return null;
  return tm.entries.get(tmKey('comment', key))?.text ?? null;
}

/** Chinese text for a page title, or null. */
export function lookupTitle(tm, title) {
  if (!tm) return null;
  const locale = tm.locale || DEFAULT_TARGET_LOCALE;
  const exact = exactGlossaryTerm(title, locale);
  return exact ?? applyGlossaryTerms(tm.entries.get(titleKey(title))?.text ?? null, locale);
}
