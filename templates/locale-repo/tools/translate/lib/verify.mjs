/**
 * Structural verification of a translation overlay.
 *
 * Everything checked here is a property that must survive translation: the same
 * files, the same fenced code (verbatim), the same images, the same front-matter
 * keys, and a document that still compiles as MDX. Prose that came back in
 * English is reported separately from structural errors, but it is still
 * translation debt: `index.mjs` fails `verify` when a non-excluded block
 * remains in English.
 *
 * Fenced code has one exception, `code-verbatim-except-comments`: a line that
 * the classifier accepts as a line-leading comment may carry Chinese. The code
 * lines are still compared byte for byte, and a comment that changed without
 * becoming Chinese is reported as `commentDiff` rather than `fenceDiff`.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  localeHasResources,
  sectionsFor,
  translatableLocales,
  walkMarkdown,
  relative,
  glossaryFile,
} from './paths.mjs';
import YAML from 'yaml';
import {splitFrontMatter, readField} from './frontmatter.mjs';
import {
  splitBlockSpans,
  hasFence,
  normalize,
  fenceMask,
  codeParagraphs,
  isTranslatableProse,
} from './blocks.mjs';
import {splitAdmonitions, bodyParagraphs} from './admonitions.mjs';
import {languageText} from './prose.mjs';
import {
  fenceRoles,
  isCommentLanguage,
  normalizeLanguage,
  parseCommentLine,
} from './code-comments.mjs';
import {anchorMismatches} from './anchors.mjs';
import {CJK} from './legacy.mjs';
import {cjkCount} from './cjk.mjs';
import {loadLocks} from './keep-english.mjs';
import {
  ENGLISH,
  readsEnglish,
  descriptionVerdict,
} from './desc-rules.mjs';
// `verify` owns no private description rule: `index.mjs` calls the same verdict
// for `pending`, so re-export it for the selftest and any other consumer.
export {descriptionVerdict};
import {images, isTranslationExcluded} from './apply.mjs';
import {buildWhitelist, looksUntranslated} from './ui-copy.mjs';
import {versionForSection} from '../../sync/lib/versions.mjs';

const FENCE = /^\s*(```+|~~~+)/;
// Inline code is part of a sentence ("Example `connection-tracking-mode`
// configuration:"), so backticks and `=` must not disqualify an English line.
const PROSE = /^[A-Z][A-Za-z0-9 ,.'"()[\]/:;!?%+=`-]{15,}$/;
// A lead-in line ("Example `connection-tracking-mode` configuration:") is a
// sentence without function words, so the English-word test above misses it and
// the paragraph before a sample stayed English while the counter read zero.
const LEAD_IN = /^[A-Z][A-Za-z0-9 ,.'"()[\]/:;!?%+=`-]{10,}:$/;

export function fences(body) {
  const lines = body.split('\n');
  const mask = fenceMask(body);
  const out = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) {
      current = current || [];
      current.push(lines[i]);
    } else if (current) {
      out.push(current.join('\n'));
      current = null;
    }
  }
  if (current) out.push(current.join('\n'));
  return out;
}

/** Console transcripts stay English; see config/english-only-blocks.yml. */
export function englishOnlyPrefixes() {
  const file = path.join(REPO, 'config/english-only-blocks.yml');
  if (!fs.existsSync(file)) return [];
  const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return (parsed.prefixes || []).map(String);
}

/**
 * Read `config/technical-headings.yml` the way the compliance-mark plugin reads
 * its own heading config (`loadComplianceConfig`): resolve against the repo
 * root, compile the patterns once, and fall back to *no policy* when the file is
 * missing or unreadable so `verify` keeps its original behaviour.
 *
 * Exact wordings are compared case-insensitively after trimming; patterns keep
 * the case the config author wrote (`^[A-Z]` acronyms, product links). The
 * optional `overlay_inflation` section lets the same data file override the
 * expansion thresholds without a code change.
 */
const TECHNICAL_HEADINGS_FILE = 'config/technical-headings.yml';
/**
 * Expansion thresholds. Chinese compresses English: one Han character usually
 * carries only part of an English word, so a faithful translation of 100 source
 * words typically lands around 150-220 CJK characters (2-2.2x the word count),
 * with technical terms adding a handful of ASCII words. 3.0x plus an absolute
 * margin of 20 leaves that normal compression intact while still catching a
 * 100-word page rewritten into 800 characters (8x). `config/technical-headings.yml`
 * may override both through `overlay_inflation: {ratio, margin}`.
 */
export const INFLATION_RATIO = 3.0;
export const INFLATION_MARGIN = 20;
let technicalHeadingsCache;
let locksCache;

function listOf(data, key) {
  return Array.isArray(data?.[key])
    ? data[key].filter((entry) => typeof entry === 'string' && entry.trim() !== '')
    : [];
}

