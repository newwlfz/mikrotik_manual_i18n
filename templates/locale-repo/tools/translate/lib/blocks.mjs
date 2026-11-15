/**
 * Block segmentation that keeps the source text byte-identical.
 *
 * `\n{2,}` is the unit the legacy translation pipeline used, so the same rule
 * makes its output addressable here without re-chunking anything. Separators
 * are carried separately, which lets a rebuild reuse the English source's line
 * breaks instead of inventing new ones.
 *
 * Fenced code is detected line by line (`fenceMask`) rather than by scanning
 * segments: the official pages open fences inside list items ("9. ```ros"), and
 * a naive segment toggle desynchronises and starts treating prose as code.
 */

import {
  bodyParagraphs,
  isTranslatableAdmonition,
  parseAdmonitionCloser,
  parseAdmonitionOpener,
  splitAdmonitions,
} from './admonitions.mjs';
import {languageText} from './prose.mjs';

const SEPARATOR = /(\r?\n[ \t]*\r?\n(?:\r?\n)*)/;
const OPENER = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?(```+|~~~+)/;
const CLOSER = /^\s*(```+|~~~+)\s*$/;

export function segments(text) {
  const parts = text.split(SEPARATOR);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const value = parts[i];
    if (value === '') continue;
    out.push({kind: i % 2 === 1 ? 'sep' : 'text', value});
  }
  return out;
}

/** One boolean per line: true when the line belongs to a fenced code block. */
export function fenceMask(body) {
  const mask = [];
  let marker = null;
  for (const line of body.split('\n')) {
    if (marker) {
      mask.push(true);
      if (CLOSER.test(line) && line.trim().startsWith(marker)) marker = null;
      continue;
    }
    const match = OPENER.exec(line);
    if (match) {
      marker = match[1];
      mask.push(true);
    } else {
      mask.push(false);
    }
  }
  return mask;
}

/**
 * Segments with their line span in the original body.
 *
 * `code` here answers "does this segment contain fence bytes?", which is what
 * `outsideFences` needs: a transform must never touch a code sample. It is not
 * the block-level question ("is this block code?"); use `splitBlockSpans` /
 * `isCodeBlock` for that, or a warning that shows a command would look like code.
 */
export function segmentSpans(body) {
  const mask = fenceMask(body);
  const spans = [];
  let line = 0;
  for (const part of segments(body)) {
    const count = part.value.split('\n').length;
    spans.push({part, start: line, end: line + count, code: mask.slice(line, line + count).some(Boolean)});
    // A part advances the line cursor by the number of newlines it contains; the
    // next part starts after the last newline, not after the whole part.
    line += count - 1;
  }
  return spans;
}

/**
 * A line that is one whole block-level component tag.
 *
 * Only the tags that stand alone as blocks are listed: `<p>text</p>` is an HTML
 * paragraph and belongs to the prose, while `<Img ... />` / `<img ...>` carry a
 * picture and nothing to translate.
 */
const COMPONENT_LINE = /^\s*<\/?(?:Img|img|Tabs|TabItem|details|summary)\b[^<>]*?\/?>\s*$/;
const VOID_COMPONENT_LINE = /^\s*<(?:Img|img)\b[^<>]*?\/?>\s*$/;

/** Line index of the `:::` that closes the container opened at `start`. */
function admonitionEnd(lines, start, marker) {
  let depth = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const closer = parseAdmonitionCloser(lines[i]);
    if (closer) {
      if (closer !== marker) continue;
      if (depth === 0) return i;
      depth--;
      continue;
    }
    const nested = parseAdmonitionOpener(lines[i]);
    if (nested && nested.marker === marker) depth++;
  }
  return -1;
}

/**
 * The blocks of `text` with their exact character span in the source.
 *
 * `splitBlocks` only returns the trimmed text, which is all the translation
 * memory needs. A rebuild, however, has to put a block back where it came from:
 * iterating the blank-line segments while indexing the block array (a merged
 * admonition is one block but two segments) shifted every pair after the first
 * `:::note`, replacing closers with images and `<WideTable>` with `</WideTable>`.
 * Returning spans keeps blocks and positions on the same numbering.
 */
