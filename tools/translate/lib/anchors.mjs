/**
 * Heading anchors for translated pages.
 *
 * Docusaurus builds a heading's id from the *rendered* text, so a translated
 * heading gets a translated id (`## 配置示例` -> `#配置示例`) and every link that
 * points at the English anchor (`#config-example`) dies. The fix is to keep the
 * English id on the Chinese heading with the classic syntax
 * (`## 配置示例 {#config-example}`), which the MDX loader recognises and keeps
 * even though the visible text changed. `mdx1Compat.headingIds` (on by default)
 * escapes the braces for MDX, so the syntax works in `.md` and `.mdx` alike.
 *
 * The English slug is produced with Docusaurus's own slugger, so it matches the
 * id the English page generates - duplicate headings included (`-1`, `-2`).
 */

import {createSlugger, parseMarkdownHeadingId} from '@docusaurus/utils';

import {fenceMask} from './blocks.mjs';

const HEADING = /^(#{1,6})[ \t]+(.*)$/;
const LINK_ANCHOR = /(\]\([^)\s#]*|href="[^"#]*)(#[^)\s"]+)/g;

export function slugify(text) {
  return createSlugger().slug(renderedHeadingText(text));
}

/**
 * The text Docusaurus slugs: inline Markdown is rendered first, so a heading
 * that carries a link (`## User Guides[​](#user-guides "Direct link")`, which is
 * how the changelog export writes its sticky link) gets the id of its visible
 * text (`user-guides`), not of the link syntax. Inline HTML tags and
 * zero-width marks contribute no text either.
 */
export function renderedHeadingText(text) {
  return String(text ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim();
}

/**
 * Headings of a body as `{level, text, id, line}`.
 *
 * Fenced code is skipped: a `# comment` inside a shell fence is not a heading,
 * and the fence bytes must stay identical anyway.
 */
export function headings(body) {
  const text = String(body ?? '');
  const mask = fenceMask(text);
  const out = [];
  text.split('\n').forEach((line, index) => {
    if (mask[index]) return;
    const match = HEADING.exec(line);
    if (!match) return;
    const parsed = parseMarkdownHeadingId(match[2].trim());
    out.push({level: match[1].length, text: parsed.text.trim(), id: parsed.id ?? null, line: index});
  });
  return out;
}

/**
 * Ids a page exposes, in document order.
 *
 * An explicit `{#id}` wins (that is what Docusaurus does); otherwise the id is
 * the slug of the heading text, deduplicated per document exactly like the site
 * build does.
 */
export function headingIds(body) {
  const slugger = createSlugger();
  const ids = [];
  for (const heading of headings(body)) {
    ids.push(heading.id ?? slugger.slug(renderedHeadingText(heading.text)));
  }
  return ids;
}

/** The English ids of a document, keyed by position. */
function englishIds(englishBody) {
  const slugger = createSlugger();
  const list = [];
  for (const heading of headings(englishBody)) {
    list.push({level: heading.level, id: heading.id ?? slugger.slug(renderedHeadingText(heading.text))});
  }
  return list;
}

/**
 * Pair Chinese headings with English ones.
 *
 * Heading counts rarely match exactly (the model may drop or merge one), so the
 * pairing walks both lists and only pairs same-level headings, skipping English
 * headings the translation does not have. A heading that cannot be paired keeps
 * no id: a wrong anchor is worse than a missing one.
 */
function pairHeadings(chinese, english) {
  const pairs = [];
  let cursor = 0;
  for (const heading of chinese) {
    let found = -1;
    // Headings the translation dropped (usually a deeper level) are skipped, so
    // one missing `###` does not shift every anchor after it.
    for (let index = cursor; index < english.length; index++) {
      if (english[index].level === heading.level) {
        found = index;
        break;
      }
    }
    if (found === -1) continue;
    pairs.push({heading, english: english[found]});
    cursor = found + 1;
  }
  return pairs;
}

/**
 * Pair headings positionally, but only when the two lists line up exactly.
 *
 * With equal counts and equal levels the pairing is unambiguous, so an id that
 * was written by an older run against a different heading list can be corrected.
 * When the lists differ the caller falls back to `pairHeadings`, which only adds
 * ids and never overwrites one.
 */
function pairHeadingsExact(chinese, english) {
  if (chinese.length !== english.length) return null;
  for (let index = 0; index < chinese.length; index++) {
    if (chinese[index].level !== english[index].level) return null;
  }
  return chinese.map((heading, index) => ({heading, english: english[index]}));
}

/** Replace the anchor of every internal link through a known mapping. */
function retargetAnchors(body, mapping) {
  if (mapping.size === 0) return {body, changed: 0};
  let changed = 0;
  const lines = String(body).split('\n');
  const mask = fenceMask(String(body));
  for (let index = 0; index < lines.length; index++) {
    if (mask[index]) continue;
    lines[index] = lines[index].replace(LINK_ANCHOR, (whole, prefix, anchor) => {
      const name = anchor.slice(1);
      const replacement = mapping.get(name);
      if (!replacement || replacement === name) return whole;
      changed++;
      return `${prefix}#${replacement}`;
    });
  }
  return {body: lines.join('\n'), changed};
}

/**
 * Give the translated headings their English ids.
 *
 * Returns `{body, added, retargeted}`: `added` counts the ids written,
 * `retargeted` the in-body links moved from a translated anchor to the English
 * one (only anchors whose mapping is known, so an unknown anchor is untouched).
 */
export function addHeadingAnchors(body, englishBody) {
  const text = String(body ?? '');
  if (!englishBody) return {body: text, added: 0, retargeted: 0};
  const chinese = headings(text);
  const english = englishIds(englishBody);
  if (chinese.length === 0 || english.length === 0) return {body: text, added: 0, retargeted: 0};

  // An exact list can correct a stale id; a fuzzier pairing may only add.
  const exact = pairHeadingsExact(chinese, english);
  const pairs = exact || pairHeadings(chinese, english);
  // Both sides are slugged in order so the *translated* anchor of a heading can
  // be recognised in the body even when two headings share a text.
  const zhSlugger = createSlugger();
  const byLine = new Map();
  const mapping = new Map();
  for (const heading of chinese) {
    // The slugger advances for every heading, so a duplicate heading keeps the
    // same `-1` suffix the build gave it before ids were written.
    const generated = zhSlugger.slug(renderedHeadingText(heading.text));
    const zhId = heading.id ?? generated;
    const pair = pairs.find((item) => item.heading === heading);
    if (pair) {
      byLine.set(heading.line, pair.english.id);
      if (zhId !== pair.english.id) mapping.set(zhId, pair.english.id);
      if (generated !== pair.english.id && generated !== zhId) mapping.set(generated, pair.english.id);
    }
  }

  const lines = text.split('\n');
  const mask = fenceMask(text);
  let added = 0;
  let corrected = 0;
  for (const [line, id] of byLine) {
    if (mask[line]) continue;
    const match = HEADING.exec(lines[line]);
    if (!match) continue;
    const parsed = parseMarkdownHeadingId(match[2].trim());
    if (parsed.id === id) continue;
    // A stale id from an older run is rewritten; with an exact heading list the
    // pairing is positionally certain, so the English id is the right one.
    if (parsed.id && !exact) continue;
    lines[line] = `${match[1]} ${parsed.text.trim()} {#${id}}`;
    if (parsed.id) corrected++;
    else added++;
  }

  const retargeted = retargetAnchors(lines.join('\n'), mapping);
  return {body: retargeted.body, added, corrected, retargeted: retargeted.changed};
}

/** The `{csv}`-free heading text of a line, for verification output. */
export function headingText(line) {
  const match = HEADING.exec(String(line ?? '').trim());
  if (!match) return null;
  return parseMarkdownHeadingId(match[2].trim()).text.trim();
}