export function loadTechnicalHeadings() {
  if (technicalHeadingsCache) return technicalHeadingsCache;
  const file = path.join(REPO, TECHNICAL_HEADINGS_FILE);
  let data = {};
  try {
    data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    data = {};
  }
  const key = (text) => String(text).trim().toLowerCase();
  const patterns = (name) =>
    listOf(data, name)
      .map((source) => {
        try {
          return new RegExp(source);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  const inflation = data.overlay_inflation || {};
  technicalHeadingsCache = {
    mustTranslate: new Set(listOf(data, 'must_translate').map(key)),
    keepExact: new Set(listOf(data, 'keep_exact').map(key)),
    acronymPatterns: patterns('acronym_patterns'),
    modelPatterns: patterns('model_patterns'),
    modelPrefixes: listOf(data, 'model_prefixes').map(key),
    versionPatterns: patterns('version_patterns'),
    inflation: {
      ratio: Number.isFinite(Number(inflation.ratio)) && Number(inflation.ratio) > 0
        ? Number(inflation.ratio)
        : INFLATION_RATIO,
      margin: Number.isFinite(Number(inflation.margin)) && Number(inflation.margin) >= 0
        ? Number(inflation.margin)
        : INFLATION_MARGIN,
    },
  };
  return technicalHeadingsCache;
}

/**
 * Terms this locale deliberately keeps in English, from its own glossary.
 *
 * A `terms[]` entry whose `target` equals its `source` is not a translation at
 * all: it is the locale's authoritative statement that the English spelling is
 * the agreed wording (product names, and phrases such as "Back To Home"). The
 * glossary is per-locale terminology data, so it outranks the cross-locale
 * `must_translate` list in `headingTranslationVerdict` — when they disagree the
 * locale terminology file wins. Sharing that verdict means the planner
 * (`headings.mjs`) picks up the same exemption without a second implementation.
 *
 * A missing, unreadable or malformed glossary yields an empty set, so an old or
 * partially bootstrapped locale keeps exactly the previous behaviour. Results
 * are cached per locale because planning visits every page of every section.
 */
const glossarySelfCache = new Map();

export function glossarySelfMappedTerms(locale = DEFAULT_TARGET_LOCALE) {
  if (glossarySelfCache.has(locale)) return glossarySelfCache.get(locale);
  const keys = new Set();
  try {
    const file = glossaryFile(locale);
    if (fs.existsSync(file)) {
      const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
      const terms = Array.isArray(parsed.terms) ? parsed.terms : [];
      for (const term of terms) {
        const source = term?.source;
        const target = term?.target;
        if (
          typeof source === 'string' &&
          typeof target === 'string' &&
          source.trim() !== '' &&
          source.trim() === target.trim()
        ) {
          keys.add(source.trim().toLowerCase());
        }
      }
    }
  } catch {
    // No glossary (or an unparsable one) must never break a read-only verify.
  }
  glossarySelfCache.set(locale, keys);
  return keys;
}

/** Titles deliberately kept English by the model, from `keep-english.json`. */
function keptTitleKeys() {
  if (locksCache) return locksCache;
  let titles = new Set();
  try {
    titles = new Set([...loadLocks().titles].map((title) => String(title).trim().toLowerCase()));
  } catch {
    // A missing or unreadable ledger must not break a read-only verify.
    titles = new Set();
  }
  locksCache = titles;
  return titles;
}

/**
 * Policy verdict for one heading text: `true` must be translated, `false` is
 * exempt, `null` means "no data rule" and leaves the structural test in
 * `isTranslatableHeading` to decide. The order below is the contract: a
 * per-locale glossary self-mapping wins over everything (see step 0), then a
 * word in `must_translate` wins over the remaining exemptions.
 */
export function headingTranslationVerdict(text, options = {}) {
  const raw = String(text ?? '').trim();
  const config = options.config ?? loadTechnicalHeadings();
  const key = raw.toLowerCase();
  // 0) A self-mapping in this locale's `config/glossary/<locale>.yml` is the
  //    locale's authoritative "keep this English" declaration. It deliberately
  //    overrides `must_translate` below: that list is one cross-locale policy,
  //    while the glossary is the terminology authority for THIS locale, so a
  //    conflict resolves in favour of the locale terminology file. `options.
  //    glossarySelf` lets callers/tests inject the set; otherwise it is loaded
  //    (and cached) from the repository's own glossary.
  const glossarySelf =
    options.glossarySelf ??
    glossarySelfMappedTerms(options.locale ?? DEFAULT_TARGET_LOCALE);
  if (glossarySelf.has(key)) return false;
  // 1) Explicit "must translate" wins over every exemption below.
  if (config.mustTranslate.has(key)) return true;
  // 2) Exact proper nouns / products.
  if (config.keepExact.has(key)) return false;
  // 3) Acronyms, product links, model prefixes and version strings are data.
  if (
    [...config.acronymPatterns, ...config.modelPatterns, ...config.versionPatterns].some((pattern) =>
      pattern.test(raw),
    ) ||
    config.modelPrefixes.some((prefix) => prefix && key.startsWith(prefix))
  ) {
    return false;
  }
  // 4) Titles the model answered with the English proper noun. The ledger's
  //    `titles[].key` values are `normalize()`d, so compare the same way.
  const titles = options.keptTitles ?? keptTitleKeys();
  if (titles.has(normalize(raw).toLowerCase())) return false;
  // 5) Console-transcript prefixes from `english-only-blocks.yml`.
  const englishOnly = options.englishOnly ?? englishOnlyPrefixes();
  if (englishOnly.some((prefix) => raw.startsWith(prefix))) return false;
  // 6) No policy: leave the structural decision to the caller.
  return null;
}

function frontMatterKeys(frontMatter) {
  return frontMatter
    .split('\n')
    .map((line) => /^([A-Za-z0-9_-]+):/.exec(line)?.[1])
    .filter(Boolean);
}

/**
 * English label a page without `sidebar_label` gets from its sidebar item.
 *
 * The source tree of a locale checkout may still be an older capture that has
 * no front-matter labels (the hub backfills them first). Reading the rendered
 * sidebar keeps the `sidebar_label` assertion version-complete: an archive page
 * whose Next card falls back to an English sidebar item is a real defect, not
 * an absent key that the old "key exists" test quietly accepted.
 */
const sidebarItemLabels = new Map();
export function sidebarItemLabel(section, rel) {
  const version = versionForSection(section.name);
  if (!version) return null;
  let labels = sidebarItemLabels.get(version);
  if (!labels) {
    labels = new Map();
    const file = path.join(REPO, `versioned_sidebars/version-${version}-sidebars.json`);
    if (fs.existsSync(file)) {
      const tree = JSON.parse(fs.readFileSync(file, 'utf8')).docs || [];
      const visit = (items) => {
        for (const item of items || []) {
          if (!item || typeof item !== 'object') continue;
          if (item.type === 'doc' && item.id && typeof item.label === 'string') {
            labels.set(String(item.id).replace(/\/index$/, ''), item.label);
          }
          if (item.type === 'category' && item.link?.id && typeof item.label === 'string') {
            const id = String(item.link.id).replace(/\/index$/, '');
            if (!labels.has(id)) labels.set(id, item.label);
          }
          if (item.items) visit(item.items);
        }
      };
      visit(tree);
    }
    sidebarItemLabels.set(version, labels);
  }
  const id = String(rel).replace(/\.mdx?$/, '').replace(/\/index$/, '');
  return labels.get(id) || null;
}

/**
 * Is a front-matter value actually translated, not just present?
 *
 * The old check only compared key lists, so a `sidebar_label` copied from the
 * English source (or one that never got written and falls back to the sidebar
 * item) passed. `title`/`description` use the same locale-aware wording rule as
 * the prose gate; a label reuses `looksUntranslated`, the planner's own verdict,
 * so a command name or an identifier is not misreported as debt.
 */
export function frontMatterValueVerdict(source, target, {key, locale = DEFAULT_TARGET_LOCALE, rel = ''} = {}) {
  const src = String(source ?? '').trim();
  const dst = String(target ?? '').trim();
  if (!src || !dst) return {miss: false, reason: !src ? 'no-source' : 'absent'};
  // CLI page titles are the command itself; they are policy, not debt.
  if ((key === 'sidebar_label' || key === 'title') && /^cli-reference\//.test(rel)) {
    return {miss: false, reason: 'cli-command'};
  }
  if (key === 'sidebar_label') {
    if (!looksUntranslated(dst, {whitelist: buildWhitelist(locale)})) return {miss: false, reason: 'identifier'};
    return {miss: true, reason: 'english-label'};
  }
  // Product model names, protocol acronyms and the reviewed keep-English list
  // are not translation debt even when the value matches the source.
  if (key === 'title' && !looksUntranslated(src, {whitelist: buildWhitelist(locale)})) {
    return {miss: false, reason: 'identifier'};
  }
  if (
    key === 'title' &&
    (headingTranslationVerdict(src, {locale}) === false ||
      keptTitleKeys().has(src.toLowerCase()))
  ) {
    return {miss: false, reason: 'kept-english'};
  }
  if (normalize(src) === normalize(dst)) return {miss: true, reason: 'identical'};
  if (/^zh/i.test(locale) && !CJK.test(languageText(dst)) && readsEnglish(dst)) {
    return {miss: true, reason: 'english'};
  }
  return {miss: false, reason: 'translated'};
}

/** Prose blocks that are byte-identical to the English source and read English. */
export function untranslated(sourceBody, targetBody) {
  const {prose, admonitions} = untranslatedBlocks(sourceBody, targetBody);
  return [...prose, ...admonitions.map((item) => item.text)];
}

/**
 * Admonition blocks (`:::note … :::`) whose title or body still reads English.
 *
 * The prose rule above requires an uppercase sentence, which an admonition body
 * usually is not — its first word may be a command path or lowercase — so the
 * language test is a Chinese-character ratio plus the same English function-word
 * evidence, applied to the title and body only (the `:::` container is not text).
 */
export function untranslatedAdmonitions(sourceBody, targetBody) {
  return untranslatedBlocks(sourceBody, targetBody).admonitions;
}

/**
 * English units still inside a translated admonition.
 *
 * A whole-container test was blind to the failure the manual actually had: a
 * `:::note` with two paragraphs came back with the first paragraph in English
 * and the second in Chinese, so the container "carried Chinese" and every
 * counter stayed at zero. The unit is now the title and each body paragraph,
 * and a unit only counts when it is byte-identical (modulo whitespace) to the
 * English source's own unit: that is a paragraph the translation never touched,
 * not a legal statement the pipeline keeps in English on purpose.
 *
 * An admonition with no English counterpart keeps the old whole-container rule.
 */
/**
 * A body paragraph that is only a list of named products.
 *
 * The Hardware Guides open most chapters with `:::info This article covers`
 * followed by `- **CRS109-8G-1S-2HnD-IN**`. Those are model names, not prose:
 * translating them would rename the product, so they are excluded from the
 * English count instead of being queued forever.
 */
function isProductList(text) {
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  return lines.every(
    (line) =>
      /^[-*+]\s+\*\*[^*]+\*\*(\s*\([^)]*\))?$/.test(line) ||
      /^[-*+]\s+\[[^\]]+\]\([^)]*\)(\s*\([^)]*\))?$/.test(line),
  );
}