export function splitBlockSpans(text) {
  const src = String(text);
  const lines = src.split('\n');
  const mask = fenceMask(src);
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  const blocks = [];
  let current = [];
  const push = (first, last) => {
    let start = first;
    let end = last;
    while (start <= end && lines[start].trim() === '') start++;
    while (end >= start && lines[end].trim() === '') end--;
    if (start > end) return;
    const raw = lines.slice(start, end + 1).join('\n');
    const value = raw.trim();
    if (value === '') return;
    const lead = raw.length - raw.trimStart().length;
    const from = offsets[start] + lead;
    blocks.push({
      text: value,
      start: from,
      end: from + value.length,
      // See `isCodeBlock`: an admonition that merely shows a command inside its
      // body is prose for translation purposes, and its fences are preserved by
      // `renderAdmonition`. Only a whole fenced block (or a fragment that lives
      // entirely inside one) is code.
      code: isCodeBlock(raw, mask.slice(start, end + 1)),
    });
  };
  const flush = () => {
    if (current.length) push(current[0], current[current.length - 1]);
    current = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A fenced region is always one block of its own.
    //
    // Two shapes used to be broken here. A capture may put a paragraph directly
    // above a fence with no blank line (7.25's `vrrp` does: "Example
    // `connection-tracking-mode` configuration:" then ```), and a fence may
    // contain a blank line (`R1 … blank … R2`). Because the blank line flushed
    // the block and the fence span was only recognised when the *first* line was
    // a fence, both produced fragments: prose glued to half a fence, then the
    // other half. The prose fragment was never queued (it contained a fence) and
    // `verify` could not recognise it, so those paragraphs stayed English while
    // every counter read zero. Splitting on the fence run fixes both: a fence
    // never shares a block with prose and never spans two blocks.
    if (mask[i] && (i === 0 || !mask[i - 1])) {
      flush();
      let end = i;
      while (end + 1 < lines.length && mask[end + 1]) end++;
      push(i, end);
      i = end;
      continue;
    }
    if (/^[ \t]*$/.test(line)) {
      flush();
      continue;
    }
    // An `<Img ... />` on its own line is a block, even when the page wrapped it
    // in a paragraph without a blank line: merging it into the neighbouring prose
    // hands the picture to the translator, which returns text and drops the tag.
    if (VOID_COMPONENT_LINE.test(line)) {
      flush();
      push(i, i);
      continue;
    }
    // An admonition is one block even when a blank line separates its title from
    // its body: that blank line is inside the container, not between blocks. A
    // container without its closing `:::` stays split the old way, so a fragment
    // is never mistaken for a whole admonition.
    const opener = parseAdmonitionOpener(line);
    // A `:::note` inside a fenced sample is code, not a container: merging from
    // there would swallow the fence closing and hand the following prose to the
    // translator as if it were part of the sample.
    if (opener && !mask[i]) {
      const end = admonitionEnd(lines, i, opener.marker);
      if (end !== -1) {
        flush();
        push(i, end);
        i = end;
        continue;
      }
    }
    current.push(i);
  }
  flush();
  return blocks;
}

export function splitBlocks(text) {
  return splitBlockSpans(text).map((block) => block.text);
}


/**
 * Comparison key for an English block.
 *
 * The legacy captures use version-prefixed links (`/docs/7.25/...`) while the
 * mirror's current tree uses `/docs/...`; that difference is presentation, not
 * content, and must not hide a reusable translation. Whitespace collapses so a
 * re-wrapped paragraph still matches.
 */
/**
 * Canonical form of an internal documentation link.
 *
 * Between captures the official pages and the mirror's link repair rewrite the
 * same target in several ways: `/docs/7.25/x.md`, `/docs/7.25/x/`, `/docs/x`,
 * `/docs/x/index`. All of them address one route, so the comparison must ignore
 * the spelling.
 */
