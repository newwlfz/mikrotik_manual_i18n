/**
 * Docusaurus admonitions (`:::note … :::`).
 *
 * The translation pipeline used to drop every block that starts with `:::`,
 * because the markers look like MDX scaffolding rather than prose. The body of a
 * warning is usually the only place a page states a limitation, so those blocks
 * stayed English forever and nothing reported them.
 *
 * An admonition is three parts: the container line (`:::note`, `:::warning[Title]`,
 * `:::tip Title`), the body, and the closing `:::`. Only the title and the body
 * carry natural language; the container and the closing marker must survive
 * byte for byte, or the page stops compiling.
 *
 * Nested admonitions are recognised while scanning for the matching closer, but
 * only the outer level is handled: a body paragraph that opens its own `:::`
 * container is copied through untouched.
 */

import {languageText} from './prose.mjs';

const OPENER = /^([ \t]*)(:{3,})([A-Za-z][\w-]*)(.*)$/;
const CLOSER = /^([ \t]*)(:{3,})[ \t]*$/;

/** `:::note`, `:::warning[Title]`, `:::tip Some title` — the container line. */
export function parseAdmonitionOpener(line) {
  const match = OPENER.exec(String(line ?? ''));
  if (!match) return null;
  return {indent: match[1], marker: match[2], type: match[3], rest: match[4]};
}

/** A bare `:::` line, with the marker it closes. */
export function parseAdmonitionCloser(line) {
  const match = CLOSER.exec(String(line ?? ''));
  return match ? match[2] : null;
}

/**
 * Split one block into its admonition parts, or null when it is not one.
 *
 * `tail` is empty for an unterminated container, which keeps the caller from
 * rewriting half an admonition whose closing line lives in the next block.
 */
export function splitAdmonitions(block) {
  const lines = String(block ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  const opened = parseAdmonitionOpener(lines[start]);
  if (!opened) return null;

  const {indent, marker, type, rest} = opened;
  let title = null;
  let titleForm = 'none';
  const bracket = /^\s*\[([^\]]*)\]\s*$/.exec(rest);
  if (bracket) {
    title = bracket[1].trim();
    titleForm = 'bracket';
  } else if (rest.trim() !== '') {
    // Docusaurus also accepts a bare title after the type; the manual uses both
    // spellings (`:::tip[Watch…]` and `:::note Alternative approach`).
    title = rest.trim();
    titleForm = 'space';
  }

  let end = -1;
  let depth = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const closer = parseAdmonitionCloser(lines[i]);
    if (closer) {
      if (closer !== marker) continue;
      if (depth === 0) {
        end = i;
        break;
      }
      depth--;
      continue;
    }
    const nested = parseAdmonitionOpener(lines[i]);
    if (nested && nested.marker === marker) depth++;
  }

  const bodyEnd = end === -1 ? lines.length : end;
  return {
    container: `${marker}${type}`,
    type,
    marker,
    title,
    titleForm,
    body: lines
      .slice(start + 1, bodyEnd)
      .join('\n')
      .replace(/\s+$/, ''),
    tail: end === -1 ? '' : lines[end].trim(),
    indent,
    tailIndent: end === -1 ? '' : (CLOSER.exec(lines[end]) || ['', ''])[1],
    closed: end !== -1,
  };
}

/**
 * Paragraphs of an admonition body, separators preserved.
 *
 * Splitting and re-joining must not invent or drop the blank lines that keep a
 * title, a paragraph and a list apart.
 */
export function bodySegments(body) {
  const parts = String(body ?? '').split(/(\n[ \t]*\n+)/);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '') continue;
    out.push({kind: i % 2 === 1 ? 'sep' : 'text', value: parts[i]});
  }
  return out;
}

export function bodyParagraphs(body) {
  return bodySegments(body)
    .filter((segment) => segment.kind === 'text')
    .map((segment) => segment.value);
}

const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;

/**
 * A paragraph worth sending to the translator: prose, not a nested container, a
 * fence, a table or an image-only line.
 */
function mayTranslate(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return false;
  if (/^:::/.test(trimmed)) return false;
  if (/^```|^~~~/.test(trimmed)) return false;
  if (/^</.test(trimmed)) return false;
  if (/^\|/.test(trimmed) && /^\|?[\s:|-]+\|?$/.test(trimmed)) return false;
  if (/^!\[[^\]]*\]\([^)]*\)$/.test(trimmed)) return false;
  // A link label translated by `rewriteLinks` does not make the sentence
  // Chinese: `Ramdisks need the package (see [存储](…))` is still English prose
  // and must be sent. Only the words outside the labels decide.
  if (CJK.test(languageText(trimmed))) return false;
  return (trimmed.match(/[A-Za-z]{2,}/g) || []).length >= 2;
}

/** Title and body of an admonition, flattened for language checks. */
export function admonitionText(parts) {
  if (!parts) return '';
  return [parts.title, parts.body].filter(Boolean).join('\n').trim();
}

/**
 * Does this block need a translation?
 *
 * An unterminated container does not count: it is either a fragment the block
 * splitter produced or a marker inside prose, and rewriting it would guess.
 */
export function isTranslatableAdmonition(block) {
  const parts = splitAdmonitions(block);
  if (!parts) return false;
  if (parts.tail === '') return false;
  return admonitionUnits(parts).length > 0;
}

function admonitionUnits(parts) {
  const out = [];
  if (parts.title && mayTranslate(parts.title)) out.push(parts.title);
  for (const paragraph of bodyParagraphs(parts.body)) {
    if (mayTranslate(paragraph)) out.push(paragraph);
  }
  return out;
}

/**
 * Rebuild an admonition with translated title and body.
 *
 * `translateFn(text)` returns the translation of one unit, or null/undefined to
 * keep the English text. The container line, the closing `:::` and the blank
 * lines between paragraphs are always reproduced from `parts`.
 */
export function renderAdmonition(parts, translateFn) {
  const translate = (text) => {
    if (typeof translateFn !== 'function') return null;
    const value = translateFn(text);
    if (typeof value !== 'string') return null;
    return value.trim() === '' ? null : value;
  };

  const indent = parts.indent || '';
  let opener = `${indent}${parts.container}`;
  if (parts.title && parts.titleForm === 'bracket') {
    opener += `[${translate(parts.title) ?? parts.title}]`;
  } else if (parts.title && parts.titleForm === 'space') {
    opener += ` ${translate(parts.title) ?? parts.title}`;
  }

  const lines = [opener];
  const body = bodySegments(parts.body)
    .map((segment) => {
      if (segment.kind === 'sep') return segment.value;
      const value = mayTranslate(segment.value) ? translate(segment.value) : null;
      return value ?? segment.value;
    })
    .join('')
    .replace(/\s+$/, '');
  if (body.trim() !== '') lines.push(body);
  if (parts.tail) lines.push(`${parts.tailIndent || ''}${parts.tail}`);
  return lines.join('\n');
}