function englishAdmonitionParts(parts, sourceParts, fenced = new Set()) {
  if (!sourceParts) {
    const inner = [parts.title, ...bodyParagraphs(parts.body).filter((text) => !fenced.has(text))]
      .filter(Boolean)
      .join('\n');
    return readsEnglish(inner) ? [inner] : [];
  }
  const translated = (text) => readsEnglish(text);
  // Compare the words, not the link labels: the overlay's labels are rewritten
  // to Chinese before `verify` ever sees the page, and requiring the raw bytes
  // to match the English source hid every paragraph whose only translated part
  // was a label (the `storage/ramdisk` warning).
  const words = (text) => normalize(languageText(text));
  const fromSource = (text) =>
    bodyParagraphs(sourceParts.body).some((candidate) => words(candidate) === words(text)) ||
    (sourceParts.title && words(sourceParts.title) === words(text));
  const out = [];
  if (parts.title && translated(parts.title) && fromSource(parts.title)) out.push(parts.title);
  for (const paragraph of bodyParagraphs(parts.body)) {
    // A command sample inside the warning is copied verbatim, so it always looks
    // "identical to the English source". Counting it would keep every fenced
    // admonition at one untranslated unit forever.
    if (fenced.has(paragraph)) continue;
    if (isProductList(paragraph)) continue;
    if (translated(paragraph) && fromSource(paragraph)) out.push(paragraph);
  }
  return out;
}