export function canonicalDocLink(url) {
  let out = url.replace(/^\/docs\/(?:7\.\d+|current)\//, '/docs/');
  out = out.replace(/[?#].*$/, '');
  out = out
    .replace(/\/index\.mdx?$/, '')
    .replace(/\/index$/, '')
    .replace(/\.mdx?$/, '')
    .replace(/\/$/, '');
  return out === '' ? '/docs' : out;
}

/**
 * Link targets of a block, in order. Images are excluded: their paths are
 * handled separately so an asset rename never looks like a text change.
 */
export function linkTargets(block) {
  const out = [];
  const pattern = /(?<!\!)\[[^\]]*\]\(([^)\s]+)\)/g;
  let match;
  while ((match = pattern.exec(block)) !== null) out.push(match[1]);
  return out;
}

/** Point a reused translation's links at the current English targets. */
export function retargetLinks(translated, english) {
  const targets = linkTargets(english);
  if (targets.length === 0) return translated;
  let index = 0;
  return translated.replace(/(?<!\!)\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, text) =>
    index < targets.length ? `[${text}](${targets[index++]})` : whole,
  );
}

export function normalize(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => `![${alt}](ASSET)`)
    .replace(/(?<!\!)\[([^\]]*)\]\([^)\s]+\)/g, (_, text) => `[${text}](LINK)`)
    // Rendered table cells carry raw HTML anchors, and the official site writes
    // them with a version prefix (`/docs/7.24/...`). Two versions whose table
    // differs only in those targets are the same table; without this the whole
    // block misses and a translated table falls back to English.
    .replace(/(\s(?:href|src)=")[^"]*(")/gi, '$1LINK$2')
    .replace(/\/docs\/(?:7\.\d+|current)\//g, '/docs/')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isHorizontalRule(block) {
  return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(block);
}

export function hasFence(block) {
  return block.split('\n').some((line) => OPENER.test(line) || CLOSER.test(line));
}

/**
 * Is this block fenced code?
 *
 * "The block contains a fence line" is not the same question, and treating it
 * as one was the bug: an admonition (`:::note … :::`) that shows a command in
 * the middle of its body contains a fence, so every stage — the block splitter,
 * `translateBlocks`, the model queue and `verify` — classified the whole warning
 * as code and never translated or counted it. 32 fenced warnings stayed English
 * that way while every counter read zero.
 *
 * A block is code only when
 *   1. its first content line is a fence opener (a whole fenced block, including
 *      the list-prefixed `9. ```ros` form), or
 *   2. every non-blank line already lives inside a fence (a fragment of a code
 *      block that a blank line split off).
 *
 * `mask` is the fence mask of the *containing body*, aligned with the block's
 * lines. Without it the block is masked on its own, which is correct for whole
 * blocks and for admonitions, but not for a fragment that starts in the middle
 * of a fence; callers that hold the body must pass the slice.
 */
export function isCodeBlock(block, mask) {
  const lines = String(block).split('\n');
  const first = lines.find((line) => line.trim() !== '');
  if (first !== undefined && OPENER.test(first)) return true;
  const inside = Array.isArray(mask) && mask.length === lines.length ? mask : fenceMask(block);
  return lines.every((line, index) => line.trim() === '' || inside[index]);
}

/**
 * Body paragraphs that are entirely fenced code.
 *
 * An admonition body may carry code between its paragraphs. Those paragraphs are
 * not language: `renderAdmonition` already declines them, but the queue and the
 * verifier need the same answer to avoid sending a command to the model and to
 * avoid reporting a byte-identical code sample as untranslated prose. The mask
 * is computed over the whole body, so a code block whose blank line splits it in
 * two still marks both halves.
 */
export function codeParagraphs(body) {
  const text = String(body ?? '');
  const mask = fenceMask(text);
  const out = new Set();
  let cursor = 0;
  for (const paragraph of bodyParagraphs(text)) {
    // `indexOf` keeps the paragraph's original offset; `bodyParagraphs` returns
    // the same bytes the segments carry.
    const at = text.indexOf(paragraph, cursor);
    if (at === -1) continue;
    cursor = at + paragraph.length;
    const line = text.slice(0, at).split('\n').length - 1;
    const lines = paragraph.split('\n');
    if (lines.every((value, index) => value.trim() === '' || mask[line + index])) {
      out.add(paragraph);
    }
  }
  return out;
}

const TAG = /<\/?([A-Za-z][\w.:-]*)\b[^<>]*?\/?>/g;

/**
 * Is this block pure structure — MDX/HTML component tags with no prose?
 *
 * A hardware page carries one `<p><Img src="..." alt="" /></p>` block per
 * screenshot. Removing every tag leaves nothing, so the block has no natural
 * language: it must be copied byte for byte, never sent to the translator and
 * never replaced by a (possibly empty) translation. `<p>real prose</p>` keeps
 * its text after the strip and is still translated.
 */
export function isStructuralBlock(block) {
  // A `:::note` container looks like a component line but carries prose; it must
  // never be copied as structure.
  if (parseAdmonitionOpener(String(block).split('\n')[0])) return false;
  const lines = String(block).split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  let sawComponent = false;
  for (const line of lines) {
    if (!/^</.test(line)) return false;
    if (componentTagCount(line) > 0) sawComponent = true;
    const rest = line.replace(TAG, '').trim();
    if (rest !== '') return false;
  }
  return sawComponent;
}

/**
 * How many component tags a block carries. A translation that returns fewer has
 * eaten structure, which is never acceptable: the English block wins instead.
 */
export function componentTagCount(block) {
  return (String(block).match(/<\/?(?:Img|img|Tabs|TabItem|details|summary)\b/g) || []).length;
}

/**
 * Replace translatable blocks of `body`, copying fenced code, the bytes between
 * blocks, and anything the replacer declines. `replacer` receives the block text
 * and returns Chinese text or null.
 *
 * The unit is `splitBlockSpans`, not the blank-line `segments`: an admonition is
 * one block even when a blank line separates its title from its body. Splitting
 * on blank lines there handed the opener and the first paragraph to the replacer
 * as one fragment and the remaining paragraphs as another, so a `:::note` with
 * two paragraphs came back half translated (`:::note` + English paragraph, then a
 * Chinese paragraph + `:::`). The memory entry was then keyed by that mixed text,
 * which no later rebuild could match against the English source.
 */
export function translateBlocks(body, replacer) {
  const source = String(body);
  const out = [];
  let hits = 0;
  let misses = 0;
  let cursor = 0;
  for (const span of splitBlockSpans(source)) {
    // Keep the blank lines and indentation before the block exactly as written.
    out.push(source.slice(cursor, span.start));
    cursor = span.end;
    const block = span.text;
    if (span.code) {
      out.push(block);
      continue;
    }
    // Structure is copied, never translated: a component-only block has no
    // natural language, and a replacer that returns '' would delete the picture.
    if (isStructuralBlock(block) || isTagOnlyBlock(block)) {
      out.push(block);
      continue;
    }
    // `<center>![](./img/x.webp)</center>` is a picture, not prose. Sending it to
    // a translator (or looking it up in a memory that stored a caption-only
    // variant) dropped the whole line; the picture now always stays.
    if (isImageBlock(block)) {
      out.push(block);
      continue;
    }
    const replacement = replacer(block);
    if (replacement === null || replacement === undefined) {
      out.push(block);
      misses++;
    } else if (
      componentTagCount(replacement) < componentTagCount(block) ||
      imageTagCount(replacement) < imageTagCount(block)
    ) {
      // The translation dropped a component the English block carried; an
      // English block is acceptable, a page missing its pictures is not.
      out.push(block);
      misses++;
    } else {
      out.push(replacement);
      hits++;
    }
  }
  out.push(source.slice(cursor));
  return {body: out.join(''), hits, misses};
}

/**
 * Monotonic alignment of English and Chinese blocks.
 *
 * Counts rarely match exactly: a translation may drop a horizontal rule or merge
 * two short paragraphs. Pairing by index would then shift every following block
 * and make whole pages look untranslated, so the pairing is computed with a
 * small dynamic program over block shapes.
 */
/**
 * A block that is only pictures (optionally wrapped in HTML/emphasis): no prose,
 * and it must never pair with or be replaced by prose.
 */
export function isImageBlock(block) {
  const text = String(block);
  if (!/!\[/.test(text)) return false;
  const stripped = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // `<center>…</center>`, `<p>…</p>` and any other wrapper the manual uses
    // around a screenshot carry no text of their own.
    .replace(/<\/?[A-Za-z][^<>]*?>/g, '')
    .replace(/[*_`\s]/g, '');
  return stripped === '';
}

/** Number of Markdown image occurrences in a block. */
export function imageTagCount(block) {
  return (String(block).match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;
}

/** A single line that is nothing but one component tag (`<WideTable>`, `</WideTable>`). */
const TAG_ONLY_LINE = /^\s*<\/?[A-Za-z][\w.:-]*\b[^<>]*?\/?>\s*$/;

/**
 * True when every line of the block is one whole component tag.
 *
 * `<WideTable>` / `</WideTable>` (and `<Tabs>` / `</Tabs>`) carry no language:
 * the English source owns them. They must never be looked up, paired or swapped
 * — an opener on one side was paired with the closer on the other and the page
 * shipped an orphan `</WideTable>`.
 */
export function isTagOnlyBlock(block) {
  const lines = String(block).split('\n');
  return lines.length > 0 && lines.every((line) => TAG_ONLY_LINE.test(line));
}

/**
 * Text segments that still carry English prose: outside fences, no Chinese, and
 * long enough to be a sentence rather than an identifier. This is the same
 * definition the translator uses when it decides what to send.
 */
/**
 * Is this text a piece of prose that must be translated?
 *
 * MDX scaffolding is not prose: admonition markers (`:::info`), component lines,
 * images, table rules and bare identifiers all look "English" to a naive check
 * and would otherwise be sent to the model and come back unchanged.
 */
export function isTranslatableProse(text) {
  const t = text.trim();
  if (t.length < 2) return false;
  // An admonition carries prose inside `:::note … :::`; the container is
  // preserved by renderAdmonition, the title and body are translated. Before
  // this branch existed, every warning on the site went to the queue as
  // "structure" and stayed English forever.
  if (splitAdmonitions(t)) return isTranslatableAdmonition(t);
  if (/^:::/.test(t)) return false;
  if (/^</.test(t)) return false;
  if (/^!\[/.test(t)) return false;
  if (/^\|?[\s:|\-]+\|?$/.test(t)) return false;
  // A link label is translated independently of the sentence around it, so it
  // must not decide this block's language; see `prose.mjs`.
  const wordsOnly = languageText(t);
  if (/[\u4e00-\u9fff]/.test(wordsOnly)) return false;
  // Chinese punctuation means the line is already Chinese even without Han
  // characters (a list of VLAN ids ending in "。" for instance).
  if (/[\u3000-\u303f\uff00-\uffef]/.test(wordsOnly)) return false;
  // Pure link, image (optionally emphasised) or inline code: nothing to say.
  if (/^\*?!\[[^\]]*\]\([^)]*\)\*?$/.test(t)) return false;
  // An image wrapped in a link and emphasis (`**[![](img)](url)**`) has no prose
  // of its own; sending it to the model returns the same line and leaves the
  // page permanently "pending".
  {
    const stripped = t
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/[*_`>#|\s-]/g, ' ');
    if (!/[A-Za-z]{2,}/.test(stripped)) return false;
  }
  if (/^\[?\s*https?:\/\/\S+\s*\]?$/.test(t)) return false;
  if (/^`[^`]*`$/.test(t)) return false;
  // A console path or a bare command line is configuration, not prose.
  if (/^\//.test(t)) return false;
  if (/^(?:add|set|print|remove|enable|disable|export|import)\s+[\w-]+=/i.test(t)) return false;
  // A heading that is itself a CLI path or an identifier ("## ip/media") is not
  // prose; CLI reference headings stay in English on every page.
  if (/^#{1,6}\s/.test(t)) {
    const heading = t.replace(/^#{1,6}\s+/, '').trim();
    if (/^[\w./-]+$/.test(heading)) return false;
    return /[A-Za-z]{2,}/.test(heading);
  }
  const words = t.match(/[A-Za-z]{2,}/g) || [];
  return words.length >= 2;
}

export function englishSegments(body) {
  // One block is one review unit: the same `splitBlockSpans` verdict the queue
  // and `verify` use. Walking blank-line segments here meant a `:::note` with a
  // command sample was skipped (the segment "contains a fence") and the review
  // never listed the warning that was still English.
  return splitBlockSpans(body)
    .filter((span) => !span.code)
    .map((span) => span.text.trim())
    .filter((text) => text !== '' && isTranslatableProse(text));
}

export function blockSignature(block) {
  const text = block.trimStart();
  if (isImageBlock(block)) return 'I';
  // A component-only block is its own shape. It must never be substituted by a
  // prose paragraph during alignment, or the picture is replaced by text.
  if (isStructuralBlock(block)) return 'G';
  // Keep the tag identity in the signature: `<WideTable>` and `</WideTable>` are
  // both "a component line", but pairing one with the other turns the wrapper
  // inside out (the 7.24 pages shipped orphan closing tags).
  if (isTagOnlyBlock(block)) return `G:${block.trim()}`;
  if (isHorizontalRule(block)) return 'R';
  if (hasFence(block)) return 'C';
  if (/^#{1,6}\s/.test(text)) return `H${(text.match(/^#+/) || ['#'])[0].length}`;
  if (/^\|/.test(text)) return 'T';
  if (/^[-*+]\s/.test(text)) return 'L';
  if (/^\d+[.)]\s/.test(text)) return 'N';
  if (/^</.test(text)) return 'X';
  return 'P';
}

// `X` (an HTML paragraph) is deliberately absent: a component-shaped block must
// not be exchanged for a prose paragraph, or the paragraph disappears.
const PROSE = new Set(['P', 'L', 'N', 'T']);

/** Cheap test: may the two block lists be paired by position? */
export function sameBlockShape(english, chinese) {
  if (english.length !== chinese.length) return false;
  for (let i = 0; i < english.length; i++) {
    if (blockSignature(english[i]) !== blockSignature(chinese[i])) return false;
  }
  return true;
}

export function alignBlocks(english, chinese) {
  const n = english.length;
  const m = chinese.length;
  const pairs = new Map();
  if (n === 0 || m === 0) return pairs;
  const width = m + 1;
  const cost = new Int32Array((n + 1) * width);
  for (let i = 1; i <= n; i++) cost[i * width] = i;
  for (let j = 1; j <= m; j++) cost[j] = j;
  const se = english.map(blockSignature);
  const sz = chinese.map(blockSignature);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let substitution;
      if (se[i - 1] === sz[j - 1]) substitution = 0;
      else if (PROSE.has(se[i - 1]) && PROSE.has(sz[j - 1])) substitution = 1;
      else substitution = 3;
      const diagonal = cost[(i - 1) * width + j - 1] + substitution;
      const up = cost[(i - 1) * width + j] + 1;
      const left = cost[i * width + j - 1] + 1;
      cost[i * width + j] = Math.min(diagonal, up, left);
    }
  }
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const current = cost[i * width + j];
    let substitution;
    if (se[i - 1] === sz[j - 1]) substitution = 0;
    else if (PROSE.has(se[i - 1]) && PROSE.has(sz[j - 1])) substitution = 1;
    else substitution = 3;
    if (current === cost[(i - 1) * width + j - 1] + substitution) {
      if (substitution === 0 || substitution === 1) pairs.set(i - 1, j - 1);
      i--;
      j--;
    } else if (current === cost[(i - 1) * width + j] + 1) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
}
