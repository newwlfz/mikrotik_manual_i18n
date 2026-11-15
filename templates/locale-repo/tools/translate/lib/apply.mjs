/**
 * Build (or refresh) the Chinese overlays from the English sources.
 *
 * Two modes, both offline:
 *   - exact   the legacy file was translated from a byte-identical English body
 *             (its `source_sha` matches), so its whole page is reused; only the
 *             horizontal rules the old pipeline dropped are restored.
 *   - blocks  the page changed, so each block is looked up in the translation
 *             memory and the rest is left in English for a later batch.
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, DEFAULT_TARGET_LOCALE, REPO, ensureDir, relative, walkMarkdown} from './paths.mjs';
import {splitFrontMatter, readField, withFields, copyKeys, renderDocument} from './frontmatter.mjs';
import {translationProvenance} from './provenance.mjs';
import {translateBlocks, normalize, splitBlocks, splitBlockSpans, isHorizontalRule, segmentSpans, fenceMask, alignBlocks, blockSignature, sameBlockShape, isImageBlock, isStructuralBlock, isTagOnlyBlock, componentTagCount, imageTagCount, retargetLinks} from './blocks.mjs';
import {splitAdmonitions, bodyParagraphs} from './admonitions.mjs';
import {annotateDocumentTerms} from './term-annotate.mjs';
import {digest, CJK} from './legacy.mjs';
import {blockHashes, encodeBlockHashes, sha256Hex} from './digest.mjs';
import {cjkRegression} from './cjk.mjs';
import {translateCodeComments} from './code-comments.mjs';
import {sidebarLabelZh} from './labels.mjs';
import {applyInlineColors, loadInlineColors} from '../../sync/lib/inline-colors.mjs';
import {currentVersion} from '../../sync/lib/versions.mjs';
import {lookupBlockLines, lookupCommentKey, lookupTitle, translateTableLines} from './tm.mjs';
import {rewriteLinks, pageTitles} from './links.mjs';
import {addHeadingAnchors} from './anchors.mjs';
import YAML from 'yaml';
import {loadPatch, applyReplacements} from './patches.mjs';

const IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g;

/** Overlays listed in config/translation.yml are never regenerated. */
let preserveCache = null;
function preservedOverlays() {
  if (preserveCache) return preserveCache;
  preserveCache = new Set();
  const file = path.join(REPO, 'config/translation.yml');
  if (fs.existsSync(file)) {
    const config = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    for (const entry of config.preserve_overlays || []) preserveCache.add(String(entry));
  }
  return preserveCache;
}

export function images(body) {
  return [...body.matchAll(IMAGE)].map((match) => match[2]);
}

/**
 * Apply a transform to the text outside fenced code only. Example documents
 * contain image syntax inside fences, which must stay byte-identical.
 */
function outsideFences(body, transform) {
  const out = [];
  for (const span of segmentSpans(body)) {
    if (span.part.kind === 'sep' || span.code) out.push(span.part.value);
    else out.push(transform(span.part.value));
  }
  return out.join('');
}

/** `<img src="…">` images the source embeds as HTML instead of Markdown. */
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

