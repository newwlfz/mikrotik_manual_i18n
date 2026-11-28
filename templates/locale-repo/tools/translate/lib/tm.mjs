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
import {readModelMemory} from './model-memory.mjs';
import {canonicalProductName, productNames} from './keep-english.mjs';

/**
 * A letter outside ASCII means the value is already in the target script, be it
 * Han, Cyrillic, Greek or any other writing system. A non-ASCII punctuation mark
 * alone is not a translation.
 */
const NON_ASCII_LETTER = /(?![\x00-\x7F])\p{L}/u;

/** Escape a literal for a regular expression (shared with the heading guard). */
function escapeLiteral(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A heading that lost its model name in the memory is not a translation: it is
 * the exact bug this repo is fixing (`# hAP be³ Media` -> `# hAP be³ 媒体`,
 * `## [Audience](...)` -> `## [受众](...)`). The model list comes from config;
 * when a configured model is present in the English heading but absent from the
 * remembered heading, the English source is returned instead. Prose headings
 * without a model are untouched. Any non-ASCII letter counts as translated, so
 * a locale that does not use Han characters gets the guard too.
 */
export function productHeadingGuard(english, translated, locale) {
  const value = String(translated ?? '');
  if (!value || !NON_ASCII_LETTER.test(value)) return translated;
  const source = String(english ?? '').trim();
  if (!/^#{1,6}\s+/.test(source)) return translated;
  const stripIdentifiers = (text) =>
    String(text)
      .replace(/\{#[^}]*\}/g, ' ')
      .replace(/\]\([^)]*\)/g, '] ')
      .replace(/[\[\]()#]/g, ' ')
      .toLowerCase();
  const englishText = stripIdentifiers(source);
  const translatedText = stripIdentifiers(value);
  for (const model of productNames(locale).models) {
    const needle = model.toLowerCase();
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeLiteral(needle)}(?=$|[^a-z0-9])`);
    if (pattern.test(englishText) && !translatedText.includes(needle)) return english;
  }
  return translated;
}

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
 * Numeric version carried by a section label, e.g. `docs-7.24` -> [7, 24].
 *
 * `null` for a section without a version (`docs`, `hardware`, `blog`,
 * `changelog`): those are the "current" tier. Components are compared as
 * NUMBERS, so `7.9` sorts before `7.10` (a string compare would get it wrong).
 */
export function sectionVersion(section) {
  const match = String(section ?? '').match(/-(\d+(?:\.\d+)*)\s*$/);
  if (!match) return null;
  const parts = match[1].split('.').map((part) => Number(part));
  return parts.some((part) => !Number.isFinite(part)) ? null : parts;
}

/**
 * Section priority: negative when `a` wins over `b`.
 *
 * 1. a versioned section outranks a versionless ("current") one;
 * 2. among versioned sections the LOWER version wins (oldest landed first);
 * 3. inside the same tier the section NAME decides, lexicographically, so the
 *    result is deterministic and never depends on shard filenames or on the
 *    order `Object.entries` happened to yield.
 */
export function compareSectionPriority(a, b) {
  const av = sectionVersion(a);
  const bv = sectionVersion(b);
  if (av && bv) {
    for (let i = 0, n = Math.max(av.length, bv.length); i < n; i++) {
      const diff = (av[i] ?? 0) - (bv[i] ?? 0);
      if (diff !== 0) return diff;
    }
  } else if (av && !bv) {
    return -1;
  } else if (!av && bv) {
    return 1;
  }
  const as = String(a ?? '');
  const bs = String(b ?? '');
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * Explicit, auditable resolution of every candidate for one English string.
 *
 * The winner is picked from section metadata only. An "identity" candidate
 * (English deliberately kept as its own translation) never beats a real
 * translation. The returned candidate carries the parsed `version`, the `rule`
 * and a `reason` naming the rejected sections, so a reviewer can reconstruct
 * the decision without guessing from shard order.
 */
export function resolveConflict(candidates) {
  const list = (Array.isArray(candidates) ? candidates : [...candidates]).filter(Boolean);
  if (list.length === 0) return null;
  const real = list.filter((candidate) => !candidate.identity);
  const pool = real.length ? real : list;
  const scored = pool.map((candidate, index) => ({candidate, index}));
  scored.sort((a, b) => {
    const priority = compareSectionPriority(
      a.candidate.sourceSection,
      b.candidate.sourceSection,
    );
    return priority !== 0 ? priority : a.index - b.index;
  });
  const winner = scored[0].candidate;
  const rejected = scored.slice(1).map(({candidate}) => ({
    sourceSection: candidate.sourceSection ?? null,
    version: sectionVersion(candidate.sourceSection) ?? null,
    text: candidate.text,
  }));
  const names = (items) =>
    items.map(({candidate}) => candidate.sourceSection ?? '(no section)').join(', ');
  return {
    ...winner,
    version: sectionVersion(winner.sourceSection) ?? null,
    rule: list.length > 1 ? 'oldest-version-first' : 'single-candidate',
    reason:
      list.length > 1
        ? `${winner.sourceSection ?? '(no section)'} kept; rejected ${names(scored.slice(1))}`
        : 'only candidate',
    rejected,
  };
}

/**
 * Merge the source stores into one entry map.
 *
 * `sources` is `{legacy, model, comment}` in the shapes the pipeline writes
 * (`translation-memory.json`, `model-memory.json`, `comment-memory.json`).
 * Returns `{entries, conflicts, counts}`; `entries` is a Map so a caller can
 * iterate without re-parsing JSON.
 */
export function buildGlobalTm({
  legacy = {},
  model = {},
  comment = {},
  arbitrateVersions = true,
} = {}) {
  const entries = new Map();
  const conflicts = [];
  // Cross-version (same English, different section) decisions are audited here,
  // separately from `conflicts`, which stays "one source overwrote another".
  const resolutions = [];
  const counts = {
    written: 0,
    replaced: 0,
    same: 0,
    byKind: {},
    byOrigin: {},
    byWinningSection: {},
  };

  const put = (key, value, origin, meta = {}) => {
    const text = cleanText(value);
    if (text === null) return;
    // A block "translated" to itself is the model saying "keep English" (legal
    // wording, identifiers). It must never shadow a real translation from a
    // lower-priority source, and a real translation may replace it silently.
    const english = key.startsWith('block\u0000') ? key.slice('block\u0000'.length) : null;
    const identity = english !== null && normalize(text) === english;
    const previous = entries.get(key);
    if (!previous) {
      entries.set(key, {text, origin, identity, ...meta});
      counts.written++;
      return;
    }
    if (previous.text === text) {
      previous.origin = origin;
      if (meta.sourceSection !== undefined) previous.sourceSection = meta.sourceSection;
      counts.same++;
      return;
    }
    if (identity && !previous.identity) {
      // Keep the real translation; record that this source had nothing better.
      counts.identitySkipped = (counts.identitySkipped || 0) + 1;
      return;
    }
    if (!identity && previous.identity) {
      entries.set(key, {text, origin, identity: false, ...meta});
      counts.replaced++;
      return;
    }
    conflicts.push({
      key,
      kept: text,
      kept_origin: origin,
      kept_source_section: meta.sourceSection ?? null,
      dropped: previous.text,
      dropped_origin: previous.origin,
      dropped_source_section: previous.sourceSection ?? null,
    });
    entries.set(key, {text, origin, ...meta});
    counts.replaced++;
  };

  const legacyAreas = legacy.areas && typeof legacy.areas === 'object' ? legacy.areas : legacy;

  // Lowest priority first so the loop above can overwrite in place. Legacy has
  // no per-block section beyond its area, but the area is still recorded so an
  // entry can be traced back to the version it came from.
  for (const [english, chinese] of Object.entries(legacyAreas['v7.25'] || {})) {
    put(blockKey(english), chinese, 'legacy-7.25', {
      sourceSection: 'v7.25',
      version: [7, 25],
    });
  }
  for (const [english, chinese] of Object.entries(legacyAreas['v7.24'] || {})) {
    put(blockKey(english), chinese, 'legacy-7.24', {
      sourceSection: 'v7.24',
      version: [7, 24],
    });
  }

  // Model / shard keys carry their section (`docs-7.24\0English`,
  // `hardware\0English`, `title:…`). Several sections can translate the same
  // English differently. Collect every candidate BEFORE collapsing to the
  // section-free key, then resolve explicitly with `resolveConflict` - never by
  // shard filename or Object.entries order. The section is still dropped from
  // the LOOKUP key afterwards (English is identical in every section), but it
  // is preserved on the entry as `sourceSection` / `version` for auditing.
  //
  // `arbitrateVersions: false` keeps the historical insertion-order merge for a
  // locale that HAS a legacy store (zh-Hans), so its existing overlays remain
  // byte-stable. The explicit rule is what makes a shards-only repo loadable.
  if (arbitrateVersions) {
  const modelCandidates = new Map();
  const addModelCandidate = (key, value, sourceSection) => {
    const text = cleanText(value);
    if (text === null) return;
    const english = key.startsWith('block\u0000') ? key.slice('block\u0000'.length) : null;
    const identity = english !== null && normalize(text) === english;
    const list = modelCandidates.get(key) || [];
    list.push({text, origin: 'model', sourceSection, identity});
    modelCandidates.set(key, list);
  };
  for (const [rawKey, chinese] of Object.entries(model)) {
    // Titles and front-matter descriptions share the same short-text index:
    // `lookupTitle` is what `apply` / `derive` use for both.
    const shortPrefix = ['title:', 'description:'].find((prefix) => rawKey.startsWith(prefix));
    if (shortPrefix) {
      addModelCandidate(titleKey(rawKey.slice(shortPrefix.length)), chinese, null);
      continue;
    }
    const separator = rawKey.indexOf('\u0000');
    if (separator === -1) continue;
    addModelCandidate(blockKey(rawKey.slice(separator + 1)), chinese, rawKey.slice(0, separator));
  }
  for (const [key, list] of modelCandidates) {
    const decision = resolveConflict(list);
    if (list.length > 1 && new Set(list.map((candidate) => candidate.text)).size > 1) {
      resolutions.push({
        key,
        kind: key.slice(0, key.indexOf('\u0000')),
        winner: decision.sourceSection ?? null,
        winner_version: decision.version,
        rule: decision.rule,
        reason: decision.reason,
        candidates: list.map((candidate) => ({
          sourceSection: candidate.sourceSection ?? null,
          version: sectionVersion(candidate.sourceSection) ?? null,
          text: candidate.text,
          identity: Boolean(candidate.identity),
        })),
      });
    }
    put(key, decision.text, 'model', {
      sourceSection: decision.sourceSection ?? null,
      version: decision.version,
      decision: {rule: decision.rule, reason: decision.reason},
    });
  }
  } else {
    // Legacy compatibility path: keep the old "last candidate wins" semantics
    // so a locale with a legacy store is completely unchanged by this fix.
    for (const [rawKey, chinese] of Object.entries(model)) {
      const shortPrefix = ['title:', 'description:'].find((prefix) => rawKey.startsWith(prefix));
      if (shortPrefix) {
        put(titleKey(rawKey.slice(shortPrefix.length)), chinese, 'model');
        continue;
      }
      const separator = rawKey.indexOf('\u0000');
      if (separator === -1) continue;
      put(blockKey(rawKey.slice(separator + 1)), chinese, 'model');
    }
  }

  for (const [rawKey, chinese] of Object.entries(comment.entries || {})) {
    put(tmKey('comment', rawKey), chinese, 'comment', {sourceSection: 'comment'});
  }

  for (const [key, entry] of entries) {
    const kind = key.slice(0, key.indexOf('\u0000'));
    counts.byKind[kind] = (counts.byKind[kind] || 0) + 1;
    counts.byOrigin[entry.origin] = (counts.byOrigin[entry.origin] || 0) + 1;
    if (entry.sourceSection) {
      counts.byWinningSection[entry.sourceSection] =
        (counts.byWinningSection[entry.sourceSection] || 0) + 1;
    }
  }
  counts.versionConflicts = resolutions.length;

  return {entries, conflicts, counts, resolutions};
}

export function serializeTm(
  {entries, conflicts, counts, resolutions = []},
  {locale = DEFAULT_TARGET_LOCALE} = {},
) {
  const sorted = [...entries.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    schema: TM_SCHEMA,
    locale,
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, '+00:00'),
    counts,
    resolutions: {
      total: resolutions.length,
      by_rule: resolutions.reduce((acc, item) => {
        acc[item.rule] = (acc[item.rule] || 0) + 1;
        return acc;
      }, {}),
      samples: resolutions.slice(0, 20),
    },
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
  const legacyFile = path.join(workDir, 'translation-memory.json');
  // A locale repo that only commits shards (zh-Hant today) has NO legacy file.
  // That is a valid state: build from shards + comment memory instead of
  // failing. A file that EXISTS but is malformed is a real error - the JSON.parse
  // below throws as before, and a valid-JSON/non-object body is rejected too, so
  // this relaxation never hides a corrupt legacy store.
  let legacy = {};
  let hasLegacyFile = false;
  if (fs.existsSync(legacyFile)) {
    hasLegacyFile = true;
    legacy = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) {
      throw new Error(`translation memory corrupt: ${legacyFile} is not an object`);
    }
  }
  // Big file first, then every incremental shard (later shards win inside one
  // section). A CI checkout has no `model-memory.json`, so the shards are the
  // only memory it has for the translations the previous batches committed.
  // Cross-section conflicts are resolved explicitly by buildGlobalTm, not by
  // this merge order.
  const model = Object.fromEntries(readModelMemory({workDir}));
  const comment = readJson('comment-memory.json', {entries: {}});
  // Explicit oldest-version arbitration for shards-only repos; keep the legacy
  // repo's historical merge untouched so zh-Hans output stays byte-identical.
  const built = buildGlobalTm({legacy, model, comment, arbitrateVersions: !hasLegacyFile});
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
    resolutions: raw.resolutions || {total: 0, samples: []},
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
 * Characters of a translated string that MUST NOT be glossary-rewritten.
 *
 * The glossary is a list of bare words (`port` -> `埠`, `log` -> `日誌`,
 * `client` -> `用戶端`, ...). A blind `split(source).join(target)` therefore
 * corrupts every identifier that happens to CONTAIN one of those words:
 *
 *   export-passphrase -> ex埠-passphrase      support@ -> sup埠@
 *   login.html        -> 日誌in.html          /user/settings -> /使用者/settings
 *   link-login        -> link-日誌in          mac-protocol  -> mac-協定
 *
 * Those are not translations at all: they are broken commands, parameter
 * names, routes, file names and e-mail addresses. The mask below marks (a)
 * fenced code, (b) inline code spans, (c) markdown link targets, (d) HTML
 * attribute values and (e) bare URLs / e-mail addresses. A second, contextual
 * test rejects a term that is glued to an ASCII identifier by `- _ . / @ =`.
 */
export function glossaryProtectionMask(text) {
  const source = String(text ?? '');
  const mask = new Array(source.length).fill(false);
  const mark = (start, end) => {
    for (let i = Math.max(0, start); i < Math.min(end, mask.length); i++) mask[i] = true;
  };

  // (a) Fenced code (including the opening/closing fence lines).
  const lines = source.split('\n');
  let offset = 0;
  let inFence = false;
  let fenceChar = '';
  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
        mark(offset, offset + line.length);
      } else if (fence[1][0] === fenceChar && /^\s*(?:`{3,}|~{3,})\s*$/.test(line)) {
        mark(offset, offset + line.length);
        inFence = false;
      } else {
        mark(offset, offset + line.length);
      }
    } else if (inFence) {
      mark(offset, offset + line.length);
    }
    offset += line.length + 1;
  }

  // (b) Inline code: `x`, ``x ` y`` - a run of N backticks closed by N backticks.
  for (const match of source.matchAll(/(`+)([\s\S]*?)\1/g)) {
    mark(match.index, match.index + match[0].length);
  }
  // (c) Markdown link destinations  ](url)  - the label stays translatable.
  for (const match of source.matchAll(/\]\(([^)\s]+)\)/g)) {
    mark(match.index + 2, match.index + match[0].length - 1);
  }
  // (d) Quoted HTML attribute values (href/src on links and images).
  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*(["'])([^"']*)\1/gi)) {
    mark(match.index, match.index + match[0].length);
  }
  // (e) E-mail addresses and absolute URLs.
  for (const match of source.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    mark(match.index, match.index + match[0].length);
  }
  for (const match of source.matchAll(/https?:\/\/[^\s)]+/gi)) {
    mark(match.index, match.index + match[0].length);
  }
  // (f) Heading anchors `{#id}`. The id is published verbatim in the built page;
  // a glossary rewrite here silently breaks every link that names it
  // (`{#port}` -> `{#埠}` is the observed corruption).
  for (const match of source.matchAll(/\{#[^}\s]+\}/g)) {
    mark(match.index, match.index + match[0].length);
  }
  return mask;
}

/** True when an occurrence is a fragment of an ASCII identifier, not prose. */
export function glossaryContextSafe(text, index, length) {
  const isWord = (char) => Boolean(char) && /[A-Za-z0-9]/.test(char);
  // `#`, `{` and `}` join a glossary-looking word to an anchor: `#port`,
  // `{#port}`, `#port-forwarding` are identifiers, not prose occurrences.
  const isJoiner = (char) => Boolean(char) && /[-_./@=#{}]/.test(char);
  const before = text[index - 1];
  const after = text[index + length];
  const before2 = text[index - 2];
  const after2 = text[index + length + 1];
  // "export", "support", "login", "portable" - inside a larger word.
  if (isWord(before) || isWord(after)) return false;
  // "link-login", "login.html", "/user/settings", "a@port", "port=80".
  if (isJoiner(before) && isWord(before2)) return false;
  if (isJoiner(after) && isWord(after2)) return false;
  return true;
}

/**
 * Pure, side-effect-free glossary pass used by both the live lookup and the
 * unit tests. `terms` is the `{source, target}` list; passing it explicitly
 * keeps the identifier protection testable without a locale config file.
 */
export function applyGlossaryTermsWithTerms(text, terms) {
  if (text === null || text === undefined) return text;
  let out = String(text);
  for (const {source, target} of terms || []) {
    if (!source || !target || source === target) continue;
    if (!out.includes(source) || out.includes(target)) continue;
    const mask = glossaryProtectionMask(out);
    let result = '';
    let cursor = 0;
    let index = 0;
    while ((index = out.indexOf(source, index)) !== -1) {
      const end = index + source.length;
      const protectedRange = mask.slice(index, end).some(Boolean);
      if (!protectedRange && glossaryContextSafe(out, index, source.length)) {
        result += out.slice(cursor, index) + target;
        cursor = end;
      }
      index = end;
    }
    out = result + out.slice(cursor);
  }
  return out;
}

/**
 * Apply the glossary on top of a translated string.
 *
 * The glossary is a contract, so it outranks the memory: a memory entry that
 * kept the English product term is corrected here rather than trusted. Only a
 * term that is still literally English is touched, and only when its agreed
 * Chinese form is not already present, so the pass is idempotent and never
 * rewrites a paragraph the memory translated properly. Identifiers, URLs,
 * e-mail addresses, inline code and paths are protected (see the mask above).
 */
export function applyGlossaryTerms(text, locale = DEFAULT_TARGET_LOCALE) {
  return applyGlossaryTermsWithTerms(text, glossaryTerms(locale));
}

/**
 * Detect a Han character glued into an ASCII command / parameter / path token.
 *
 * Used by tm-backfill as a last line of defence before writing a candidate:
 * even if a future glossary edit reintroduces a bare short term, a wording
 * like `ex埠-passphrase` or `link-日誌in` is rejected instead of shipped.
 */
export function gluedTokenPatterns() {
  return [
    // `ex埠-passphrase`, `sup埠@`, `link-日誌in`, `mac-協定`
    /[A-Za-z]{2,}[\u4e00-\u9fff]+[A-Za-z]*[-_./@]/,
    // `-日誌in`, `/使用者/settings`, `/介面/dot1x`
    /[-_./@][A-Za-z]*[\u4e00-\u9fff]+[-_./@]?[A-Za-z]+/,
    // A Han run inserted between ASCII halves of one token.
    /[A-Za-z]+[\u4e00-\u9fff]+[A-Za-z]+/,
  ];
}

export function hasGluedToken(text) {
  return gluedTokenPatterns().some((pattern) => pattern.test(String(text ?? '')));
}

/** Chinese text for an English block, or null. */
export function lookupBlock(tm, english) {
  if (!tm) return null;
  // An identity entry is an explicit "keep the English" decision. Return the
  // source verbatim before the glossary runs: rewriting a generic term here
  // (data/default/server/user) makes a deliberately English block look pending
  // and lets apply/derive write a half-Chinese CLI command into the overlay.
  if (tm.entries.get(blockKey(english))?.identity) return english;
  const locale = tm.locale || DEFAULT_TARGET_LOCALE;
  const exact = exactGlossaryTerm(english, locale);
  const text = tm.entries.get(blockKey(english))?.text ?? null;
  const value = exact ?? applyGlossaryTerms(text, locale);
  return productHeadingGuard(english, value, locale);
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

/**
 * Chinese text for a page title, or null.
 *
 * A configured product name is returned in its canonical English spelling
 * BEFORE the memory is consulted: the memory is deliberately kept (it carries
 * all the reviewed prose), but a remembered `title:Audience -> 受众` must never
 * reach `apply` again. The same whitelist drives the planner and the verifier.
 */
export function lookupTitle(tm, title) {
  if (!tm) return null;
  const locale = tm.locale || DEFAULT_TARGET_LOCALE;
  const canonical = canonicalProductName(title, locale);
  if (canonical) return canonical;
  const exact = exactGlossaryTerm(title, locale);
  return exact ?? applyGlossaryTerms(tm.entries.get(titleKey(title))?.text ?? null, locale);
}
