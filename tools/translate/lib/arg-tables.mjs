/**
 * Parsing helpers for the CLI Reference argument tables.
 *
 * The pages are MDX, not Markdown tables: every argument is one
 * `<ArgTableRow arg="..." typ="...">description</ArgTableRow>` element and the
 * header is `<ArgTable c1="..." c2="..." c3="...">`. A `typ` value may contain a
 * newline, so an element can span several physical lines; that rules out the
 * line-oriented parser used for pipe tables and is why this module scans tags
 * with quote awareness instead.
 *
 * The same helpers are shared by `tools/translate/cli-tables.mjs` (which writes
 * the memory and the overlays) and `tools/verify/cli-tables.mjs` (which audits
 * them), so "English prose" means exactly the same thing in both directions.
 */

export const CJK = /[\u4e00-\u9fff]/;

/** End offset (exclusive) of the tag that starts at `start`, quote aware. */
export function scanTagEnd(text, start) {
  let quoted = false;
  for (let i = start + 1; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === '>' && !quoted) return i + 1;
  }
  return -1;
}

/** Attribute map of a single tag (`arg="x" typ="..."`), names as written. */
export function attrsOf(tag) {
  const out = {};
  for (const match of String(tag).matchAll(/([A-Za-z][A-Za-z0-9_-]*)="([^"]*)"/g)) {
    // The first occurrence wins, matching how MDX parses duplicate props.
    if (!(match[1] in out)) out[match[1]] = match[2];
  }
  return out;
}

/**
 * One `<ArgTable>` element: the header tag, its rows and the closing tag.
 *
 * `text` is the exact source slice, so replacing it is byte-faithful. A table
 * is always `header + '\n' + row + ... + '\n</ArgTable>'`; the reconstruct
 * helper below asserts that invariant instead of trusting it.
 */
export function parseTable(text, start) {
  const headerEnd = scanTagEnd(text, start);
  if (headerEnd < 0) return null;
  const close = text.indexOf('</ArgTable>', headerEnd);
  if (close < 0) return null;
  const header = text.slice(start, headerEnd);
  const rows = [];
  let cursor = headerEnd;
  for (;;) {
    const rowStart = text.indexOf('<ArgTableRow', cursor);
    if (rowStart < 0 || rowStart > close) break;
    const openEnd = scanTagEnd(text, rowStart);
    if (openEnd < 0 || openEnd > close) break;
    const open = text.slice(rowStart, openEnd);
    if (open.endsWith('/>')) {
      rows.push({open, text: '', close: '', raw: open, start: rowStart, end: openEnd});
      cursor = openEnd;
      continue;
    }
    const bodyEnd = text.indexOf('</ArgTableRow>', openEnd);
    if (bodyEnd < 0 || bodyEnd > close) break;
    rows.push({
      open,
      text: text.slice(openEnd, bodyEnd),
      close: '</ArgTableRow>',
      raw: text.slice(rowStart, bodyEnd + '</ArgTableRow>'.length),
      start: rowStart,
      end: bodyEnd + '</ArgTableRow>'.length,
    });
    cursor = bodyEnd + '</ArgTableRow>'.length;
  }
  return {
    start,
    end: close + '</ArgTable>'.length,
    header,
    headerEnd,
    rows,
    text: text.slice(start, close + '</ArgTable>'.length),
  };
}

/** Every `<ArgTable>` of a document body, in document order. */
export function parseTables(body) {
  const out = [];
  let index = 0;
  for (;;) {
    const start = body.indexOf('<ArgTable', index);
    if (start < 0) break;
    // `<ArgTableRow` has no word boundary after `ArgTable`; require whitespace
    // or the closing bracket so the row element is not mistaken for a table.
    const next = body[start + '<ArgTable'.length];
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== '>') {
      index = start + '<ArgTable'.length;
      continue;
    }
    const table = parseTable(body, start);
    if (!table) break;
    out.push(table);
    index = table.end;
  }
  return out;
}

/**
 * Physical lines of a table. `parseTable` keeps the exact text; this helper is
 * only used to compare structure (a harvested translation must keep the same
 * number of lines as its English source).
 */
export function tableLines(table) {
  return [table.header, ...table.rows.map((row) => row.raw), '</ArgTable>'];
}

/**
 * Text with everything that is not prose removed: inline code, links, HTML
 * tags and character entities. Used by the "is this English prose?" test.
 */
export function stripForProse(text) {
  return String(text)
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:/+*()'’\-–]*$/;

/**
 * A single token with no whitespace (`managed`, `yes/no`, `hw-offloaded`).
 * Values and identifiers are not prose and stay in English.
 */
export function isIdentifierText(text) {
  const value = String(text).trim();
  return value !== '' && !/\s/.test(value) && IDENTIFIER.test(value);
}

/**
 * Is the element text still English prose?
 *
 * - Chinese text is translated, even when it keeps English identifiers.
 * - A single token (`managed`, `dynamic`, `yes`) is an identifier or a value.
 * - Two or more words are prose only when at least one of them is lowercase:
 *   `BGP VPLS`, `RouterOS`, `IPv6` are names, not sentences.
 */
export function hasProse(text) {
  if (CJK.test(text)) return false;
  const plain = stripForProse(text);
  if (plain === '') return false;
  if (isIdentifierText(plain)) return false;
  const words = plain.match(/[A-Za-z]{2,}/g) || [];
  if (words.length < 2) return false;
  return words.some((word) => /[a-z]/.test(word));
}

const brNormal = (text) => String(text).replace(/<br\s*\/?>/gi, '<br/>');

/** HTML tags in order (`<strong>`, `<br/>`, `<span …>`), row tags excluded. */
export function tagsOf(text) {
  return (brNormal(text).match(/<\/?[A-Za-z][^>]*>/g) || []).map((tag) => tag.trim());
}

/** Inline code spans in order, byte for byte. */
export function codesOf(text) {
  return (String(text).match(/`[^`]*`/g) || []).map((code) => code.trim());
}

/** Markdown link/image targets in order, with the image flag. */
export function linkTargetsOf(text) {
  const out = [];
  for (const match of String(text).matchAll(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    out.push(`${match[1]}|${match[3]}`);
  }
  return out;
}

/** Character entities in order. */
export function entitiesOf(text) {
  return (String(text).match(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi) || []).map((entity) =>
    entity.toLowerCase(),
  );
}

/**
 * Rewrite `Default:` to the canonical Chinese wording outside inline code.
 *
 * The value after the colon is configuration and never changes: only the label
 * is translated (`Default: yes.` -> `默认值：yes.`).
 */
export function canonicalDefaults(text) {
  let out = '';
  let inCode = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '`') {
      inCode = !inCode;
      out += char;
      continue;
    }
    if (!inCode) {
      if (text.startsWith('Default:', i)) {
        out += '默认值：';
        i += 'Default:'.length - 1;
        continue;
      }
      if (text.startsWith('默认：', i)) {
        out += '默认值：';
        i += '默认：'.length - 1;
        continue;
      }
      if (text.startsWith('默认值:', i)) {
        out += '默认值：';
        i += '默认值:'.length - 1;
        continue;
      }
    }
    out += char;
  }
  return out;
}