/** Every Markdown image occurrence in one block, with its byte range. */
function imageRefs(block) {
  return [...String(block).matchAll(IMAGE)].map((match) => ({
    alt: match[1],
    url: match[2],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** Resolve a page-relative image URL against the page's repository directory. */
function resolvedImageUrl(url, baseDir) {
  if (!baseDir || /^(?:[a-z]+:|\/|#)/i.test(url)) return url;
  return path.posix.normalize(path.posix.join(baseDir, url.replace(/^\.\//, '')));
}

/**
 * Render an image reference, pointing a relative source URL at the overlay's
 * location when the caller supplied both directories (the standalone `align`
 * pass does; `translate` rebases the whole page afterwards instead).
 */
function imageUrlAt(ref, context = {}) {
  if (!/^(?:[a-z]+:|\/|#)/i.test(ref.url)) {
    if (context.sourceDir && context.overlayDir) {
      const resolved = resolvedImageUrl(ref.url, context.sourceDir);
      const depth = context.overlayDir.split('/').length - 1;
      return `${'../'.repeat(depth)}${resolved}`;
    }
    // Whole-page callers call `rebaseImages` right after; keep the source form.
    return ref.url;
  }
  return ref.url;
}

function renderImage(ref, context = {}, alt = ref.alt) {
  return `![${alt}](${imageUrlAt(ref, context)})`;
}

/** Equal URLs in order (LCS): `[sourceIndex, targetIndex]` pairs. */
function matchImageUrls(source, target) {
  const n = source.length;
  const m = target.length;
  if (n === 0 || m === 0) return [];
  const width = m + 1;
  // `length[i * width + j]` is the LCS length of `source[i..]` / `target[j..]`.
  const length = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      length[i * width + j] =
        source[i] === target[j]
          ? length[(i + 1) * width + j + 1] + 1
          : Math.max(length[(i + 1) * width + j], length[i * width + j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (source[i] === target[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (length[(i + 1) * width + j] >= length[i * width + j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/**
 * Reconcile the images of one target block with one source block.
 *
 * Only image Markdown is touched; every other byte of the translated block
 * (prose, table cells, inline code) is preserved. Matched URLs keep their
 * position, new source images are inserted next to the image they followed in
 * the source, and target images the source no longer has are removed. When the
 * two sides share no URL at all (a renamed/light-dark pair such as the packet
 * flow diagrams) the images are paired by ordinal instead, which is the only
 * stable relationship left.
 */
function alignBlockImageRefs(sourceRefs, targetRefs, base, sourceHtml, warn, context = {}) {
  const edits = [];
  let added = 0;
  let removed = 0;
  let replaced = 0;
  const resolve = (ref) => resolvedImageUrl(ref.url, context.sourceDir);
  const pairs = matchImageUrls(
    sourceRefs.map(resolve),
    targetRefs.map((ref) => resolvedImageUrl(ref.url, context.overlayDir)),
  );
  const insert = (at, refs) => {
    if (refs.length === 0) return;
    edits.push({start: base + at, end: base + at, text: refs.map((ref) => renderImage(ref, context)).join('')});
    added += refs.length;
  };
  const drop = (ref) => {
    if (sourceHtml.has(ref.url)) {
      // The source still shows this picture, only as `<img src>`; deleting the
      // Markdown would remove it from the page. Keep it and report the mismatch
      // instead of silently dropping content.
      warn({reason: 'html-image-in-source', url: ref.url});
      return false;
    }
    edits.push({start: base + ref.start, end: base + ref.end, text: ''});
    removed += 1;
    return true;
  };

  if (pairs.length === 0) {
    const common = Math.min(sourceRefs.length, targetRefs.length);
    for (let k = 0; k < common; k++) {
      const source = sourceRefs[k];
      const target = targetRefs[k];
      const same =
        resolve(source) === resolvedImageUrl(target.url, context.overlayDir);
      if (!same) {
        // Keep the overlay's alt text: it may already be translated prose.
        edits.push({
          start: base + target.start,
          end: base + target.end,
          text: renderImage(source, context, target.alt),
        });
        replaced += 1;
      }
    }
    if (sourceRefs.length > targetRefs.length) {
      const at = targetRefs.length ? targetRefs[targetRefs.length - 1].end : 0;
      insert(at, sourceRefs.slice(common));
    } else {
      for (const ref of targetRefs.slice(common)) drop(ref);
    }
    return {edits, added, removed, replaced};
  }

  let si = 0;
  let ti = 0;
  const bounds = [...pairs, [sourceRefs.length, targetRefs.length]];
  for (const [pi, pj] of bounds) {
    if (pi > si) {
      // Source images before the next common URL: put them where they were in
      // the source, immediately before the next target image (or after the last
      // one when this is the tail).
      const at = pj > 0 ? targetRefs[pj - 1].end : targetRefs.length ? targetRefs[0].start : 0;
      insert(at, sourceRefs.slice(si, pi));
    }
    for (let k = ti; k < pj; k++) drop(targetRefs[k]);
    // A matched pair already resolves to the same asset; its alt text is left
    // alone so an already-translated description is not overwritten.
    si = pi + 1;
    ti = pj + 1;
  }
  return {edits, added, removed, replaced};
}

/**
 * Pair blocks for image alignment, preferring the earliest possible pair.
 *
 * `alignBlocks` minimises an edit cost and, when a page repeats the same block
 * shapes (prose/image/prose/image), several optimal alignments exist; its
 * backward walk then pairs the *tails* and leaves the head unpaired. Image
 * alignment needs the opposite: an image that stayed at the top of the page must
 * stay paired with the top of the translation, so this LCS over block shapes
 * walks forward and takes the first match.
 */
function alignImageBlocks(english, chinese) {
  const source = english.map(blockSignature);
  const target = chinese.map(blockSignature);
  const n = source.length;
  const m = target.length;
  if (n === 0 || m === 0) return new Map();
  const width = m + 1;
  const length = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      length[i * width + j] =
        source[i] === target[j]
          ? length[(i + 1) * width + j + 1] + 1
          : Math.max(length[(i + 1) * width + j], length[i * width + j + 1]);
    }
  }
  const pairs = new Map();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (source[i] === target[j]) {
      pairs.set(i, j);
      i++;
      j++;
    } else if (length[(i + 1) * width + j] >= length[i * width + j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/**
 * Would this block be empty once its images are gone?
 *
 * A heading whose visible text is a picture (`#### ![](icon) {#id}`) becomes an
 * empty heading if only the image is removed; the whole block has to go. Plain
 * prose keeps its text, so only whitespace, tags and the heading id may remain.
 */
function emptyAfterImages(block) {
  const stripped = String(block)
    .replace(IMAGE, '')
    .replace(/<\/?[A-Za-z][^<>]*?>/g, '')
    .replace(/[*_`\s]/g, '');
  return stripped === '' || /^#{1,6}\{#[^}]*\}$/.test(stripped);
}

/** Range that removes a block together with one separating blank line. */
function blockRemovalRange(text, start, end) {
  if (text.slice(Math.max(0, start - 2), start) === '\n\n') return {start: start - 2, end};
  if (text.slice(end, end + 2) === '\n\n') return {start, end: end + 2};
  return {start, end};
}

function applyEdits(text, edits) {
  // Edits never overlap; apply from the end so earlier offsets stay valid.
  const ordered = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  for (const edit of ordered) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

/**
 * Rebuild a body so its image references match the source, block by block.
 *
 * This is the structural half of a page refresh: the translated prose is not
 * re-translated and fenced code is never touched, but every image the source
 * added is inserted in the paragraph it belongs to, every image the source
 * dropped is removed, and an image whose asset was renamed keeps its place.
 *
 * Returns `{body, added, removed, replaced, warnings}`; `warnings` names the
 * cases that could not be aligned safely (for example a source `<img>` tag
 * where the overlay uses Markdown) so a caller can report them instead of
 * pretending the page is aligned.
 */
export function imageAlignment(sourceBody, targetBody, {sourceDir = null, overlayDir = null} = {}) {
  const context = {sourceDir, overlayDir};
  const source = String(sourceBody ?? '');
  const target = String(targetBody ?? '');
  const result = {body: target, added: 0, removed: 0, replaced: 0, warnings: []};
  const hasImage = /!\[[^\]]*\]\([^)]*\)/;
  if (!hasImage.test(source) && !hasImage.test(target)) return result;

  const sourceSpans = splitBlockSpans(source);
  const targetSpans = splitBlockSpans(target);
  const sourceBlocks = sourceSpans.map((span) => span.text);
  const targetBlocks = targetSpans.map((span) => span.text);
  const pairs = alignImageBlocks(sourceBlocks, targetBlocks);
  const targetToSource = new Map([...pairs].map(([sourceIndex, targetIndex]) => [targetIndex, sourceIndex]));
  const sourceHtml = new Set([...source.matchAll(HTML_IMAGE)].map((match) => match[1]));
  const warn = (warning) => result.warnings.push(warning);
  const edits = [];
  const unplaced = [];

  for (let sourceIndex = 0; sourceIndex < sourceBlocks.length; sourceIndex++) {
    const sourceRefs = imageRefs(sourceBlocks[sourceIndex]);
    if (sourceRefs.length === 0) continue;
    const targetIndex = pairs.get(sourceIndex);
    if (targetIndex === undefined) {
      unplaced.push({sourceIndex, refs: sourceRefs});
      continue;
    }
    const aligned = alignBlockImageRefs(
      sourceRefs,
      imageRefs(targetBlocks[targetIndex]),
      targetSpans[targetIndex].start,
      sourceHtml,
      warn,
      context,
    );
    edits.push(...aligned.edits);
    result.added += aligned.added;
    result.removed += aligned.removed;
    result.replaced += aligned.replaced;
  }

  // Target images with no source counterpart: the source deleted them, so the
  // overlay must not keep a link to an asset the page no longer shows.
  for (let targetIndex = 0; targetIndex < targetBlocks.length; targetIndex++) {
    const targetRefs = imageRefs(targetBlocks[targetIndex]);
    if (targetRefs.length === 0) continue;
    const sourceIndex = targetToSource.get(targetIndex);
    if (sourceIndex !== undefined && imageRefs(sourceBlocks[sourceIndex]).length) continue;
    if (isImageBlock(targetBlocks[targetIndex]) || emptyAfterImages(targetBlocks[targetIndex])) {
      const kept = targetRefs.filter((ref) => sourceHtml.has(ref.url));
      if (kept.length === 0) {
        const range = blockRemovalRange(target, targetSpans[targetIndex].start, targetSpans[targetIndex].end);
        edits.push({...range, text: ''});
        result.removed += targetRefs.length;
        continue;
      }
      warn({reason: 'html-image-in-source', url: kept[0].url});
      for (const ref of targetRefs) {
        if (sourceHtml.has(ref.url)) continue;
        edits.push({start: targetSpans[targetIndex].start + ref.start, end: targetSpans[targetIndex].start + ref.end, text: ''});
        result.removed += 1;
      }
      continue;
    }
    for (const ref of targetRefs) {
      if (sourceHtml.has(ref.url)) {
        warn({reason: 'html-image-in-source', url: ref.url});
        continue;
      }
      edits.push({start: targetSpans[targetIndex].start + ref.start, end: targetSpans[targetIndex].start + ref.end, text: ''});
      result.removed += 1;
    }
  }

  // A source image block with no aligned target block: insert it next to the
  // nearest block that did align. Anchoring on a paired block (rather than a
  // line number) keeps the picture in its own section.
  for (const {sourceIndex, refs} of unplaced) {
    let previous = null;
    for (let i = sourceIndex - 1; i >= 0; i--) {
      if (pairs.has(i)) {
        previous = pairs.get(i);
        break;
      }
    }
    let next = null;
    for (let i = sourceIndex + 1; i < sourceBlocks.length && next === null; i++) {
      if (pairs.has(i)) next = pairs.get(i);
    }
    const text = isImageBlock(sourceBlocks[sourceIndex])
      ? sourceBlocks[sourceIndex]
      : refs.map((ref) => renderImage(ref, context)).join('');
    if (previous !== null) {
      edits.push({start: targetSpans[previous].end, end: targetSpans[previous].end, text: `\n\n${text}`});
      result.added += refs.length;
    } else if (next !== null) {
      edits.push({start: targetSpans[next].start, end: targetSpans[next].start, text: `${text}\n\n`});
      result.added += refs.length;
    } else {
      warn({reason: 'unplaced-source-image', url: refs[0].url});
    }
  }

  if (edits.length === 0) return result;
  result.body = applyEdits(target, edits)
    // Removing an image can leave a run of blank lines; collapse it outside
    // fences so code samples stay byte-identical.
    .replace(/(?:\n[ \t]*){3,}/g, '\n\n');
  return result;
}

/**
 * Give the translation the source's image references in the source's order.
 *
 * The model (or an older capture) may carry stale assets or miss images the
 * source added; paths are not prose and must always match the English page.
 * Returns the aligned body; warnings are reported through `onWarning`.
 */
export function alignImages(sourceBody, targetBody, {onWarning} = {}) {
  const aligned = imageAlignment(sourceBody, targetBody);
  if (onWarning) for (const warning of aligned.warnings) onWarning(warning);
  return aligned.body;
}

/** Is this overlay explicitly preserved from regeneration? */
export function isPreservedOverlay(rel, sectionName) {
  return preservedOverlays().has(rel) || preservedOverlays().has(`${sectionName}/${rel}`);
}

/**
 * Point relative image URLs at the English source's files.
 *
 * Images live once, next to the English page. An overlay sits in a different
 * directory, so a copied `./img/x.webp` would resolve inside the overlay and
 * fail the build. The URL is rewritten to climb from the overlay back to the
 * repository root and then descend into the English source directory.
 */
export function rebaseImages(sourceDirRel, overlayRel, body) {
  const depth = overlayRel.split('/').length - 1;
  const climb = '../'.repeat(depth);
  const transform = (text) =>
    text.replace(IMAGE, (whole, alt, url) => {
      if (/^(?:[a-z]+:|\/|#)/i.test(url)) return whole;
      const resolved = path.posix.normalize(
        path.posix.join(sourceDirRel, url.replace(/^\.\//, '')),
      );
      return `![${alt}](${climb}${resolved})`;
    });
  return outsideFences(body, transform);
}

/**
 * Link normalisation lives in `links.mjs` (route table, relative Markdown links).
 * It is re-exported here because `derive.mjs` imports it from this module.
 */
export {rewriteLinks};

function legacyRelative(section, rel) {
  // The legacy trees mirror the site root: docs/, hardware/, blog/, changelog/.
  // Every docs version reuses the single legacy `docs/` tree.
  const prefix = section.name.startsWith('docs') ? 'docs' : section.source;
  return `${prefix}/${rel}`;
}

function findExact(section, legacyIndex, rel, sha) {
  const key = legacyRelative(section, rel);
  for (const area of section.legacy) {
    const entry = legacyIndex[area]?.[key];
    if (entry && entry.zhPath && entry.verified && entry.sha === sha) return entry;
  }
  return null;
}

function findReference(section, legacyIndex, rel) {
  const key = legacyRelative(section, rel);
  for (const area of section.legacy) {
    const entry = legacyIndex[area]?.[key];
    if (entry && entry.zhPath) return entry;
  }
  return null;
}

/**
 * Read a file the legacy index points at, or return null when it is gone.
 *
 * The legacy corpus is a local bootstrap tree that has been removed, while
 * `legacy-index.json` still lists its absolute paths. Index entries are already
 * filtered by `loadLegacy`, but an index can also be passed in by a caller, and
 * a file can disappear between load and read: both must degrade to the memory
 * path, never to an ENOENT or an empty page.
 */
function legacyFile(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** The Chinese body of an indexed legacy page, or null when unreadable. */
function legacyBody(entry) {
  const text = legacyFile(entry?.zhPath);
  return text === null ? null : splitFrontMatter(text).body;
}

/** The English body of an indexed legacy page, or null when unreadable. */
function legacyEnglish(entry) {
  const text = legacyFile(entry?.enPath);
  return text === null ? null : splitFrontMatter(text).body;
}

/**
 * The body of an existing overlay, or null when it is absent or unreadable.
 *
 * Read once per page: the CJK guard compares this body against the one the
 * rebuild produced, and `overlayHasChinese` asks the same question of it.
 */
function overlayBody(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return splitFrontMatter(fs.readFileSync(file, 'utf8')).body;
  } catch {
    return null;
  }
}

/**
 * Does an existing overlay still hold Chinese prose?
 *
 * When a rebuild produces nothing (`status === 'none'`), the only reason is
 * that no memory knows these blocks — typically a page whose wording came from
 * the legacy corpus, which is gone. Deleting or overwriting that overlay would
 * destroy the only Chinese copy, so it is kept and reported as `preserved`.
 */
function overlayHasChinese(file) {
  const body = overlayBody(file);
  return body === null ? false : CJK.test(body);
}

/** Fenced regions of a document, including their fence lines. */
function fenceRanges(body) {
  const lines = body.split('\n');
  const mask = fenceMask(body);
  const ranges = [];
  let start = -1;
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1;
    if (mask[i] && start === -1) start = offset;
    if (!mask[i] && start !== -1) {
      ranges.push({start, end: offset});
      start = -1;
    }
    offset += lineLength;
  }
  if (start !== -1) ranges.push({start, end: body.length});
  return ranges;
}

/** Put the English source's code back into a translated page (same order). */
function restoreCode(sourceBody, targetBody) {
  const source = fenceRanges(sourceBody).map((range) => sourceBody.slice(range.start, range.end));
  const target = fenceRanges(targetBody);
  if (source.length === 0 || source.length !== target.length) return targetBody;
  let out = '';
  let last = 0;
  for (let i = 0; i < target.length; i++) {
    out += targetBody.slice(last, target[i].start) + source[i];
    last = target[i].end;
  }
  return out + targetBody.slice(last);
}

/**
 * Rebuild an exact-match page on the English source's structure.
 *
 * Blocks are paired by shape, not by index: a translation can drop a horizontal
 * rule or merge paragraphs, and index pairing would then shift everything after
 * it. Code and rules always come from the English source; a block with no pair
 * falls back to the memory, and only then stays English.
 */
/** A candidate translation may never drop a component or a picture. */
function keepsComponents(english, translated) {
  return (
    componentTagCount(translated) >= componentTagCount(english) &&
    imageTagCount(translated) >= imageTagCount(english)
  );
}

export function rebuildFromPairs(sourceBody, translatedBody, lookup = () => null) {
  const spans = splitBlockSpans(sourceBody);
  const en = spans.map((span) => span.text);
  const zh = splitBlocks(translatedBody);
  if (en.length === 0 || zh.length === 0) return null;

  const mapping = sameBlockShape(en, zh)
    ? new Map(en.map((_, index) => [index, index]))
    : alignBlocks(en, zh);

  let hits = 0;
  let misses = 0;
  const out = [];
  let cursor = 0;
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    const block = span.text;
    // Keep the bytes between blocks (blank lines, indentation, trailing spaces)
    // exactly as the English source has them.
    out.push(sourceBody.slice(cursor, span.start));
    cursor = span.end;
    if (isHorizontalRule(block) || span.code || isImageBlock(block)) {
      out.push(block);
      continue;
    }
    // MDX/HTML components (`<Img ... />`, `<Tabs>`, `<details>`) are structure,
    // not prose. They come from the English source and are neither looked up nor
    // paired: the 7.26 capture dropped them, so a pairing would have nothing to
    // pair with and the `exactOnly` fallback below would keep the loss.
    if (isStructuralBlock(block) || isTagOnlyBlock(block)) {
      out.push(block);
      continue;
    }
    // A model translation is newer than the legacy page it would otherwise be
    // paired with (the legacy corpus sometimes left legal text in French or
    // Russian), so it wins when both exist.
    const fallback = lookup(block);
    if (fallback && keepsComponents(block, fallback)) {
      out.push(retargetLinks(fallback, block));
      hits++;
      continue;
    }
    const match = mapping.get(index);
    if (match !== undefined && zh[match] !== undefined && keepsComponents(block, zh[match])) {
      out.push(retargetLinks(zh[match], block));
      hits++;
      continue;
    }
    out.push(block);
    misses++;
  }
  out.push(sourceBody.slice(cursor));
  return {body: out.join(''), hits, misses};
}

/**
 * Rebuild a page whose English source changed, keeping every translation the
 * new source still supports.
 *
 * This is `translate --refresh-changed`'s rebuild primitive. It differs from
 * `rebuildFromPairs` in one way that matters: instead of pairing two *pages*,
 * each source block gets two independent lookups, so a changed paragraph can
 * never inherit the previous paragraph's wording.
 *
 *   lookup(block)  the translation memory, keyed by the *new* English block
 *   reuse(block)   the previous overlay's wording for a block whose English is
 *                  unchanged (the caller knows that from the per-block
 *                  fingerprints in `state/translation-state.json`)
 *
 * Code, images, rules and MDX components are copied from the English source
 * exactly as `rebuildFromPairs` does. A block with neither a memory hit nor a
 * reusable previous translation stays English and is counted in `misses`;
 * that is what the batch's normal translation queue then picks up.
 */
export function rebuildChangedPage(sourceBody, {lookup = () => null, reuse = () => null} = {}) {
  const spans = splitBlockSpans(sourceBody);
  const out = [];
  let cursor = 0;
  let tmHits = 0;
  let reused = 0;
  let misses = 0;
  for (const span of spans) {
    // Separators are the source's bytes: indentation, blank lines and trailing
    // spaces must not change because a page was refreshed.
    out.push(sourceBody.slice(cursor, span.start));
    cursor = span.end;
    const block = span.text;
    if (isHorizontalRule(block) || span.code || isImageBlock(block)) {
      out.push(block);
      continue;
    }
    if (isStructuralBlock(block) || isTagOnlyBlock(block)) {
      out.push(block);
      continue;
    }
    const hit = lookup(block);
    if (hit && keepsComponents(block, hit)) {
      out.push(retargetLinks(hit, block));
      tmHits++;
      continue;
    }
    const previous = reuse(block);
    if (previous && keepsComponents(block, previous)) {
      out.push(retargetLinks(previous, block));
      reused++;
      continue;
    }
    out.push(block);
    misses++;
  }
  out.push(sourceBody.slice(cursor));
  return {body: out.join(''), tmHits, reused, misses};
}

/**
 * Restore a translated admonition the block rebuild could not reassemble.
 *
 * A `:::note` that the manual glued to the surrounding prose is one blank-line
 * segment. `rebuildFromPairs` looks that segment up as a whole block, so its
 * container lines never match the line-level memory, while the memory does hold
 * the whole admonition (that is the unit `translate` stored). Match the English
 * container text in the rebuilt body and swap in the remembered translation;
 * a container that is already Chinese is left alone.
 */
export function repairAdmonitions(body, sourceBody, lookup) {
  let out = body;
  let fixed = 0;
  if (!lookup) return {body: out, fixed};
  for (const block of splitBlocks(sourceBody)) {
    const parts = splitAdmonitions(block);
    if (!parts || !parts.tail) continue;
    // An English (or wholly untranslated) container is replaced by address, the
    // common case for a rebuilt page.
    let target = out.includes(block) ? block : null;
    if (!target) {
      // A container that an earlier build split into paragraphs can be half
      // Chinese: the opener and the first paragraph stayed English while the
      // rest was translated. It is still the same warning, so pair it by
      // container type and the English paragraph it carries, then replace the
      // whole container instead of leaving the mixed text in place.
      const englishParagraphs = bodyParagraphs(parts.body).filter((text) => text.trim() !== '');
      const anchor = englishParagraphs.find((text) => /[A-Za-z]{3,}/.test(text));
      if (!anchor) continue;
      target =
        splitBlocks(out).find((candidate) => {
          const found = splitAdmonitions(candidate);
          if (!found || !found.tail || found.type !== parts.type) return false;
          const paragraphs = bodyParagraphs(found.body);
          return paragraphs.some((text) => normalize(text) === normalize(anchor));
        }) || null;
    }
    if (!target) continue;
    const translated = lookup(block);
    if (!translated || translated === block) continue;
    out = out.replace(target, retargetLinks(translated, block));
    fixed++;
  }
  return {body: out, fixed};
}

/**
 * Put the English source's component blocks back into a translated page.
 *
 * Structure is not translatable, yet every rebuild path that keeps a legacy page
 * verbatim ("exactOnly" with one untranslated block) also keeps whatever the
 * capture lost. The 7.26 Chinese capture dropped all 408 `<Img ... />` blocks,
 * which is why 73 hardware pages shipped without their product pictures. A
 * component that is missing is therefore copied from the English source, placed
 * next to the nearest neighbouring block that survived in the translation.
 */
export function restoreStructureBlocks(sourceBody, targetBody) {
  const sourceBlocks = splitBlocks(sourceBody);
  const required = sourceBlocks.filter((block) => isStructuralBlock(block));
  if (required.length === 0) return targetBody;

  const needed = new Map();
  const present = new Map();
  for (const block of required) {
    const count = (needed.get(block) || 0) + 1;
    needed.set(block, count);
    present.set(block, targetBody.split(block).length - 1);
  }
  const missing = [];
  for (const [block, count] of needed) {
    if ((present.get(block) || 0) < count) missing.push(block);
  }
  if (missing.length === 0) return targetBody;

  let body = targetBody;
  for (const block of missing) {
    const index = sourceBlocks.indexOf(block);
    let insertAt = -1;
    // Prefer the next surviving source block as the anchor: the picture belongs
    // above the section that follows it, which is stable across captures.
    for (let i = index + 1; i < sourceBlocks.length; i++) {
      const anchorBlock = sourceBlocks[i];
      if (isStructuralBlock(anchorBlock)) continue;
      const at = body.indexOf(`\n${anchorBlock}\n`);
      if (at !== -1) {
        insertAt = at + 1;
        break;
      }
    }
    if (insertAt === -1) {
      // Nothing follows it in the translation: fall back to the nearest block
      // that precedes it, and only then append.
      for (let i = index - 1; i >= 0; i--) {
        const anchorBlock = sourceBlocks[i];
        if (isStructuralBlock(anchorBlock)) continue;
        const at = body.indexOf(`\n${anchorBlock}\n`);
        if (at !== -1) {
          insertAt = at + anchorBlock.length + 2;
          break;
        }
      }
    }
    if (insertAt === -1) {
      body = `${body.replace(/\n+$/, '')}\n\n${block}\n`;
    } else {
      body = `${body.slice(0, insertAt)}${block}\n\n${body.slice(insertAt)}`;
    }
  }
  return body;
}

/** `docs` is the current tree; a versioned section carries its version. */
function sectionVersion(section) {
  const match = /version-(\d+\.\d+)/.exec(section.source);
  return match ? match[1] : currentVersion();
}

export function applySection(section, memory, legacyIndex, {write = true, titleMemory = new Map(), modelMemory = new Map(), commentMemory = new Map(), tm = null, adopt = false, titleIndex = null, allowCjkLoss = false, log = true, locale = section.locale || DEFAULT_TARGET_LOCALE} = {}) {
  if (section.derivedFrom) {
    process.stderr.write(
      `skip ${section.name}: derived from ${section.derivedFrom}; run translate:derive instead\n`,
    );
    return {
      files: 0,
      full: 0,
      partial: 0,
      stale: 0,
      missing: 0,
      pendingBlocks: 0,
      commentHits: 0,
      commentMisses: 0,
      anchorsAdded: 0,
      anchorsRetargeted: 0,
      orphansRemoved: 0,
      legacySkipped: 0,
      preserved: 0,
      preservedCjk: 0,
      cjkLossAllowed: 0,
    };
  }
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  const files = walkMarkdown(sourceBase);
  const state = {section: section.name, files: 0, full: 0, partial: 0, stale: 0, missing: 0, preserved: 0, preservedCjk: 0, cjkLossAllowed: 0, commentHits: 0, commentMisses: 0, anchorsAdded: 0, anchorsRetargeted: 0, legacySkipped: 0, entries: {}};
  let pendingBlocks = 0;

  for (const sourcePath of files) {
    const rel = relative(sourceBase, sourcePath);
    const patch = loadPatch(locale, section.name, rel);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const {frontMatter: sourceFm, body: sourceBody} = splitFrontMatter(source);
    const sha = digest(sourceBody);
    const overlayPath = path.join(overlayBase, rel);
    if (
      (preservedOverlays().has(rel) || preservedOverlays().has(`${section.name}/${rel}`)) &&
      fs.existsSync(overlayPath)
    ) {
      // The reviewed overlay is kept byte for byte (see config/translation.yml).
      state.entries[`${section.source}/${rel}`] = {
        section: section.name,
        source: `${section.source}/${rel}`,
        overlay: `${section.overlay}/${rel}`,
        mode: 'preserved',
        status: 'full',
        blocks: 0,
        hits: 0,
        misses: 0,
        commentHits: 0,
        commentMisses: 0,
        title: false,
      };
      state.full++;
      continue;
    }

    // A legacy hit whose files are gone is skipped and counted, so the page
    // falls through to the global TM / model memory instead of aborting the run.
    let exact = findExact(section, legacyIndex, rel, sha);
    let exactBody = legacyBody(exact);
    if (exact && exactBody === null) {
      legacySkipped++;
      exact = null;
    }
    let reference =
      section.exactOnly && !adopt ? exact : exact || findReference(section, legacyIndex, rel);
    let referenceBody = reference && reference === exact ? exactBody : legacyBody(reference);
    if (reference && referenceBody === null) {
      legacySkipped++;
      reference = null;
    }
    if (!reference && adopt && titleIndex) {
      // The page was moved or renamed: adopt the legacy page with the same
      // unique English title, but only when the two bodies really overlap. A
      // generic title ("User Guides") can still pick the wrong section.
      const title = readField(sourceFm, 'title');
      const candidate = title ? titleIndex.get(title.trim()) : null;
      const legacyEn = candidate ? legacyEnglish(candidate) : null;
      if (candidate && legacyEn === null) legacySkipped++;
      if (legacyEn !== null) {
        const known = new Set(splitBlocks(legacyEn).map(normalize));
        const blocks = splitBlocks(sourceBody);
        const overlap = blocks.length
          ? blocks.filter((block) => known.has(normalize(block))).length / blocks.length
          : 0;
        if (overlap >= 0.35) {
          reference = candidate;
          referenceBody = legacyBody(candidate);
          if (referenceBody === null) {
            legacySkipped++;
            reference = null;
          }
        }
      }
    }
    const lookup = (block) => {
      const key = normalize(block);
      if (patch && patch.keepEnglish.has(key)) return block;
      // The global memory already applies the agreed order
      // (model > legacy 7.24 > legacy 7.25) and drops the section from the key,
      // so a paragraph translated for one section is reusable in another.
      if (tm) return lookupBlockLines(tm, block);
      const generated = modelMemory.get(`${section.name}\u0000${key}`);
      if (generated !== undefined) return generated;
      if (section.exactOnly || !memory) return null;
      const hit = memory.get(key);
      return hit === undefined ? null : hit;
    };

    let translated = '';
    let hits = 0;
    let misses = 0;
    let mode = 'memory';

    if (exact && exactBody !== null) {
      const legacyZh = exactBody;
      const rebuilt = rebuildFromPairs(sourceBody, legacyZh, lookup);
      if (rebuilt && section.exactOnly && rebuilt.misses > 0) {
        // A non-versioned section has no other page to fall back to: keep the
        // whole legacy page and restore the source's code.
        translated = restoreCode(sourceBody, legacyZh);
        hits = splitBlocks(sourceBody).length;
      } else if (rebuilt) {
        translated = rebuilt.body;
        hits = rebuilt.hits;
        misses = rebuilt.misses;
      } else {
        // Same text, different block structure: keep the translated page and put
        // the source's code back so nothing drifts into a fence.
        translated = restoreCode(sourceBody, legacyZh);
        hits = splitBlocks(sourceBody).length;
      }
      mode = 'exact';
    } else if (adopt && reference && referenceBody !== null) {
      // Adopt the legacy translation even though the English moved on. The page
      // is complete Chinese, but it describes the earlier capture, so it is
      // reported as stale instead of silently treated as current.
      const legacyZh = referenceBody;
      const rebuilt = rebuildFromPairs(sourceBody, legacyZh, lookup);
      if (rebuilt && rebuilt.misses === 0) {
        translated = rebuilt.body;
        hits = rebuilt.hits;
      } else {
        translated = restoreCode(sourceBody, legacyZh);
        hits = splitBlocks(sourceBody).length;
      }
      misses = 0;
      mode = 'adopted';
    } else if (section.exactOnly) {
      // Non-versioned sections never adopt a whole legacy page (an older 7.26
      // capture may look similar without being the same page), but their blocks
      // are still looked up: a block whose English is identical has a safe
      // translation, and dropping it would overwrite a good page with English.
      const result = translateBlocks(sourceBody, lookup);
      translated = result.body;
      hits = result.hits;
      misses = result.misses;
    } else {
      const result = translateBlocks(sourceBody, lookup);
      translated = result.body;
      hits = result.hits;
      misses = result.misses;
    }

    // A legacy reference can be empty for a page that does have content (two
    // CLI pages were captured with front matter only). Reproducing that would
    // ship a blank page: translate the real body instead.
    if (!translated.trim() && sourceBody.trim()) {
      const result = translateBlocks(sourceBody, lookup);
      translated = result.body;
      hits = result.hits;
      misses = result.misses;
      mode = 'memory';
    }

    // An adopted page keeps the legacy wording, but blocks the legacy capture
    // left in English (property tables above all) are still looked up in the
    // memory: otherwise `apply` would undo every table translated since.
    {
      const upgraded = translateBlocks(translated, lookup);
      if (upgraded.hits) {
        translated = upgraded.body;
        hits += upgraded.hits;
        if (mode === 'adopted') mode = 'rebuilt';
      }
      const table = translateTableLines(tm, translated);
      if (table.changed) {
        translated = table.body;
        hits += table.changed;
        if (mode === 'adopted') mode = 'rebuilt';
      }
    }
    // A warning glued to its surrounding prose (no blank line between them) is
    // rebuilt as one segment, so its container never matched; repair it from the
    // whole-admonition memory entry that `translate` wrote.
    {
      const admonitions = repairAdmonitions(translated, sourceBody, lookup);
      if (admonitions.fixed) {
        translated = admonitions.body;
        hits += admonitions.fixed;
        if (mode === 'adopted') mode = 'rebuilt';
      }
    }

    const englishTitleForMemory = readField(sourceFm, 'title');
    const titleZh =
      (patch && patch.title) ||
      (tm ? lookupTitle(tm, englishTitleForMemory) : null) ||
      titleMemory.get(`title:${englishTitleForMemory}`) ||
      reference?.title ||
      null;
    const englishTitle = readField(sourceFm, 'title');
    const englishLabel = readField(sourceFm, 'sidebar_label');
    // `frontMatter.sidebar_label` beats the translated sidebar catalogue in
    // Docusaurus, so it must be Chinese here — never a copy of the English one.
    const sidebarZh = englishLabel
      ? sidebarLabelZh({englishLabel, englishTitle, zhTitle: titleZh, zhLabel: reference?.sidebarLabel || null})
      : null;

    // Safety net for every rebuild path (including the legacy-verbatim ones):
    // a component block the translation does not carry comes from the source.
    translated = restoreStructureBlocks(sourceBody, translated);
    translated = rewriteLinks(translated, {
      version: sectionVersion(section),
      section,
      fromFile: rel,
      titleFor: (entry) => pageTitles(section, entry),
    });
    translated = alignImages(sourceBody, translated);
    translated = rebaseImages(
      path.posix.dirname(`${section.source}/${rel}`),
      `${section.overlay}/${rel}`,
      translated,
    );
    translated = applyReplacements(translated, patch);

    // `code-verbatim-except-comments`: the fences above are the English source's
    // bytes, so this pass can only change a line that the classifier accepted as
    // a comment. Everything else stays byte-identical.
    const comments = translateCodeComments(translated, (key) =>
      tm ? lookupCommentKey(tm, key) : (commentMemory.get(key) ?? null),
    );
    translated = comments.body;
    state.commentHits += comments.hits;
    state.commentMisses += comments.misses.length;

    // The Chinese headings carry the English ids, so the anchors the English
    // pages publish keep working (see `anchors.mjs`).
    const anchors = addHeadingAnchors(translated, sourceBody);
    translated = anchors.body;
    state.anchorsAdded += anchors.added;
    state.anchorsRetargeted += anchors.retargeted;

    // The `description` shows up in `<meta name="description">` and in the tag
    // pages (`/tags/<tag>` lists every doc with its description), so it belongs
    // to the translation scope like the title does.
    const englishDescription = readField(sourceFm, 'description');
    const descriptionZh = englishDescription
      ? ((tm ? lookupTitle(tm, englishDescription) : null) || titleMemory.get(`description:${englishDescription}`) || null)
      : null;
    // Colours are language independent: the table cells keep their `<code>`
    // spans through translation, so re-wrap them here as the English page does.
    translated = applyInlineColors(
      translated,
      loadInlineColors(sectionVersion(section))[rel.replace(/\.md$/i, '')],
    ).body;

    // `source` and `captured_at` describe the English page this overlay mirrors
    // and are copied from it verbatim (see `copyKeys`); the footer reads
    // `captured_at`, so an overlay without it prints no capture time.
    //
    // A `description` with no remembered translation keeps the English sentence
    // instead of being dropped. Dropping it was a data-loss bug: the key is part
    // of the page contract (`verify` reports `missing:description`) and the tag
    // pages read it, so an untranslated page lost its meta description and its
    // tag card. The English text is a truthful placeholder that the next
    // `translate` run replaces; `apply` itself stays offline.
    const translatedDescription =
      descriptionZh && /[\u4e00-\u9fff]/.test(descriptionZh) ? descriptionZh : englishDescription;
    let frontMatter = copyKeys(
      withFields(sourceFm, {
        title: titleZh && titleZh !== englishTitle ? titleZh : null,
        sidebar_label: sidebarZh || null,
        description: translatedDescription,
        // Provenance is appended to the overlay only; the English source keeps
        // its original front matter byte for byte.
        ...translationProvenance(),
      }),
      sourceFm,
    );

    // `Back To Home` is annotated on its first appearance only (see
    // `term-annotate.mjs`); the front matter is scanned first so the title wins
    // the parenthesis and the body stays plain. The pass is idempotent, which is
    // what lets it run on every rebuild.
    const annotated = annotateDocumentTerms(frontMatter, translated.trim());
    frontMatter = annotated.frontMatter;
    const bodyZh = annotated.body;

    const titleTranslated = Boolean(titleZh && titleZh !== englishTitle);
    // A page whose body is only a component (`<DocCardList />`) has no prose to
    // translate, but its `description` still is translation evidence. Without
    // this the overlay (front matter included) was deleted as "nothing done".
    const descriptionTranslated = Boolean(descriptionZh && CJK.test(descriptionZh));
    // Image rebasing changes the body without translating anything, so the
    // status is decided by the translation evidence, not by string equality.
    let status =
      mode === 'adopted'
        ? 'stale'
        : hits === 0 && !titleTranslated && !descriptionTranslated
          ? 'none'
          : misses === 0
            ? 'full'
            : 'partial';

    // Nothing was rebuilt, but a Chinese overlay is already on disk: keep it
    // byte for byte instead of deleting it. The legacy corpus that produced it
    // is gone, so no memory can regenerate it; losing it would be permanent.
    const kept = status === 'none' && overlayHasChinese(overlayPath);
    if (kept) status = 'preserved';
    const translatedSomething = status !== 'none' && !kept;

    // A rebuild that writes a page may not lose its Chinese.
    //
    // The overlay on disk is the only copy of some pages: the legacy corpus is
    // gone and `harvest` skips a page whole when its block shape does not line
    // up with the English capture. For those pages a rebuild is not a refresh
    // but an English rewrite, and no status above catches it — the memory can
    // translate *some* blocks (status `partial`) while the rest falls back to
    // English. So the page-level invariant is checked here, on the bytes that
    // would actually be written.
    //
    // "Lose" is measured with the 5% tolerance in `cjk.mjs`
    // (`CJK_REGRESSION_RATIO`): a wording update that trims a sentence is not a
    // regression, a paragraph replaced by English is. An absent overlay (old 0)
    // and an English page (0 -> 0) are unaffected, and a page that keeps its
    // level or gains text writes as before. `--allow-cjk-loss` is the explicit
    // opt-out for a deliberate shortening.
    let cjkLoss = null;
    if (translatedSomething) {
      const oldBody = overlayBody(overlayPath);
      const lost = cjkRegression(oldBody, bodyZh);
      if (lost) {
        if (allowCjkLoss) {
          state.cjkLossAllowed++;
          if (log) {
            process.stderr.write(
              `cjk-loss-allowed: ${section.overlay}/${rel} zh ${lost.old} -> ${lost.new}\n`,
            );
          }
        } else {
          cjkLoss = lost;
          status = 'preserved';
          state.preservedCjk++;
          if (log) {
            process.stderr.write(`preserved: ${section.overlay}/${rel} zh ${lost.old} -> ${lost.new}\n`);
          }
        }
      }
    }

    if (status === 'none') state.missing++;
    else if (status === 'full') state.full++;
    else if (status === 'stale') state.stale++;
    else if (status === 'preserved') state.preserved++;
    else state.partial++;
    // A preserved regression still has English blocks waiting, so it keeps
    // counting as pending work: the next `translate` run is what lets a later
    // `apply` pass the guard and write the page.
    if (status === 'partial' || cjkLoss) pendingBlocks += misses;

    const target = overlayPath;
    const willWrite = !kept && !cjkLoss && write && translatedSomething;
    // The refresh pass compares these against the source on disk. A page that
    // keeps its previous bytes (`kept`/`cjkLoss`) must keep its previous
    // fingerprints too, or the next refresh would treat the old overlay as
    // current.
    const rendered = willWrite ? renderDocument(frontMatter, bodyZh) : null;

    state.entries[`${section.source}/${rel}`] = {
      section: section.name,
      source: `${section.source}/${rel}`,
      overlay: `${section.overlay}/${rel}`,
      sha,
      mode,
      status,
      blocks: hits + misses,
      hits,
      misses,
      commentHits: comments.hits,
      commentMisses: comments.misses.length,
      title: Boolean(titleZh && titleZh !== englishTitle),
      ...(rendered
        ? {
            source_sha256: sha256Hex(source),
            overlay_sha256: sha256Hex(rendered),
            source_blocks: encodeBlockHashes(blockHashes(sourceBody)),
          }
        : {}),
      ...(cjkLoss
        ? {preservedReason: 'cjk-regression', cjkOld: cjkLoss.old, cjkNew: cjkLoss.new}
        : {}),
    };

    // A preserved page (or one that would lose Chinese) keeps the overlay it
    // already has: no deletion, no write.
    if (kept || cjkLoss) continue;
    if (write && !translatedSomething && fs.existsSync(target)) fs.rmSync(target);
    if (!write || !translatedSomething) continue;
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, rendered);
  }

  state.files = files.length;
  state.pendingBlocks = pendingBlocks;
  return state;
}

export function cleanupOverlay(section, state) {
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) return 0;
  let removed = 0;
  for (const file of walkMarkdown(overlayBase)) {
    const rel = relative(overlayBase, file);
    if (!fs.existsSync(path.join(REPO, section.source, rel))) {
      fs.rmSync(file);
      removed++;
    }
  }
  return removed;
}

export {SECTIONS};