/** Strip an explicit Docusaurus heading id (`### Title {#the-id}`). */
function stripHeadingAnchor(line) {
  return String(line)
    .replace(/\s*\{#[^}]*\}\s*$/, '')
    .trim();
}

/**
 * Is a heading line human language rather than a CLI path?
 *
 * The data-driven policy is consulted first: a self-mapping in the locale's own
 * `config/glossary/<locale>.yml` is an outright exemption (and outranks
 * `must_translate`), then `config/technical-headings.yml`'s `must_translate`
 * forces a verdict of "should translate" (even for a word the structural rules
 * would have rejected), while `keep_exact`, the acronym/model/version patterns,
 * the keep-English title ledger and the console prefixes are exemptions in that
 * exact order — see `headingTranslationVerdict`. Only when no data file has an
 * opinion (`null`) do the structural rules below apply.
 *
 * `isTranslatableProse` excludes *every* single-token heading (`## ip/media`
 * and `## Configuration` alike), which would keep the very titles this check
 * exists for invisible. Multi-word titles reuse `isTranslatableProse` so its
 * structural exclusions stay in one place; a single-word title is accepted
 * when it starts with a capital and is not a model/identifier (a digit-bearing
 * token such as `RB5009UG` is data).
 */
function isTranslatableHeading(line, options = {}) {
  const match = /^\s{0,3}#{1,6}\s+(.+?)\s*$/.exec(String(line));
  if (!match) return false;
  const heading = stripHeadingAnchor(match[1]);
  if (!heading || CJK.test(languageText(heading))) return false;
  const policy = headingTranslationVerdict(heading, options);
  if (policy !== null) return policy;
  if (/^[a-z0-9/._-]+$/.test(heading)) return false;
  if (/^[A-Za-z0-9./_+:-]+$/.test(heading) && /\d/.test(heading)) return false;
  if (/\s/.test(heading)) return isTranslatableProse(heading);
  return /^[A-Z]/.test(heading) && /[A-Za-z]{2,}/.test(heading);
}

/**
 * Case-insensitive heading identity.
 *
 * A target that differs from the source only by letter case (`Wash` vs `WASH`,
 * `NAT` vs `nat`) is the *same* English headline, not a translation. The old
 * `normalize()` comparison was case-sensitive, so it missed exactly that drift
 * while `pending` queued the title — the two counters disagreed. Policy
 * exemptions still run earlier in `isTranslatableHeading`, so a technical title
 * in `keep_exact` (or the acronym/model patterns) is never counted here.
 */
function sameHeadingIgnoringCase(a, b) {
  return normalize(a).toLowerCase() === normalize(b).toLowerCase();
}

function englishHeadings(block, sourceBlock, options = {}) {
  const isHeading = (line) => /^\s{0,3}#{1,6}\s/.test(line);
  const lines = String(block).split('\n').filter((line) => line.trim() !== '');
  const headings = lines.filter(isHeading);
  if (headings.length === 0) return [];
  const sourceHeadings = String(sourceBlock ?? '')
    .split('\n')
    .filter(isHeading)
    .map((line) => stripHeadingAnchor(line.trim()));
  const out = [];
  headings.forEach((line, index) => {
    const clean = stripHeadingAnchor(line.trim());
    if (!isTranslatableHeading(clean, options)) return;
    const text = clean.replace(/^\s{0,3}#{1,6}\s+/, '').trim();
    if (!text || CJK.test(languageText(text))) return;
    // The headline must be the source's own headline: a brand-new English
    // heading added by the overlay is a different (editorial) problem.
    const sourceHeading = sourceHeadings[index];
    if (sourceHeading === undefined || !sameHeadingIgnoringCase(sourceHeading, clean)) return;
    out.push(text.slice(0, 80));
  });
  return out;
}

/**
 * Detect an overlay that grew far beyond its English source.
 *
 * The old word test compared ASCII words on both sides, so a Chinese overlay
 * (~0 ASCII words) could never trip it: the check only fired when the block
 * count grew. The source side still counts ASCII words (`[A-Za-z]+` over prose
 * with link labels removed), but the target side now scores CJK characters and
 * ASCII words together:
 *
 *   targetScore = cjkChars + asciiWords * 1.0
 *   inflated when sourceWords > 0 && targetScore > sourceWords * RATIO + MARGIN
 *
 * Chinese is denser than English (one Han character typically carries only
 * part of an English word), and a faithful 100-word page usually comes back as
 * roughly 150-220 Han characters, so RATIO = 3.0 / MARGIN = 20 tolerates normal
 * compression while still flagging an 8x expansion (100 -> 800 characters).
 * Both numbers come from `loadTechnicalHeadings().inflation` and can be
 * overridden in `config/technical-headings.yml` without touching this code.
 * The block-count condition is kept as a complementary signal: a translation
 * split into many more paragraphs is suspicious even with a small score.
 */
export function overlayInflation(sourceBody, targetBody, options = {}) {
  const fencedTexts = new Set(
    [...fences(sourceBody), ...fences(targetBody)].map((fence) => fence.trim()),
  );
  // Count *all* non-code prose blocks, translated ones included: a Chinese
  // overlay that grew from 2 paragraphs to 6 must trip the block test even
  // though it carries no ASCII words at all.
  const proseSpans = (body) =>
    splitBlockSpans(body).filter((span) => !span.code && !fencedTexts.has(span.text));
  const sourceSpans = proseSpans(sourceBody);
  const overlaySpans = proseSpans(targetBody);
  const textOf = (spans) => spans.map((span) => languageText(span.text)).join('\n');
  const wordCount = (text) => (text.match(/[A-Za-z]+/g) || []).length;
  const sourceBlocks = sourceSpans.length;
  const overlayBlocks = overlaySpans.length;
  const sourceWords = wordCount(textOf(sourceSpans));
  const overlayWords = wordCount(textOf(overlaySpans));
  const cjkChars = cjkCount(textOf(overlaySpans));
  const targetScore = cjkChars + overlayWords;
  const {ratio, margin} = options.thresholds ?? loadTechnicalHeadings().inflation;
  const inflated =
    (overlayBlocks > sourceBlocks * 1.3 && overlayBlocks >= sourceBlocks + 2) ||
    (sourceWords > 0 && targetScore > sourceWords * ratio + margin);
  return {inflated, sourceBlocks, overlayBlocks, sourceWords, overlayWords, cjkChars, targetScore, ratio, margin};
}

/**
 * Split the English-vs-overlay comparison into prose and admonition misses.
 *
 * Both lists are index-aligned with `splitBlocks`, which keeps an admonition as
 * one block even when its title and body are separated by a blank line.
 */
export function untranslatedBlocks(sourceBody, targetBody, options = {}) {
  // `splitBlockSpans` carries the `code` verdict of the *containing body*, so a
  // fragment that starts inside a fence stays code while an admonition that
  // merely shows a command is prose. Splitting on the block text alone cannot
  // tell those apart.
  const source = splitBlockSpans(sourceBody);
  const target = splitBlockSpans(targetBody);
  const prose = [];
  const admonitions = [];
  const untranslatedHeadings = [];
  const fenced = {total: 0, untranslated: 0};
  for (let i = 0; i < Math.min(source.length, target.length); i++) {
    const span = target[i];
    const block = span.text;
    if (span.code) continue;
    // `### Title {#id}` used to be skipped by the `#` guard below, so an
    // untouched English heading never reached the counter. Headings are a
    // separate unit: CLI-path headings are excluded by `isTranslatableHeading`.
    const headings = englishHeadings(block, source[i]?.text ?? '', options);
    if (headings.length) untranslatedHeadings.push(...headings);
    const nonEmptyLines = block.split('\n').filter((line) => line.trim() !== '');
    if (headings.length === nonEmptyLines.length && nonEmptyLines.length > 0) continue;
    const parts = splitAdmonitions(block);
    if (parts && parts.tail !== '') {
      // A warning that shows a command keeps that command byte for byte; only
      // its title and prose paragraphs are language. The counters are split so
      // "the fenced warnings" have a number of their own.
      const fencedParagraphs = codeParagraphs(parts.body);
      const fencedBlock = hasFence(block);
      if (fencedBlock) fenced.total += 1;
      const english = englishAdmonitionParts(
        parts,
        splitAdmonitions(source[i]?.text ?? ''),
        fencedParagraphs,
      );
      if (english.length) {
        admonitions.push({
          block: block.trim(),
          text: english[0].trim().replace(/\s+/g, ' ').slice(0, 80),
        });
        if (fencedBlock) fenced.untranslated += 1;
      }
      continue;
    }
    // A block whose only translated part is a link label is not translated:
    // compare and language-test the words outside the labels.
    const words = languageText(block);
    const sourceWords = languageText(source[i].text);
    if (CJK.test(words) || normalize(words) !== normalize(sourceWords)) continue;
    const head = words.trim();
    // A `|`-leading block is a pipe table. It used to be skipped here, which
    // made a page whose whole table is still English report zero pending prose.
    // Table rows are real language, so they must be visible to `translate:pending`
    // and to the verifier; only the true non-prose leads stay excluded.
    if (!head || /^[<#`!]/.test(head)) continue;
    const tokens = head.match(/[A-Za-z]{2,}/g) || [];
    const flat = head.replace(/\s+/g, ' ');
    const sentence = tokens.length >= 5 && ENGLISH.test(head) && PROSE.test(flat);
    const leadIn = tokens.length >= 3 && LEAD_IN.test(flat);
    if (sentence || leadIn) {
      prose.push(block.trim().slice(0, 80));
    }
  }
  return {prose, admonitions, fenced, untranslatedHeadings};
}

/**
 * Compare one fence block (fence lines included).
 *
 * The source decides which lines are comment slots. A comment slot may hold
 * Chinese; if it still holds the English text it is counted as untranslated;
 * if it changed without becoming Chinese, that is a real defect.
 */
export function compareFence(sourceFence, targetFence) {
  const sourceLines = sourceFence.split('\n');
  const targetLines = targetFence.split('\n');
  const out = {code: [], commentDiff: [], untranslated: []};
  if (sourceLines.length !== targetLines.length) {
    out.code.push(`lines ${sourceLines.length}->${targetLines.length}`);
    return out;
  }
  const closer = /^\s*[`~]{3,}\s*$/.test(sourceLines[sourceLines.length - 1] || '');
  const inner = sourceLines.slice(1, sourceLines.length - (closer ? 1 : 0));
  // Only a fence in a comment language can carry a translated comment; every
  // other fence is compared line by line as code.
  const opener = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:`{3,}|~{3,})\s*([^\s]*)/.exec(sourceLines[0] || '');
  const language = normalizeLanguage(opener?.[1]);
  const roles = isCommentLanguage(language)
    ? fenceRoles(inner)
    : inner.map(() => ({role: 'code'}));
  for (let i = 0; i < sourceLines.length; i++) {
    const role = i > 0 ? roles[i - 1] : null;
    const target = targetLines[i];
    if (!role || role.role !== 'comment') {
      if (target !== sourceLines[i]) {
        out.code.push(`line ${i + 1} changed: ${JSON.stringify(sourceLines[i].slice(0, 40))}`);
      }
      continue;
    }
    const parsed = parseCommentLine(target);
    if (!parsed) {
      out.commentDiff.push(`line ${i + 1} is no longer a comment`);
      continue;
    }
    if (parsed.hashes !== role.parsed.hashes || parsed.space !== role.parsed.space) {
      out.commentDiff.push(`line ${i + 1} comment shape changed`);
    }
    if (CJK.test(parsed.text)) continue;
    if (parsed.text.trim() === role.parsed.text.trim()) {
      out.untranslated.push(role.parsed.text.trim().slice(0, 60));
    } else {
      out.commentDiff.push(`line ${i + 1} changed but is not Chinese`);
    }
  }
  return out;
}

/**
 * Docusaurus never hands raw markdown to MDX. Its loader preprocesses the file
 * first (`@docusaurus/mdx-loader/lib/preprocessor.js`): `unwrapMdxCodeBlocks`,
 * then `escapeMarkdownHeadingIds` whenever `mdx1Compat.headingIds` is on, which
 * is the v3 default. That second step rewrites the classic `### Title {#id}`
 * extension to `### Title \{#id}`, and the `remark/headings` plugin turns the
 * escaped text back into a heading id. Compiling without it makes every explicit
 * heading id look like JSX, which is exactly the "Could not parse expression
 * with acorn" flood.
 *
 * Mirroring the preprocessor keeps this check faithful to the real build while
 * still failing on genuine MDX syntax errors: only `{#` in heading lines moves,
 * and the text is only used for the compile, never for the other checks.
 */
function escapeHeadingIds(text) {
  // Same expression as @docusaurus/utils: one to six line-leading `#` markers
  // open a heading, and no seventh `#` may follow them.
  return text.replace(/(?:^|\n)#{1,6}(?!#).*/g, (line) =>
    line
      .replace('{#', '\\{#')
      // An id that is already escaped must not be escaped twice.
      .replace('\\\\{#', '\\{#'),
  );
}

let mdxPreprocessPromise;
function mdxPreprocess() {
  mdxPreprocessPromise ??= import('@docusaurus/utils')
    .then((utils) =>
      typeof utils.escapeMarkdownHeadingIds === 'function' && typeof utils.unwrapMdxCodeBlocks === 'function'
        ? (text) => utils.escapeMarkdownHeadingIds(utils.unwrapMdxCodeBlocks(text))
        : escapeHeadingIds,
    )
    // The fallback keeps the check working if the internal package is ever
    // reshuffled; the rewrite above is the part that matters for parsing.
    .catch(() => escapeHeadingIds);
  return mdxPreprocessPromise;
}

/**
 * Compile one document the way the Docusaurus build parses it: preprocess, then
 * MDX. Throws on real MDX errors. `verify` and the negative self-test share it,
 * so they cannot drift apart.
 */
export async function compileMdxDocument(text) {
  const {compileSync} = await import('@mdx-js/mdx');
  const preprocess = await mdxPreprocess();
  compileSync(preprocess(text), {format: 'mdx'});
}

/**
 * Configured targets that already have a resource on disk (`i18n/<locale>/`,
 * glossary, patches or TM). `--all-locales` uses this so a locale that is only
 * a name so far is not reported as 1,484 missing overlays.
 */
export function resourceLocales() {
  return translatableLocales().filter((locale) => localeHasResources(locale));
}

/** A section record for a locale with no resources: nothing exists to compare. */
function emptyStat() {
  return {
    sources: 0,
    overlays: 0,
    missing: [],
    extra: [],
    fenceDiff: [],
    commentDiff: [],
    commentUntranslated: 0,
    imageDiff: [],
    frontMatterDiff: [],
    frontMatterEnglish: 0,
    untranslated: 0,
    untranslatedAdmonitions: 0,
    untranslatedHeadings: 0,
    descriptionEnglish: 0,
    overlayInflation: 0,
    anchorMismatch: 0,
    fencedAdmonitions: {total: 0, untranslated: 0},
    emptyOverlays: [],
    intentionalEnglish: 0,
  };
}

export async function verify({compile = true, locale = DEFAULT_TARGET_LOCALE} = {}) {
  const report = {
    locale,
    sections: {},
    problems: [],
    mdxErrors: [],
    untranslatedSamples: [],
    commentSamples: [],
    admonitionSamples: [],
    headingSamples: [],
    descriptionSamples: [],
    frontMatterSamples: [],
    inflationSamples: [],
    anchorSamples: [],
  };
  let totalFences = 0;

  const sections = sectionsFor(locale);
  // A locale with no resource is only a naming convention: every overlay is
  // absent, which is the expected state, not 1,484 missing pages. Report zeroes
  // so `verify --locale=<tag>` remains a valid read-only probe.
  const noResources = !localeHasResources(locale);
  report.noResources = noResources;

  const englishOnly = englishOnlyPrefixes();
  for (const section of sections) {
    if (noResources) {
      report.sections[section.name] = emptyStat();
      continue;
    }
    let intentionalEnglish = 0;
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    const sources = walkMarkdown(sourceBase);
    const overlays = new Map(walkMarkdown(overlayBase).map((file) => [relative(overlayBase, file), file]));
    const stat = {sources: sources.length, overlays: overlays.size, missing: [], extra: [], fenceDiff: [], commentDiff: [], commentUntranslated: 0, imageDiff: [], frontMatterDiff: [], frontMatterEnglish: 0, untranslated: 0, untranslatedAdmonitions: 0, untranslatedHeadings: 0, descriptionEnglish: 0, overlayInflation: 0, anchorMismatch: 0, fencedAdmonitions: {total: 0, untranslated: 0}, emptyOverlays: []};

    for (const sourcePath of sources) {
      const rel = relative(sourceBase, sourcePath);
      const overlayPath = overlays.get(rel);
      const source = fs.readFileSync(sourcePath, 'utf8');
      const {frontMatter: sourceFm, body: sourceBody} = splitFrontMatter(source);
      if (!overlayPath) {
        stat.missing.push(rel);
        continue;
      }
      overlays.delete(rel);
      const target = fs.readFileSync(overlayPath, 'utf8');
      const {frontMatter: targetFm, body: targetBody} = splitFrontMatter(target);

      const sourceFences = fences(sourceBody);
      const targetFences = fences(targetBody);
      totalFences += sourceFences.length;
      if (sourceFences.length !== targetFences.length) {
        stat.fenceDiff.push(`${rel} ${sourceFences.length}->${targetFences.length}`);
      } else {
        for (let index = 0; index < sourceFences.length; index++) {
          const comparison = compareFence(sourceFences[index], targetFences[index]);
          if (comparison.code.length) {
            stat.fenceDiff.push(`${rel} fence#${index + 1} ${comparison.code[0]}`);
          }
          for (const item of comparison.commentDiff) {
            stat.commentDiff.push(`${rel} fence#${index + 1} ${item}`);
          }
          stat.commentUntranslated += comparison.untranslated.length;
          if (comparison.untranslated.length && report.commentSamples.length < 10) {
            report.commentSamples.push(`${rel}: ${comparison.untranslated[0]}`);
          }
        }
      }

      // `/img/<hash>` is the content-addressed form of `static/img/<hash>`; the
      // English page and its overlay must compare as the same file even when one
      // side still points at a page-relative `./img/x`.
      const resolve = (base, url) =>
        /^(?:[a-z]+:|\/|#)/i.test(url)
          ? url.startsWith('/img/')
            ? path.join(REPO, 'static', url)
            : url
          : path.resolve(base, url);
      const sourceImages = images(sourceBody).map((url) =>
        resolve(path.dirname(sourcePath), url),
      );
      const targetImages = images(targetBody).map((url) =>
        resolve(path.dirname(overlayPath), url),
      );
      if (sourceImages.join('|') !== targetImages.join('|')) {
        stat.imageDiff.push(`${rel} ${sourceImages.length}->${targetImages.length}`);
      }

      // A page whose English has a body but whose overlay is empty renders as a
      // blank page, and every other counter here stays at zero because there is
      // nothing to compare block by block.
      if (sourceBody.trim() && !targetBody.trim()) stat.emptyOverlays.push(rel);
      const missingKeys = frontMatterKeys(sourceFm).filter((key) => !frontMatterKeys(targetFm).includes(key));
      if (missingKeys.length) stat.frontMatterDiff.push(`${rel} missing:${missingKeys.join(',')}`);

      // A key is not evidence of translation. Check the value against the
      // locale, and include archived pages whose English source has no label by
      // resolving the label from the sidebar item (the text Docusaurus shows).
      const translatedTitle = CJK.test(readField(targetFm, 'title') || '');
      const expectedLabel =
        readField(sourceFm, 'sidebar_label') || sidebarItemLabel(section, rel);
      // Whole-page exclusions are required to stay in the source language; a
      // front-matter value in English there is policy, not missing work.
      const frontMatterExcluded = isTranslationExcluded(section, rel);
      const frontMatterChecks = frontMatterExcluded
        ? []
        : [['title', readField(sourceFm, 'title'), readField(targetFm, 'title')]];
      if (!frontMatterExcluded && translatedTitle && expectedLabel) {
        frontMatterChecks.push([
          'sidebar_label',
          expectedLabel,
          readField(targetFm, 'sidebar_label'),
        ]);
      }
      for (const [key, sourceValue, targetValue] of frontMatterChecks) {
        const verdict = frontMatterValueVerdict(sourceValue, targetValue, {key, locale, rel});
        if (!verdict.miss) continue;
        stat.frontMatterEnglish += 1;
        stat.frontMatterDiff.push(`${rel} ${key}:${verdict.reason}`);
        if (report.frontMatterSamples.length < 10) {
          report.frontMatterSamples.push(`${rel} ${key}:${verdict.reason}`);
        }
      }

      // The key can be present while its value is still the English source's.
      // Model-dense values and the config whitelist are legal English.
      const description = descriptionVerdict(
        readField(sourceFm, 'description'),
        readField(targetFm, 'description'),
        englishOnly,
      );
      if (description.miss) {
        stat.descriptionEnglish += 1;
        if (report.descriptionSamples.length < 10) {
          report.descriptionSamples.push(`${rel}: ${description.reason}`);
        }
      } else if (description.reason.startsWith('intentional')) {
        intentionalEnglish += 1;
      }

      // Overlay paragraphs that far outgrow the source are an expansion, not a
      // translation. Keep the source/target bodies available for this check.
      const inflation = overlayInflation(sourceBody, targetBody);
      if (inflation.inflated) {
        stat.overlayInflation += 1;
        if (report.inflationSamples.length < 10) {
          report.inflationSamples.push(
            `${rel}: blocks ${inflation.sourceBlocks}->${inflation.overlayBlocks}, ` +
              `sourceWords ${inflation.sourceWords}->targetScore ${inflation.targetScore} ` +
              `(cjk ${inflation.cjkChars}, ascii ${inflation.overlayWords})`,
          );
        }
      }

      // A translated heading must publish the English id at the same position,
      // otherwise every `#english-fragment` link to it dies silently. Compare
      // the id the overlay actually publishes (explicit `{#id}` or the
      // Docusaurus-generated slug of the rendered Chinese text) with the id the
      // English source publishes at that paired position.
      const anchorMisses = anchorMismatches(targetBody, sourceBody);
      if (anchorMisses.length) {
        stat.anchorMismatch += anchorMisses.length;
        for (const miss of anchorMisses) {
          if (report.anchorSamples.length >= 20) break;
          report.anchorSamples.push(
            `${rel}:${miss.line} heading=${miss.text.slice(0, 48)} ` +
              `published=${JSON.stringify(miss.actual)} expected=${JSON.stringify(miss.expected)}`,
          );
        }
      }

      // A whole-page exclusion (config/translation-exclusions.yml, e.g. the
      // official multilingual Quick Guides) is deliberately kept in English.
      // Reuse the planner's predicate so those pages are not counted as debt
      // by the new prose gate; no product slug is hardcoded here.
      const translationExcluded = isTranslationExcluded(section, rel);
      const {prose, admonitions, fenced, untranslatedHeadings} = untranslatedBlocks(sourceBody, targetBody);
      stat.fencedAdmonitions.total += fenced.total;
      stat.fencedAdmonitions.untranslated += fenced.untranslated;
      const kept = (text) => {
        if (englishOnly.some((prefix) => text.startsWith(prefix))) {
          intentionalEnglish++;
          return false;
        }
        return true;
      };
      const misses = translationExcluded ? [] : prose.filter(kept);
      // A whole-page exclusion keeps its headings and admonitions in English
      // too, not just its prose. Counting only prose here used to report 240
      // deliberately-English Quick Guide headings and 173 warning bodies as
      // translation debt on an excluded page.
      const admonitionMisses = translationExcluded ? [] : admonitions.filter((item) => kept(item.text));
      const headingMisses = translationExcluded ? [] : untranslatedHeadings.filter(kept);
      stat.untranslated += misses.length;
      stat.untranslatedAdmonitions += admonitionMisses.length;
      stat.untranslatedHeadings += headingMisses.length;
      if (misses.length && report.untranslatedSamples.length < 10) {
        report.untranslatedSamples.push(`${rel}: ${misses[0]}`);
      }
      if (admonitionMisses.length && report.admonitionSamples.length < 10) {
        report.admonitionSamples.push(`${rel}: ${admonitionMisses[0].text}`);
      }
      if (headingMisses.length && report.headingSamples.length < 10) {
        report.headingSamples.push(`${rel}: ${headingMisses[0]}`);
      }

      if (compile) {
        // Compare against the source: a page the English build itself cannot
        // compile in isolation (Docusaurus adds plugins) is not a translation bug.
        let sourceOk = true;
        try {
          await compileMdxDocument(source);
        } catch {
          sourceOk = false;
        }
        if (sourceOk) {
          try {
            await compileMdxDocument(target);
          } catch (error) {
            report.mdxErrors.push(`${rel}: ${String(error.message).split('\n')[0]}`);
          }
        }
      }
    }

    stat.extra = [...overlays.keys()];
    stat.intentionalEnglish = intentionalEnglish;
    report.sections[section.name] = stat;
  }

  report.totalFences = totalFences;
  report.summary = Object.fromEntries(
    Object.entries(report.sections).map(([name, stat]) => [
      name,
      {
        sources: stat.sources,
        overlays: stat.overlays,
        missing: stat.missing.length,
        extra: stat.extra.length,
        fenceDiff: stat.fenceDiff.length,
        commentDiff: stat.commentDiff.length,
        commentUntranslated: stat.commentUntranslated,
        imageDiff: stat.imageDiff.length,
        frontMatterDiff: stat.frontMatterDiff.length,
        frontMatterEnglish: stat.frontMatterEnglish,
        emptyOverlays: stat.emptyOverlays.length,
        untranslatedBlocks: stat.untranslated,
        untranslatedAdmonitions: stat.untranslatedAdmonitions,
        untranslatedHeadings: stat.untranslatedHeadings,
        descriptionEnglish: stat.descriptionEnglish,
        overlayInflation: stat.overlayInflation,
        anchorMismatch: stat.anchorMismatch,
        fencedAdmonitions: stat.fencedAdmonitions.total,
        fencedAdmonitionsEnglish: stat.fencedAdmonitions.untranslated,
        intentionalEnglish: stat.intentionalEnglish,
      },
    ]),
  );
  // A single aggregate counter so a CI step can assert on admonitions without
  // reading every section; it is non-zero whenever any warning body is English.
  report.totals = {
    // Prose blocks still in English. This counter used to live only in
    // `summary[section]`, so a run with clean headings/descriptions/anchors
    // exited 0 with thousands of untranslated blocks. Whole-page exclusions
    // are already deducted in the loop above.
    untranslatedBlocks: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.untranslated,
      0,
    ),
    untranslatedAdmonitions: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.untranslatedAdmonitions,
      0,
    ),
    // Headings, description metadata and expansion are the three blind spots
    // the old gate had. They live in `totals` so `index.mjs` can fail the run
    // from one place without reading every per-section summary.
    untranslatedHeadings: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.untranslatedHeadings,
      0,
    ),
    descriptionEnglish: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.descriptionEnglish,
      0,
    ),
    overlayInflation: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.overlayInflation,
      0,
    ),
    // A heading whose published id differs from the English id breaks every
    // `#english-fragment` link to it. This is a hard gate, like an MDX error.
    anchorMismatch: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.anchorMismatch,
      0,
    ),
    // Fenced warnings are reported separately: they used to be invisible (the
    // whole block was classified as code), so a run could say "0 untranslated"
    // while every warning with a command sample was still English.
    fencedAdmonitions: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.fencedAdmonitions.total,
      0,
    ),
    fencedAdmonitionsEnglish: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.fencedAdmonitions.untranslated,
      0,
    ),
  };
  return report;
}
