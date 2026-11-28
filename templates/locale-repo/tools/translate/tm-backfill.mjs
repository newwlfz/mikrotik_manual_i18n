#!/usr/bin/env node
/**
 * BACKFILL the canonical translation memory into every version overlay.
 *
 * The explicit arbitration in lib/tm.mjs picks the oldest-version wording for
 * every English string. When several version overlays differ, the backfill writes
 * that canonical wording into all of them.
 *
 *   node tools/translate/tm-backfill.mjs [--section=NAME] [--locale=NAME] [--json] [--list-files]
 *   node tools/translate/tm-backfill.mjs --apply [--section=NAME] [--samples=N] [--json]
 *   node tools/translate/tm-backfill.mjs --list-bad-tm [--json]        # read-only TM audit
 *   node tools/translate/tm-backfill.mjs --list-polluted-tm [--json]   # read-only polluted-title audit (gate)
 *   node tools/translate/tm-backfill.mjs --clean-polluted [--apply] [--json]
 *   node tools/translate/tm-backfill.mjs --seed-from-overlays=DIR --keys=MANIFEST [--apply] [--json]
 *   node tools/translate/tm-backfill.mjs --repair-fences --apply       # restore fenced CODE lines
 *   node tools/translate/tm-backfill.mjs --repair-anchors [--apply] [--section=NAME]
 *
 * `--list-polluted-tm` is a gate: it exits 1 while any polluted title entry is
 * present. `--clean-polluted --apply` and `--seed-from-overlays --apply` write
 * small, fixed-name shards under work/translate/shards/ (shards replay after the
 * baseline, so a shard overrides an older polluted value). Both are idempotent.
 *
 * DEFAULT IS READ-ONLY. `--apply` is the only switch that writes; `--dry-run`
 * forces analysis even when `--apply` is present. A `--section=docs-7.24` run
 * touches one overlay only.
 *
 * The dangerous part of a backfill is that the winning wording often comes from
 * an OLD section: its prose can carry `/docs/7.24/...` links while the page it is
 * copied into is `docs/` (current, `/docs/...`) or `docs-7.25/`
 * (`/docs/7.25/...`). `--apply` therefore retargets those links, and only those
 * links, before writing. Images, PDFs, assets, relative links, external hosts and
 * fenced code are left byte-for-byte alone.
 *
 * Every write is guarded: target must exist and be a regular file, the overlay
 * front matter/blocks must parse, and a candidate that would drop an image, a
 * component or a fence is skipped. Legacy guards added after the first backfill:
 * a glued CJK/ASCII token (`ex埠`, `sup埠@`, `日誌in`), a short block turning into
 * a long paragraph (hardware `第一次使用` misalignment), a file whose score would
 * cross verify's 3.0/20 inflation threshold (changelog), and any line INSIDE a
 * fenced sample are all refused and counted in `skipped`. Writes are atomic.
 * Running `--apply` twice is idempotent: the second run sees nothing left to change.
 * Bad tokens originate in `lib/tm.mjs` glossary lookup, which now protects
 * identifiers; raw TM entries are clean (verified by `--list-bad-tm`).
 *
 * Fixture/audit helpers (never needed for a normal repository run):
 *   --root=DIR      read overlays from an other checkout (temp copy for a test)
 *   --work-dir=DIR  read shards / comment memory from another work directory
 *
 * No LLM is invoked here.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  WORKSPACE,
  WORK_DIR,
  assertTranslationLocale,
  relative,
  sectionsFor,
  walkMarkdown,
  writeFileAtomic,
} from './lib/paths.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {
  alignBlocks,
  componentTagCount,
  fenceMask,
  imageTagCount,
  isCodeBlock,
  isImageBlock,
  isStructuralBlock,
  isTagOnlyBlock,
  normalize,
  splitBlockSpans,
  splitBlocks,
  isTranslatableProse,
} from './lib/blocks.mjs';
import {
  blockKey,
  createGlobalTm,
  hasGluedToken,
  lookupBlock,
  lookupBlockLines,
  sectionVersion,
} from './lib/tm.mjs';
import {
  loadModelMemory,
  writeMemoryShard,
} from './lib/model-memory.mjs';
import {compareFence, fences} from './lib/verify.mjs';
import {
  addHeadingAnchors,
  headingPairs,
  headings,
  headingIds,
  retargetAnchorFragments,
} from './lib/anchors.mjs';
import {sha256Hex} from './lib/digest.mjs';
import {currentVersion, versionForSection} from '../sync/lib/versions.mjs';

const argv = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split('=');
      return [key, rest.length ? rest.join('=') : true];
    }),
);
const str = (value, fallback = null) => (typeof value === 'string' && value !== '' ? value : fallback);
const locale = str(argv.locale, DEFAULT_TARGET_LOCALE);
const only = str(argv.section);
const root = path.resolve(str(argv.root, REPO));
const workDir = str(argv['work-dir']);
const apply = argv.apply === true && argv['dry-run'] !== true;
const samplesPerFile = Math.max(0, Number(str(argv.samples, '2')) || 0);
const json = argv.json === true;
// Audit/repair helpers. All are explicit: the default run never writes them.
const listBadTm = argv['list-bad-tm'] === true;
const listPollutedTm = argv['list-polluted-tm'] === true;
const cleanPolluted = argv['clean-polluted'] === true;
const seedFromOverlays = str(argv['seed-from-overlays']);
const seedKeys = str(argv.keys);
const repairFences = argv['repair-fences'] === true;
const repairAnchors = argv['repair-anchors'] === true;

const allSections = sectionsFor(locale);
const sections = allSections.filter((section) => !only || section.name === only);
if (sections.length === 0) {
  const names = allSections.map((section) => section.name).join(', ');
  process.stderr.write(`tm-backfill: unknown --section=${only}; expected ${names}\n`);
  process.exit(2);
}

const blocks = (text) =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

/** Exact body tokens (blocks plus the whitespace that separated them). */
function bodyTokens(body) {
  const tokens = [];
  const separator = /\n\s*\n/g;
  let cursor = 0;
  let match;
  while ((match = separator.exec(body)) !== null) {
    tokens.push({separator: false, value: body.slice(cursor, match.index)});
    tokens.push({separator: true, value: match[0]});
    cursor = match.index + match[0].length;
  }
  tokens.push({separator: false, value: body.slice(cursor)});
  return tokens;
}

