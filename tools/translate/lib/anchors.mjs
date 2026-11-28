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
 *
 * Pairing is positional, but refined by slug: a heading that kept an English
 * identifier, or that already carries the id of a later source heading (a source
 * heading the translation dropped), is paired with that source heading instead
 * of whatever happens to sit at the same index. A stale id is *corrected*, never
 * silently kept: the whole point of this module is that the published id is the
 * one the English page publishes at that position.
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
 * that carries a link (`## User Guides[](#user-guides "Direct link")`, which is
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
 * Headings of a body as `{level, text, id, line}`; `line` is zero-based.
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

/** The English ids of a document, keyed by position (plus source line). */
function englishIds(englishBody) {
  const slugger = createSlugger();
  const list = [];
  for (const heading of headings(englishBody)) {
    list.push({
      level: heading.level,
      id: heading.id ?? slugger.slug(renderedHeadingText(heading.text)),
      line: heading.line,
    });
  }
  return list;
}

/**
 * Pair translated headings with English ones.
 *
 * Heading counts rarely match exactly (the model may drop or merge one), so the
 * pairing walks both lists and only pairs same-level headings, skipping English
 * headings the translation does not have. A heading that cannot be paired keeps
 * no id: a wrong anchor is worse than a missing one.
 *
 * Within the remaining candidates, a slug match wins: either the translated
 * heading kept the English text (`## HTTP Methods`), or it already carries the
 * id of a later English heading (the overlay dropped an intermediate one). This
 * is what lets a bad id be corrected instead of skipped when the two heading
 * lists are not byte-for-byte identical.
 */
function pairHeadings(chinese, english) {
  const pairs = [];
  let cursor = 0;
  for (const heading of chinese) {
    let found = -1;
    const slug = slugify(heading.text);
    // Preferred: an exact id or slug match at or after the cursor.
    for (let index = cursor; index < english.length; index++) {
      if (english[index].level !== heading.level) continue;
      if ((heading.id && english[index].id === heading.id) || english[index].id === slug) {
        found = index;
        break;
      }
    }
    // Fallback: the first same-level heading after the cursor. Headings the
    // translation dropped (usually a deeper level) are skipped, so one missing
    // `###` does not shift every anchor after it.
    if (found === -1) {
      for (let index = cursor; index < english.length; index++) {
        if (english[index].level === heading.level) {
          found = index;
          break;
        }
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
 * With equal counts and equal levels the pairing is unambiguous. When the lists
 * differ `pairHeadings` still pairs by level + slug, and both paths now correct
 * a stale id (the old code refused to overwrite one unless the lists were
 * exact, which is precisely why 1701 links stayed broken).
 */
function pairHeadingsExact(chinese, english) {
  if (chinese.length !== english.length) return null;
  for (let index = 0; index < chinese.length; index++) {
    if (chinese[index].level !== english[index].level) return null;
  }
  return chinese.map((heading, index) => ({heading, english: english[index]}));
}

/**
 * Every paired heading with the id it publishes and the id it should publish.
 *
 * Shared by the repair and by both verifiers so "fixed" and "passes the gate"
 * cannot disagree. `line` is the zero-based line of the heading in the overlay.
 */
export function headingPairs(translatedBody, englishBody) {
  const translated = headings(translatedBody);
  const english = englishIds(englishBody);
  if (translated.length === 0 || english.length === 0) return [];
  const published = headingIds(translatedBody);
  const exact = pairHeadingsExact(translated, english);
  const pairs = exact || pairHeadings(translated, english);
  return pairs.map((pair) => {
    const index = translated.indexOf(pair.heading);
    return {
      line: pair.heading.line,
      level: pair.heading.level,
      text: pair.heading.text,
      explicit: pair.heading.id,
      actual: published[index],
      expected: pair.english.id,
      sourceLine: pair.english.line,
    };
  });
}

/** Paired headings whose published id is not the English id, with line numbers. */
export function anchorMismatches(translatedBody, englishBody) {
  return headingPairs(translatedBody, englishBody)
    .filter((pair) => pair.actual !== pair.expected)
    .map((pair) => ({
      line: pair.line + 1,
      level: pair.level,
      actual: pair.actual,
      expected: pair.expected,
      text: pair.text,
    }));
}

/** Replace the anchor of every internal link through a known mapping. */
export function retargetAnchorFragments(body, mapping) {
  if (!mapping || mapping.size === 0) return {body: String(body ?? ''), changed: 0};
  let changed = 0;
  const lines = String(body ?? '').split('\n');
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
 * Returns `{body, added, corrected, retargeted}`: `added` counts ids written,
 * `corrected` stale ids replaced, and `retargeted` in-body links moved from a
 * translated anchor to the English one (only anchors whose mapping is known,
 * so an unknown anchor is untouched). Re-running on a repaired body is a
 * no-op, so the default pipeline and the stock repair are both idempotent.
 *
 * `options.extraMapping` lets a repository-wide repair pass feed the mappings
 * of *other* pages into this page: a cross-page link names the anchor of its
 * target page, not of the page that contains the link.
 */
export function addHeadingAnchors(body, englishBody, options = {}) {
  const text = String(body ?? '');
  if (!englishBody) return {body: text, added: 0, corrected: 0, retargeted: 0};
  const chinese = headings(text);
  const english = englishIds(englishBody);
  if (chinese.length === 0 || english.length === 0) {
    return {body: text, added: 0, corrected: 0, retargeted: 0};
  }

  const pairs = headingPairs(text, englishBody);
  const byLine = new Map();
  const mapping = new Map(options.extraMapping || []);
  for (const pair of pairs) {
    if (pair.actual === pair.expected) continue;
    byLine.set(pair.line, pair.expected);
    // Both the published (possibly translated) id and the plain slug are
    // mapped, so a duplicate heading is recognised in the body even when two
    // headings share a text.
    if (pair.actual) mapping.set(pair.actual, pair.expected);
    const generated = slugify(pair.text);
    if (generated !== pair.expected) mapping.set(generated, pair.expected);
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
    lines[line] = `${match[1]} ${parsed.text.trim()} {#${id}}`;
    if (parsed.id) corrected++;
    else added++;
  }

  const retargeted = retargetAnchorFragments(lines.join('\n'), mapping);
  return {body: retargeted.body, added, corrected, retargeted: retargeted.changed};
}

/** The `{#}`-free heading text of a line, for verification output. */
export function headingText(line) {
  const match = HEADING.exec(String(line ?? '').trim());
  if (!match) return null;
  return parseMarkdownHeadingId(match[2].trim()).text.trim();
}
