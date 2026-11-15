/**
 * Shared parser for the official generated Markdown endpoint.
 *
 * The official endpoint starts with a generated block:
 *
 *   # Title
 *   > summary
 *   # Title (repeated on some pages)
 *   ---
 *   body...
 *
 * `refresh-docs.mjs` already relied on this shape. Materialisation must use the
 * same function, otherwise a refresh and a rebuild disagree about where the
 * body starts.
 */

export function parseOfficial(raw) {
  let text = raw.replace(/\r\n/g, '\n').trimStart();
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) text = text.slice(end + 4).trimStart();
  }

  let title = null;
  let summary = null;
  let match = text.match(/^#\s+(.+)\n/);
  if (match) {
    title = match[1].trim();
    text = text.slice(match[0].length).trimStart();
  }

  match = text.match(/^>\s*(.+)\n/);
  if (match) {
    summary = match[1].trim();
    text = text.slice(match[0].length).trimStart();
  }

  text = text.replace(/^-{3,}\s*\n+/, '');

  // Some pages repeat the title as an H1; keep any other leading heading.
  const second = text.match(/^#\s+(.+)\n+/);
  if (second && title && second[1].trim() === title) text = text.slice(second[0].length);

  return {title, summary, body: text.trimStart()};
}

/** Normalise only line endings; callers decide how much whitespace to trim. */
export function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}