/** `docs-7.24` / `v7.24` / `[7, 24]` -> `7.24`; versionless -> null. */
function versionString(value) {
  if (Array.isArray(value)) return value.length ? value.join('.') : null;
  const text = String(value ?? '');
  const fromName = sectionVersion(text);
  if (fromName) return fromName.join('.');
  const bare = /^(?:v)?(\d+(?:\.\d+)*)$/.exec(text);
  return bare ? bare[1] : null;
}

/**
 * Route prefix of a release, derived from the repository's own version plan:
 * current -> `/docs/`, archives -> `/docs/<version>/`.
 */
function routePrefix(version) {
  return version ? `/docs/${version}/` : '/docs/';
}

const ASSET_URL =
  /\.(?:pdf|png|jpe?g|gif|webp|svg|ico|bmp|avif|zip|tgz|gz|tar|rar|7z|mp3|mp4|webm|mov|woff2?|ttf|eot|otf|css|js|map)(?:[?#].*)?$/i;
const MARKDOWN_LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g;
const HTML_HREF = /(<a\b[^>]*?\bhref\s*=\s*)(["'])([^"']*)\2/gi;
const OFFICIAL_HOST = /^https?:\/\/manual\.mikrotik\.com\//i;

/** Rewrite one link URL only when it starts at the stale version's docs prefix. */
function rewriteUrl(url, from, to) {
  if (!url || /^(?:#|data:|mailto:|tel:)/i.test(url) || ASSET_URL.test(url)) return url;
  const fromPrefix = routePrefix(from);
  const toPrefix = routePrefix(to);
  if (fromPrefix === toPrefix) return url;
  if (url.startsWith(fromPrefix)) return `${toPrefix}${url.slice(fromPrefix.length)}`;
  const official = OFFICIAL_HOST.exec(url);
  if (official) {
    // Keep the scheme+host; the remaining pathname starts with `/docs/...`.
    const host = official[0].replace(/\/$/, '');
    const rest = url.slice(host.length);
    if (rest.startsWith(fromPrefix)) {
      return `${host}${toPrefix}${rest.slice(fromPrefix.length)}`;
    }
  }
  return url;
}

/**
 * Retarget versioned internal docs links in one translated block.
 *
 * Only Markdown links (`[text](url)`, never `![img](url)`) and `<a href>` inside
 * prose are considered. Fenced code, images, PDFs, relative links and other hosts
 * (e.g. `https://www.elastic.co/docs/current/...`) are untouched.
 */
export function retargetVersionedLinks(text, from, to) {
  const source = String(text ?? '');
  const fromPrefix = routePrefix(from);
  const toPrefix = routePrefix(to);
  if (!from || fromPrefix === toPrefix) return {text: source, changed: 0, links: []};
  const mask = fenceMask(source);
  const lineAt = (offset) => source.slice(0, offset).split('\n').length - 1;
  const links = [];
  let changed = 0;

  const out = source.replace(MARKDOWN_LINK, (whole, label, url, offset) => {
    if (mask[lineAt(offset)]) return whole;
    const next = rewriteUrl(url, from, to);
    if (next === url) return whole;
    changed += 1;
    links.push({kind: 'markdown', before: url, after: next});
    return `[${label}](${next})`;
  });
  const withHtml = out.replace(HTML_HREF, (whole, open, quote, url, offset) => {
    if (mask[lineAt(offset)]) return whole;
    const next = rewriteUrl(url, from, to);
    if (next === url) return whole;
    changed += 1;
    links.push({kind: 'html', before: url, after: next});
    return `${open}${quote}${next}${quote}`;
  });
  return {text: withHtml, changed, links};
}

/** Versions a winning wording may have been captured from, oldest first. */
function sourceVersions(entry, sourceSection, byName) {
  const out = [];
  const add = (value) => {
    const version = versionString(value);
    // The current release is served unversioned; treat `7.26` like no prefix.
    if (version && version !== currentVersion() && !out.includes(version)) out.push(version);
  };
  add(entry?.version);
  add(entry?.sourceSection);
  add(sourceSection);
  // Versionless sections (hardware/blog/changelog) were captured from 7.25 and
  // may still carry that version's links; their spec records the strip version.
  add(byName.get(sourceSection)?.stripVersion);
  return out;
}

/** Retarget a canonical wording through every plausible source version. */
function retargetCanonical(text, versions, targetVersion) {
  let out = String(text);
  const links = [];
  for (const version of versions) {
    const result = retargetVersionedLinks(out, version, targetVersion);
    out = result.text;
    for (const link of result.links) links.push({...link, from: version, to: targetVersion});
  }
  return {text: out, links, changed: links.length};
}

/** Every image / PDF / resource URL a block points at. */
function assetUrls(text) {
  const source = String(text ?? '');
  const out = [];
  for (const match of source.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) out.push(match[1]);
  for (const match of source.matchAll(/\bsrc\s*=\s*(["'])([^"']*)\1/gi)) out.push(match[2]);
  for (const match of source.matchAll(MARKDOWN_LINK)) {
    if (ASSET_URL.test(match[2])) out.push(match[2]);
  }
  return out.sort();
}

/** Internal docs targets of a block, version-independent, for a route check. */
function docTargets(text) {
  const canonical = (url) =>
    url
      .replace(/^https?:\/\/manual\.mikrotik\.com/i, '')
      .replace(/^\/docs\/(?:\d+(?:\.\d+)*|current)\//i, '/docs/')
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '');
  const isDoc = (url) => /^(?:\/docs\/|https?:\/\/manual\.mikrotik\.com\/docs\/)/i.test(url);
  const out = [];
  for (const match of String(text ?? '').matchAll(MARKDOWN_LINK)) {
    if (isDoc(match[2])) out.push(canonical(match[2]));
  }
  for (const match of String(text ?? '').matchAll(HTML_HREF)) {
    if (isDoc(match[3])) out.push(canonical(match[3]));
  }
  return out.sort();
}

/**
 * Anchor identity of one block: published heading ids in order and the set of
 * link fragments. `docTargets()` above deliberately drops the fragment for its
 * route check; this helper keeps it, because a translated `#方法` is a broken
 * link even though the doc route is right.
 */
function anchorIds(text) {
  const source = String(text ?? '');
  const fragments = [];
  for (const match of source.matchAll(/\]\([^)\s#]*#([^)\s]+)\)/g)) fragments.push(match[1]);
  for (const match of source.matchAll(/href\s*=\s*["'][^"']*?#([^"'\s]+)["']/gi)) {
    fragments.push(match[1]);
  }
  return {headings: headingIds(source), fragments: fragments.sort()};
}

/**
 * A candidate that destroys structure, changes an asset, or invents a doc route
 * must never be written. Memorised wordings sometimes contain glossary-rewritten
 * URL segments (`/docs/防火牆/...`); comparing against the English source catches
 * those before they reach an overlay.
 */
function validateReplacement(current, replacement, englishBlock) {
  if (isCodeBlock(replacement) && !isCodeBlock(current)) return 'replacement is fenced code';
  const fences = (text) => (String(text).match(/^\s*(?:```+|~~~+)/gm) || []).length;
  if (fences(replacement) !== fences(current)) return 'fence count differs';
  if (isStructuralBlock(replacement) || isTagOnlyBlock(replacement)) return 'replacement is structural';
  if (isImageBlock(replacement) && !isImageBlock(current)) return 'replacement is image-only';
  if (imageTagCount(replacement) < imageTagCount(current)) return 'image count drops';
  if (componentTagCount(replacement) < componentTagCount(current)) return 'component count drops';
  // The backfill changes wording, never the bytes of a picture, PDF or asset.
  if (assetUrls(replacement).join('\u0001') !== assetUrls(current).join('\u0001')) {
    return 'image/PDF/asset links differ';
  }
  if (docTargets(replacement).join('\u0001') !== docTargets(englishBlock).join('\u0001')) {
    return 'doc link target differs from English source';
  }
  const want = anchorIds(englishBlock);
  const got = anchorIds(replacement);
  // Any explicit heading anchor the candidate publishes must be the English id
  // at that position (`{#port}` -> `{#埠}` is the observed corruption). A
  // heading with no explicit id is left to `addHeadingAnchors`, which writes the
  // English id in the pipeline; it is not a *new* wrong anchor.
  const candidateHeadings = headings(replacement);
  for (let index = 0; index < candidateHeadings.length; index++) {
    const heading = candidateHeadings[index];
    if (!heading.id) continue;
    if (want.headings[index] !== undefined && heading.id !== want.headings[index]) {
      return `heading anchor differs from English source (${heading.id} != ${want.headings[index]})`;
    }
  }
  const sourceHeadings = headings(englishBlock);
  for (let index = 0; index < sourceHeadings.length; index++) {
    if (sourceHeadings[index].id && got.headings[index] !== sourceHeadings[index].id) {
      return 'explicit heading anchor missing from candidate';
    }
  }
  // Link fragments are copied byte for byte; a translated fragment breaks the
  // link even when the document target is unchanged.
  if (got.fragments.join('\u0001') !== want.fragments.join('\u0001')) {
    return 'link fragment differs from English source';
  }
  return null;
}

/* -------------------------------------------------------------------------
 * Legacy guards (bad tokens / hardware shape / inflation / fence content).
 * All of them are conservative: a rejected candidate is counted in `skipped`
 * and the overlay keeps its current wording.
 * ------------------------------------------------------------------------- */

/**
 * MDX treats a line that STARTS with a bare `import` / `export` / `from` as an
 * ES module statement and hands it to acorn. Repairing a glossary-corrupted
 * token (`im埠` -> `import`) can expose such a line in prose. Quoting the
 * keyword as inline code keeps the corrected token and keeps the page parseable.
 * Fenced code is left alone.
 */
export function escapeMdxKeywordLines(text) {
  const source = String(text ?? '');
  const mask = fenceMask(source);
  return source
    .split('\n')
    .map((line, index) => {
      if (mask[index]) return line;
      const match = /^(import|export|from)\b(\s)/.exec(line);
      return match ? `\`${match[1]}\`${match[2]}${line.slice(match[0].length)}` : line;
    })
    .join('\n');
}

/** Cheap version of verify's overlay score: CJK chars + ASCII words. */
function proseScore(text) {
  const source = String(text ?? '');
  const mask = fenceMask(source);
  const prose = source
    .split('\n')
    .filter((line, index) => !mask[index])
    .join('\n');
  return {
    words: (prose.match(/[A-Za-z]+/g) || []).length,
    score: (prose.match(/[\u4e00-\u9fff]/g) || []).length + (prose.match(/[A-Za-z]+/g) || []).length,
  };
}

/** Line spans of the blocks emitted by `blocks()`, in the same order. */
function blockLineSpans(body) {
  const lines = String(body).split('\n');
  const spans = [];
  for (let index = 0; index < lines.length; ) {
    if (lines[index].trim() === '') {
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && lines[index].trim() !== '') index += 1;
    spans.push({start, end: index - 1});
  }
  return spans;
}

/**
 * A heading must stay a heading and a short label must not become a long
 * paragraph. The hardware non-idempotency came from `## First use` being
 * aligned to a short overlay label whose TM winner was an entire safety
 * notice: re-applying replaced the label with that paragraph. Both signals
 * below are shape mismatches, not wording preferences.
 */
function validateBlockShape(englishBlock, current, candidate) {
  const heading = (text) => /^\s*#{1,6}\s/.test(String(text ?? '').trimStart());
  if (heading(englishBlock) && !heading(candidate)) return 'heading replaced by non-heading';
  if (heading(current) && !heading(candidate)) return 'heading replaced by non-heading';
  if (!heading(englishBlock) && heading(candidate)) return 'non-heading replaced by heading';
  const source = proseScore(englishBlock);
  const before = proseScore(current);
  const next = proseScore(candidate);
  // verify's inflation threshold, applied to one block. Short labels get a
  // proportionally small allowance; a 2-word label may not become a 200-char
  // safety paragraph.
  if (source.words > 0 && next.score > source.words * 3 + 20) {
    return `block score explosion ${source.words}->${next.score}`;
  }
  // The hardware misalignment aligns a SHORT overlay label (`第一次使用`)
  // with a neighbouring paragraph, so the English block is not short at all.
  // Compare against the block actually being overwritten as well: a small
  // label must never be replaced by a long safety notice.
  if (before.score > 0 && before.score <= 20 && next.score > before.score * 3 + 20) {
    return `short block replaced by long paragraph ${before.score}->${next.score}`;
  }
  if (before.score <= 12 && !/[。！？!?；;，,]/u.test(current) && next.score > before.score * 2 + 5) {
    return `short label replaced by prose ${before.score}->${next.score}`;
  }
  return null;
}

/** True when the English block lives inside a fenced code sample. */
function isFencedBlock(englishBlock, sourceSpans, sourceMask, englishIndex) {
  const span = sourceSpans[englishIndex];
  if (!span) return isCodeBlock(englishBlock);
  for (let line = span.start; line <= span.end; line++) {
    if (sourceMask[line]) return true;
  }
  return false;
}

/** Replace the Nth exact occurrence of `needle` in a string. */
function replaceNth(text, needle, replacement, nth) {
  let cursor = 0;
  let seen = 0;
  while ((cursor = text.indexOf(needle, cursor)) !== -1) {
    if (seen === nth) {
      return text.slice(0, cursor) + replacement + text.slice(cursor + needle.length);
    }
    seen += 1;
    cursor += needle.length;
  }
  return text;
}

/**
 * Restore only the CODE lines of fenced samples from the English source.
 * Comment slots stay translated (verify checks them via `commentDiff`), and
 * every other byte of the overlay is left alone. Fences are matched as units
 * (not by absolute line number: an overlay can have fewer prose lines), and
 * the line list comes from verify's own `compareFence`, so the repair and the
 * gate agree on what is a defect. This is the data-driven fix for a fence
 * line an earlier backfill rewrote (`On client:` -> `在用戶端上：`).
 */
export function repairFenceCodeLines(sourceBody, overlayBody) {
  const result = {body: overlayBody, changed: 0, fences: []};
  const sourceFences = fences(sourceBody);
  const overlayFences = fences(overlayBody);
  if (sourceFences.length !== overlayFences.length) return result;
  let out = String(overlayBody);
  for (let index = 0; index < sourceFences.length; index++) {
    const comparison = compareFence(sourceFences[index], overlayFences[index]);
    const lines = comparison.code
      .map((entry) => /^line (\d+) changed:/.exec(entry)?.[1])
      .filter(Boolean)
      .map(Number);
    if (lines.length === 0) continue;
    const sourceLines = sourceFences[index].split('\n');
    const overlayLines = overlayFences[index].split('\n');
    for (const line of lines) {
      if (sourceLines[line - 1] !== undefined) overlayLines[line - 1] = sourceLines[line - 1];
    }
    const nth = overlayFences.slice(0, index).filter((fence) => fence === overlayFences[index]).length;
    out = replaceNth(out, overlayFences[index], overlayLines.join('\n'), nth);
    result.changed += lines.length;
    result.fences.push({fence: index + 1, lines});
  }
  result.body = out;
  return result;
}

/** Read-only TM audit: list entries the OLD glossary logic used to corrupt. */
function listBadTmEntries() {
  // This mode runs before the main `tm` constant is created, so build a local
  // read-only view of the same global memory.
  const memory = createGlobalTm({locale, ...(workDir ? {workDir} : {})});
  const bad = [];
  for (const [key, entry] of memory.entries) {
    const text = entry.text || '';
    if (hasGluedToken(text)) bad.push({key, text: text.slice(0, 240)});
  }
  return {total: memory.entries.size, bad};
}

/* -------------------------------------------------------------------------
 * Polluted title entries.
 *
 * A `block\0<English>` entry whose English is a SINGLE, simple heading line
 * (e.g. `## CLI Reference`) is a title unit: its TM value must be one heading
 * line too. The changelog corruption stored ~20 glued lines (five `#` headings)
 * under that key, so `apply` pasted the whole CLI introduction into each
 * changelog heading block and inflated 8 pages. `hasGluedToken` cannot see it:
 * there is no ASCII/CJK token gluing, only a whole paragraph stuck to a title.
 *
 * RULE (deliberately narrow, no false positives on CLI metadata headings):
 *   key   = one non-empty line, `^#{1,6}\s`, exactly one `#` run, no `**`
 *           metadata fields (those CLI index headings legitimately carry a
 *           short `**Syscap:** …` block in the value);
 *   value = more than one `^#{1,6}\s` line, OR more than 3 non-empty lines.
 * A hit is reported with the source shard file:line and the winning section.
 * ------------------------------------------------------------------------- */

/** The English part of either a global `block\0…` key or a section `docs\0…` key. */
function keyEnglish(key) {
  const text = String(key ?? '');
  if (text.startsWith('block\u0000')) return text.slice('block\u0000'.length);
  const at = text.indexOf('\u0000');
  return at === -1 ? text : text.slice(at + 1);
}

/** True when `english` is a single, simple ATX heading line (no metadata). */
export function isSimpleTitleKey(english) {
  const lines = String(english ?? '').split('\n').filter((line) => line.trim() !== '');
  if (lines.length !== 1) return false;
  const line = lines[0].trim();
  if (!/^#{1,6}\s+\S/.test(line)) return false;
  if ((line.match(/#{1,6}\s/g) || []).length !== 1) return false;
  if (/\*\*/.test(line)) return false;
  return true;
}

/** Shape signals of a TM value: headings and non-empty line count. */
export function pollutionSignals(text) {
  const value = String(text ?? '');
  return {
    headings: (value.match(/^\s*#{1,6}\s/gm) || []).length,
    lines: value.split('\n').filter((line) => line.trim() !== '').length,
  };
}

/** Is this a polluted title entry under the rule above? */
export function isPollutedTitle(key, text) {
  if (!isSimpleTitleKey(keyEnglish(key))) return false;
  const signals = pollutionSignals(text);
  return signals.headings > 1 || signals.lines > 3;
}

/** A clean replacement is the value's first line when that line is a heading. */
function cleanTitleValue(text) {
  const first = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return first && isSimpleTitleKey(first) ? first : null;
}

/** Where a merged-memory key's current value comes from (file:line for the report). */
function locateSourceKey(key) {
  const files = [path.join(workDir || WORK_DIR, 'model-memory.json')];
  const shardDir = path.join(workDir || WORK_DIR, 'shards');
  if (fs.existsSync(shardDir)) {
    for (const name of fs.readdirSync(shardDir).sort()) {
      if (/\.json$/.test(name)) files.push(path.join(shardDir, name));
    }
  }
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = file.endsWith('model-memory.json') ? payload : payload.entries;
    if (entries && Object.prototype.hasOwnProperty.call(entries, key)) {
      return {file: relative(WORKSPACE, file), line: 1};
    }
  }
  return {file: null, line: null};
}

/** Polluted source keys (section-prefixed) with their clean first-line value. */
function pollutedSourceEntries() {
  const memory = loadModelMemory({...(workDir ? {workDir} : {})});
  const out = [];
  for (const [key, value] of memory) {
    if (!key.includes('\u0000')) continue;
    if (!isSimpleTitleKey(keyEnglish(key))) continue;
    if (!isPollutedTitle(key, value)) continue;
    const clean = cleanTitleValue(value);
    if (!clean) continue;
    out.push({
      key,
      english: keyEnglish(key),
      clean,
      signals: pollutionSignals(value),
      source: locateSourceKey(key),
      sample: String(value).slice(0, 240),
    });
  }
  return out;
}

if (listPollutedTm) {
  const memory = createGlobalTm({locale, ...(workDir ? {workDir} : {})});
  const global = [];
  for (const [key, entry] of memory.entries) {
    if (!isPollutedTitle(key, entry.text)) continue;
    global.push({
      key,
      english: keyEnglish(key),
      sourceSection: entry.sourceSection ?? null,
      signals: pollutionSignals(entry.text),
      sample: String(entry.text).slice(0, 240),
    });
  }
  const sources = pollutedSourceEntries();
  const report = {
    tm_entries: memory.entries.size,
    polluted_entries: sources.length,
    global_polluted_entries: global.length,
    rule: 'simple single-heading key with >1 heading line or >3 value lines',
    samples: sources.slice(0, 40),
    note: listBadTm ? 'read-only' : 'read-only gate',
  };
  if (listBadTm) {
    // Keep the historical --list-bad-tm output and add the new audit counters.
    const {total, bad} = listBadTmEntries();
    process.stdout.write(
      `${JSON.stringify(
        {
          tm_entries: total,
          bad_entries: bad.length,
          polluted_entries: sources.length,
          global_polluted_entries: global.length,
          samples: bad.slice(0, 40),
          polluted_samples: sources.slice(0, 40),
          note: 'read-only',
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  // Gate: a non-zero count fails the audit. Both modes are read-only.
  process.exit(sources.length || global.length ? 1 : 0);
}

if (cleanPolluted) {
  if (apply) assertTranslationLocale(locale, {readOnly: false});
  const targets = pollutedSourceEntries();
  const report = {
    mode: apply ? 'clean-polluted' : 'clean-polluted-preview',
    locale,
    targets,
    totals: {sources: targets.length, rewritten: 0},
  };
  if (apply && targets.length) {
    const changes = new Map(targets.map(({key, clean}) => [key, clean]));
    const shard = writeMemoryShard(changes, {
      workDir: workDir || WORK_DIR,
      locale,
      now: new Date('2026-11-19T00:00:00Z'),
    });
    report.totals.rewritten = changes.size;
    report.shard = `${relative(WORKSPACE, shard.file)} (${shard.entries} keys)`;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

if (seedFromOverlays) {
  if (!seedKeys) {
    process.stderr.write('tm-backfill: --seed-from-overlays requires --keys=MANIFEST\n');
    process.exit(2);
  }
  if (apply) assertTranslationLocale(locale, {readOnly: false});
  const raw = JSON.parse(fs.readFileSync(seedKeys, 'utf8'));
  const entries = Array.isArray(raw) ? raw : raw.entries || [];
  const memory = loadModelMemory({...(workDir ? {workDir} : {})});
  const additions = new Map();
  const report = {
    mode: apply ? 'seed-from-overlays' : 'seed-from-overlays-preview',
    locale,
    backup: seedFromOverlays,
    manifest: seedKeys,
    totals: {manifest: entries.length, seeded: 0, existing: 0, noCjk: 0, noAlign: 0, noSource: 0},
    samples: [],
  };
  for (const item of entries) {
    const section = allSections.find((entry) => entry.name === item.section);
    if (!section) {
      report.totals.noSource++;
      continue;
    }
    const sourcePath = path.join(root, section.source, item.file);
    if (!fs.existsSync(sourcePath)) {
      report.totals.noSource++;
      continue;
    }
    // Backup overlays mirror i18n/<locale>/<plugin>[/<suffix>] without that prefix.
    const overlayRel = section.overlay.replace(/^i18n\/[^/]+\//, '');
    const overlayPath = path.join(seedFromOverlays, overlayRel, item.file);
    if (!fs.existsSync(overlayPath)) {
      report.totals.noSource++;
      continue;
    }
    const sourceBody = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body;
    const overlayBody = splitFrontMatter(fs.readFileSync(overlayPath, 'utf8')).body;
    const spans = splitBlockSpans(sourceBody);
    const englishIndex = spans.findIndex((span) => normalize(span.text) === normalize(item.english));
    if (englishIndex === -1) {
      report.totals.noAlign++;
      continue;
    }
    const chinese = splitBlocks(overlayBody);
    const pairs = alignBlocks(
      spans.map((span) => span.text),
      chinese,
    );
    const chineseIndex = pairs.get(englishIndex);
    if (chineseIndex === undefined) {
      report.totals.noAlign++;
      continue;
    }
    const zh = String(chinese[chineseIndex] ?? '').trim();
    if (!/[\u4e00-\u9fff]/.test(zh)) {
      report.totals.noCjk++;
      continue;
    }
    const key = `${section.name}\u0000${normalize(spans[englishIndex].text)}`;
    if (memory.get(key) === zh) {
      report.totals.existing++;
      continue;
    }
    additions.set(key, zh);
    report.totals.seeded++;
    if (report.samples.length < 12) {
      report.samples.push({section: section.name, file: item.file, kind: item.kind || 'seed', zh: zh.slice(0, 120)});
    }
  }
  if (apply && additions.size) {
    const shard = writeMemoryShard(additions, {
      workDir: workDir || WORK_DIR,
      locale,
      now: new Date('2026-11-19T00:00:10Z'),
    });
    report.shard = `${relative(WORKSPACE, shard.file)} (${shard.entries} keys)`;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

if (listBadTm) {
  const {total, bad} = listBadTmEntries();
  const polluted = pollutedSourceEntries();
  process.stdout.write(
    `${JSON.stringify(
      {
        tm_entries: total,
        bad_entries: bad.length,
        polluted_entries: polluted.length,
        samples: bad.slice(0, 40),
        polluted_samples: polluted.slice(0, 40),
        note: 'read-only',
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

if (repairFences) {
  // Without --apply this is a read-only preview of exactly which fence code
  // lines would be restored from the English source.
  if (apply) assertTranslationLocale(locale, {readOnly: false});
  const report = {mode: apply ? 'repair-fences' : 'repair-fences-preview', locale, files: [], totals: {files: 0, lines: 0}};
  for (const section of sections) {
    const sourceBase = path.join(root, section.source);
    const overlayBase = path.join(root, section.overlay);
    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      const overlayPath = path.join(overlayBase, rel);
      if (!fs.existsSync(overlayPath)) continue;
      const original = fs.readFileSync(overlayPath, 'utf8');
      const splitSource = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8'));
      const splitOverlay = splitFrontMatter(original);
      const repaired = repairFenceCodeLines(splitSource.body, splitOverlay.body);
      if (repaired.changed === 0) continue;
      if (apply) {
        const prefix = original.slice(0, original.length - splitOverlay.body.length);
        writeFileAtomic(overlayPath, `${prefix}${repaired.body}`);
      }
      report.files.push({section: section.name, file: rel, fences: repaired.fences});
      report.totals.files += 1;
      report.totals.lines += repaired.changed;
    }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

if (repairAnchors) {
  // Stock repair for the heading-id problem. A source heading that Docusaurus
  // slugs to English (`## HTTP Methods` -> `#http-methods`) must be published
  // explicitly on its translated heading; a page that skipped that step
  // publishes a Chinese id and every `#http-methods` link to it dies. We reuse
  // the very same `addHeadingAnchors` the pipeline calls, so "repaired" and
  // "passes verify" cannot disagree, and a second run is a no-op.
  if (apply) assertTranslationLocale(locale, {readOnly: false});
  const report = {
    mode: apply ? 'repair-anchors' : 'repair-anchors-preview',
    locale,
    files: [],
    samples: [],
    totals: {files: 0, headings: 0, corrected: 0, fragments: 0},
  };

  // Pass 1: one repository-wide map from the ids the overlays currently
  // publish to the ids the English sources publish. A cross-page link names a
  // heading on its *target* page, so the local map of the containing page is
  // not enough.
  const globalMap = new Map();
  const jobs = [];
  for (const section of sections) {
    const sourceBase = path.join(root, section.source);
    const overlayBase = path.join(root, section.overlay);
    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      const overlayPath = path.join(overlayBase, rel);
      if (!fs.existsSync(overlayPath)) continue;
      const original = fs.readFileSync(overlayPath, 'utf8');
      const splitOverlay = splitFrontMatter(original);
      if (!splitOverlay.body.trim()) continue;
      const sourceBody = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body;
      for (const pair of headingPairs(splitOverlay.body, sourceBody)) {
        if (pair.actual && pair.actual !== pair.expected && !globalMap.has(pair.actual)) {
          globalMap.set(pair.actual, pair.expected);
        }
      }
      jobs.push({section: section.name, rel, overlayPath, original, splitOverlay, sourceBody});
    }
  }

  const backupDir = path.join(WORKSPACE, '.work', 'anchor-backup');
  const manifest = [];
  for (const job of jobs) {
    const beforeIds = headingIds(job.splitOverlay.body);
    const pairs = headingPairs(job.splitOverlay.body, job.sourceBody);
    const repaired = addHeadingAnchors(job.splitOverlay.body, job.sourceBody, {extraMapping: globalMap});
    const final = retargetAnchorFragments(repaired.body, globalMap);
    const body = final.body;
    if (body === job.splitOverlay.body) continue;
    const fragments = repaired.retargeted + final.changed;
    const afterIds = headingIds(body);
    for (let index = 0; index < pairs.length && report.samples.length < 12; index++) {
      if (beforeIds[index] !== afterIds[index]) {
        report.samples.push({
          section: job.section,
          file: job.rel,
          line: pairs[index].line + 1,
          before: beforeIds[index],
          after: afterIds[index],
          source: pairs[index].expected,
        });
      }
    }
    if (apply) {
      const backupPath = path.join(backupDir, job.section, job.rel);
      fs.mkdirSync(path.dirname(backupPath), {recursive: true});
      fs.writeFileSync(backupPath, job.original);
      manifest.push({
        section: job.section,
        file: job.rel,
        backup: path.relative(WORKSPACE, backupPath),
        sha256: sha256Hex(job.original),
        bytes: Buffer.byteLength(job.original),
      });
      const prefix = job.original.slice(0, job.original.length - job.splitOverlay.body.length);
      writeFileAtomic(job.overlayPath, `${prefix}${body}`);
    }
    report.files.push({
      section: job.section,
      file: job.rel,
      headings: repaired.added + repaired.corrected,
      corrected: repaired.corrected,
      fragments,
    });
    report.totals.files += 1;
    report.totals.headings += repaired.added + repaired.corrected;
    report.totals.corrected += repaired.corrected;
    report.totals.fragments += fragments;
  }

  if (apply) {
    fs.mkdirSync(backupDir, {recursive: true});
    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      `${JSON.stringify(
        {mode: 'repair-anchors', locale, files: manifest, count: manifest.length},
        null,
        2,
      )}\n`,
    );
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

if (apply) {
  try {
    assertTranslationLocale(locale, {readOnly: false});
  } catch (error) {
    process.stderr.write(`tm-backfill: ${error.message}\n`);
    process.exit(2);
  }
}

const tm = createGlobalTm({locale, ...(workDir ? {workDir} : {})});
const byName = new Map(allSections.map((section) => [section.name, section]));
const report = {
  mode: apply ? 'apply' : 'analysis',
  locale,
  root,
  work_dir: workDir || null,
  tm_entries: tm.entries.size,
  sections: {},
  files: [],
  link_samples: [],
  skipped: [],
};
let totalPages = 0;
let totalPairs = 0;
let totalWouldChange = 0;
let totalRetargetBlocks = 0;
let totalRetargetLinks = 0;
let totalFiles = 0;
let appliedFiles = 0;
let appliedBlocks = 0;

for (const section of sections) {
  const sourceBase = path.join(root, section.source);
  const overlayBase = path.join(root, section.overlay);
  // `versionForSection('docs')` is the release number (7.26), but the current
  // tree's route prefix is the unversioned `/docs/` (versionPlan.routeBase = '').
  const plannedVersion = versionForSection(section.name);
  const targetVersion = plannedVersion === currentVersion() ? null : plannedVersion;
  const stat = {
    pages: 0,
    pairs: 0,
    would_change: 0,
    files_to_change: 0,
    retarget_blocks: 0,
    retarget_links: 0,
    by_source: {},
  };

  for (const sourcePath of walkMarkdown(sourceBase)) {
    const rel = relative(sourceBase, sourcePath);
    const overlayPath = path.join(overlayBase, rel);
    if (!fs.existsSync(overlayPath)) continue;
    const overlayStat = fs.lstatSync(overlayPath);
    if (!overlayStat.isFile() || overlayStat.isSymbolicLink()) {
      report.skipped.push({section: section.name, file: rel, reason: 'overlay is not a regular file'});
      continue;
    }
    const original = fs.readFileSync(overlayPath, 'utf8');
    const split = splitFrontMatter(original);
    if (split.frontMatter === '' || split.body.trim() === '') {
      report.skipped.push({section: section.name, file: rel, reason: 'overlay has no front matter/body'});
      continue;
    }
    const sourceBody = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body;
    const english = blocks(sourceBody);
    const chinese = blocks(split.body);
    const tokens = bodyTokens(split.body);
    const pairs = alignBlocks(english, chinese);
    const sourceMask = fenceMask(sourceBody);
    const sourceSpans = blockLineSpans(sourceBody);
    const sourceWords = proseScore(sourceBody).words;
    let projectedScore = proseScore(split.body).score;
    // Same 3.0 / 20 margin as verify's overlayInflation. A block is skipped
    // when it would push a previously healthy overlay over the gate.
    const inflationLimit = sourceWords * 3 + 20;
    const replacements = new Map();
    const fileSamples = [];
    let fileChange = 0;
    let fileRetarget = 0;
    stat.pages += 1;
    for (const [englishIndex, chineseIndex] of pairs) {
      stat.pairs += 1;
      const englishBlock = english[englishIndex].trim();
      const canonical = lookupBlock(tm, englishBlock);
      if (canonical === null) continue;
      const current = chinese[chineseIndex].trim();
      // Only flag real Chinese wording changes; an identity/blocked entry is
      // not a backfill candidate.
      if (!/[\u4e00-\u9fff]/.test(canonical)) continue;

      const entry = tm.entries.get(blockKey(englishBlock));
      const sourceSection = entry?.sourceSection ?? null;
      const versions = sourceVersions(entry, sourceSection, byName);
      const retargeted = retargetCanonical(canonical.trim(), versions, targetVersion);
      const candidate = escapeMdxKeywordLines(retargeted.text);
      // Compare against the text we would actually write, not the raw memory
      // wording: otherwise a retargeted block is reported as changed forever.
      if (candidate === current) continue;
      const invalid = validateReplacement(current, candidate, englishBlock);
      if (invalid) {
        report.skipped.push({section: section.name, file: rel, reason: invalid});
        continue;
      }
      // Fence content is code, never prose. The old tool only counted fences;
      // it happily rewrote a line INSIDE a fence (radius.md `On client:`).
      if (isFencedBlock(englishBlock, sourceSpans, sourceMask, englishIndex)) {
        report.skipped.push({section: section.name, file: rel, reason: 'fence content must not be rewritten'});
        continue;
      }
      // A memory winner that corrupts a command/parameter/token is never written.
      if (hasGluedToken(candidate)) {
        report.skipped.push({section: section.name, file: rel, reason: 'glued CJK/ASCII token in candidate'});
        continue;
      }
      const shape = validateBlockShape(englishBlock, current, candidate);
      if (shape) {
        report.skipped.push({section: section.name, file: rel, reason: shape});
        continue;
      }
      const delta = proseScore(candidate).score - proseScore(current).score;
      if (sourceWords > 0 && projectedScore + delta > inflationLimit) {
        report.skipped.push({
          section: section.name,
          file: rel,
          reason: `overlay inflation guard ${projectedScore}+${delta}>${inflationLimit}`,
        });
        continue;
      }
      projectedScore += delta;

      stat.would_change += 1;
      stat.retarget_blocks += retargeted.links.length ? 1 : 0;
      stat.retarget_links += retargeted.links.length;
      const source = (sourceSection ?? '(none)').toString();
      stat.by_source[source] = (stat.by_source[source] || 0) + 1;
      fileChange += 1;
      fileRetarget += retargeted.links.length;
      replacements.set(chineseIndex, candidate);

      if (fileSamples.length < samplesPerFile) {
        fileSamples.push({
          before: current.slice(0, 220),
          canonical: canonical.trim().slice(0, 220),
          after: candidate.slice(0, 220),
        });
      }
      if (report.link_samples.length < 40 && retargeted.links.length) {
        report.link_samples.push({
          section: section.name,
          file: rel,
          sourceSection,
          from: retargeted.links[0].from,
          to: targetVersion ?? 'current',
          before: current.slice(0, 220),
          canonical: canonical.trim().slice(0, 220),
          after: candidate.slice(0, 220),
          links: retargeted.links.slice(0, 6),
        });
      }
    }

    if (fileChange === 0) continue;
    stat.files_to_change += 1;
    totalFiles += 1;
    report.files.push({
      section: section.name,
      file: rel,
      blocks: fileChange,
      retarget_links: fileRetarget,
      samples: fileSamples,
    });

    if (apply) {
      // Replace by exact block index, never by searching for the text: two
      // blocks can legitimately have the same trimmed wording.
      let seen = -1;
      let out = '';
      for (const token of tokens) {
        if (token.separator || token.value.trim() === '') {
          out += token.value;
          continue;
        }
        seen += 1;
        out += replacements.has(seen)
          ? replaceOne(token.value, replacements.get(seen))
          : token.value;
      }
      const prefix = original.slice(0, original.length - split.body.length);
      writeFileAtomic(overlayPath, `${prefix}${out}`);
      appliedFiles += 1;
      appliedBlocks += fileChange;
    }
  }

  report.sections[section.name] = stat;
  totalPages += stat.pages;
  totalPairs += stat.pairs;
  totalWouldChange += stat.would_change;
  totalRetargetBlocks += stat.retarget_blocks;
  totalRetargetLinks += stat.retarget_links;
}

report.totals = {
  pages: totalPages,
  pairs: totalPairs,
  would_change: totalWouldChange,
  files_to_change: totalFiles,
  retarget_blocks: totalRetargetBlocks,
  retarget_links: totalRetargetLinks,
  skipped: report.skipped.length,
  ...(apply ? {applied_files: appliedFiles, applied_blocks: appliedBlocks} : {}),
};

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const verb = apply ? 'APPLY' : 'read-only';
  process.stdout.write(
    `tm-backfill (${verb}) locale=${locale} tm=${tm.entries.size} ` +
      `pages=${totalPages} pairs=${totalPairs} would_change=${totalWouldChange} ` +
      `files=${totalFiles} retarget_blocks=${totalRetargetBlocks} ` +
      `retarget_links=${totalRetargetLinks} skipped=${report.skipped.length}\n`,
  );
  for (const [name, stat] of Object.entries(report.sections)) {
    process.stdout.write(
      `  ${name}: pages=${stat.pages} pairs=${stat.pairs} would_change=${stat.would_change} ` +
        `files=${stat.files_to_change} retarget_blocks=${stat.retarget_blocks} ` +
        `retarget_links=${stat.retarget_links} by_source=${JSON.stringify(stat.by_source)}\n`,
    );
  }
  if (apply || argv['list-files'] === true) {
    for (const file of report.files) {
      process.stdout.write(
        `  ${file.section}/${file.file}: blocks=${file.blocks} ` +
          `retarget_links=${file.retarget_links}\n`,
      );
      for (const sample of file.samples) {
        process.stdout.write(
          `      * winner: ${sample.canonical}\n` +
            `      - overlay: ${sample.before}\n` +
            `      + written: ${sample.after}\n`,
        );
      }
    }
  }
  for (const sample of report.link_samples.slice(0, 5)) {
    process.stdout.write(
      `  link ${sample.section}/${sample.file} [${sample.sourceSection}] ` +
        `${sample.from} -> ${sample.to}: ${sample.links[0].before} => ${sample.links[0].after}\n`,
    );
  }
  if (apply) {
    process.stdout.write(
      `applied: files=${appliedFiles} blocks=${appliedBlocks}; ` +
        're-run to confirm idempotence (expected 0 changes).\n',
    );
  } else {
    process.stdout.write('note: analysis only; no overlay was written.\n');
  }
}

/** Keep the block's surrounding whitespace, change only its trimmed text. */
function replaceOne(raw, replacement) {
  const lead = raw.length - raw.trimStart().length;
  const trail = raw.length - raw.trimEnd().length;
  return `${raw.slice(0, lead)}${replacement}${raw.slice(raw.length - trail)}`;
}
