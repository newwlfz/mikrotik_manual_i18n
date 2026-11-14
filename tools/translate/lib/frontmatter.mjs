/**
 * Minimal YAML front-matter handling.
 *
 * The pipeline must never rewrite a document just to reformat its front matter:
 * only the translatable scalar keys (`title`, `sidebar_label`, `description`)
 * are replaced, every other line is copied byte for byte from the English
 * source. That keeps `slug`, `sidebar_position`, `tags`, `date` and plugin
 * specific keys exactly as Docusaurus produced them.
 */

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontMatter(text) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return {frontMatter: '', body: text};
  return {frontMatter: match[1], body: text.slice(match[0].length)};
}

export function readField(frontMatter, key) {
  const re = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm');
  const match = re.exec(frontMatter);
  if (!match) return null;
  return unquote(match[1].trim());
}

export function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
}

export function quote(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Replace scalar front-matter keys, leaving every other line untouched.
 * `values` maps a key to a plain (unescaped) string.
 */
export function withFields(frontMatter, values) {
  const lines = frontMatter.split('\n');
  const seen = new Set();
  const out = lines.map((line) => {
    const match = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
    if (!match) return line;
    const [, key] = match;
    if (!(key in values)) return line;
    seen.add(key);
    const value = values[key];
    if (value === null || value === undefined) return line;
    return `${key}: ${quote(value)}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (seen.has(key) || value === null || value === undefined) continue;
    out.push(`${key}: ${quote(value)}`);
  }
  return out.join('\n');
}

/**
 * Keys that belong to the English source, never to the translation.
 *
 * `source` is the page this overlay mirrors and `captured_at` is when the
 * capture ran; the footer prints the capture time, so both must be the
 * source's exact bytes. They are copied verbatim rather than read from the
 * memory or written by a model: a remembered timestamp would be a made-up
 * claim about when the English page was captured.
 */
export const VERBATIM_KEYS = ['source', 'captured_at'];

const escapeKey = (key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Copy front-matter keys byte for byte from the English front matter.
 *
 * `withFields` leaves untouched lines alone, but it cannot restore a key the
 * source has and the overlay lost (older overlays were built before
 * `captured_at` existed). Values are the source's raw text, quoting included,
 * so `'2026-11-09T11:35:47.715Z'` stays single quoted; an absent key is left
 * absent instead of being invented here.
 */
export function copyKeys(frontMatter, sourceFrontMatter, keys = VERBATIM_KEYS) {
  const lines = frontMatter.split('\n');
  for (const key of keys) {
    const pattern = escapeKey(key);
    const sourceLine = new RegExp(`^${pattern}:[ \\t]*.*$`, 'm').exec(sourceFrontMatter);
    if (!sourceLine) continue;
    const raw = sourceLine[0];
    const index = lines.findIndex((line) => new RegExp(`^${pattern}:[ \\t]`).test(line));
    if (index !== -1) {
      lines[index] = raw;
      continue;
    }
    // Keep the source's ordering: `captured_at` sits right after `source`.
    const anchor =
      key === 'source' ? -1 : lines.findIndex((line) => /^source:[ \t]/.test(line));
    if (anchor !== -1) lines.splice(anchor + 1, 0, raw);
    else lines.push(raw);
  }
  return lines.join('\n');
}

/**
 * Remove front-matter keys entirely.
 *
 * `withFields` can only replace a value, but some keys must disappear rather
 * than keep the English one: a `description` the memory never translated has to
 * fall back to Docusaurus's excerpt instead of shipping English metadata.
 */
export function omitKeys(frontMatter, keys) {
  const drop = new Set(keys);
  return String(frontMatter)
    .split('\n')
    .filter((line) => {
      const match = /^([A-Za-z0-9_-]+):[ \t]/.exec(line);
      return !(match && drop.has(match[1]));
    })
    .join('\n');
}

export function renderDocument(frontMatter, body) {
  return `---\n${frontMatter}\n---\n\n${body.replace(/^\n+/, '').replace(/\s*$/, '\n')}`;
}
