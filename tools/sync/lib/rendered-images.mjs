/**
 * Images in the rendered page, and the `data:` URIs some of them become.
 *
 * The official `.md` export points at page-local files (`./img/packages1.png`),
 * but the site itself compiles those to content-hashed Webpack assets
 * (`/assets/images/packages1-<hash>.png`) and, below Webpack's inline limit,
 * writes them into the HTML as `src="data:image/webp;base64,…"`. The bytes are
 * still on the rendered page; only the URL that used to carry them is gone.
 *
 * This module turns those `<img>` elements into an ordered list a caller can
 * align against the Markdown references, and decodes the data URI without ever
 * trusting its declared type:
 *
 *   - the MIME must be one of the image types the site actually emits;
 *   - the payload must be non-empty and decode as base64;
 *   - the first bytes must match that MIME, so a `text/html` error page wearing
 *     an `image/png` label is rejected instead of written to disk.
 *
 * `imageFileName` answers the other half of the recovery: the bytes have to be
 * stored under the **name the Markdown uses**, otherwise the reference that
 * needed rescuing is still broken after the write.
 */

import path from 'node:path';
import * as cheerio from 'cheerio';

/** MIME -> the extension a browser/build tool derives from it. */
export const MIME_EXTENSION = {
  'image/webp': '.webp',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

/** Accepted spellings of the same five image types. */
const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/svg': 'image/svg+xml',
};

const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|gif|svg|avif|ico)$/i;

/** `![alt](target)` and `<img …>` in one ordered pass. */
const IMAGE_REFERENCE = /!\[([^\]]*)\]\(\s*(<[^>\n]*>|[^)\s]+)|<img\b([^>]*)>/gi;

/** `](target)` — a link or image destination; the image pass owns duplicates. */
const MARKDOWN_DESTINATION = /\]\(\s*(<[^>\n]*>|[^)\s]+)/g;

function unquote(value) {
  return value.startsWith('<') && value.endsWith('>') ? value.slice(1, -1) : value;
}

function quotedAttribute(attrs, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  return match ? match[1] ?? match[2] : undefined;
}

/**
 * Every image reference of a Markdown/MDX body, in document order.
 *
 * `alt` is kept even when empty: it is the only stable way to align a reference
 * with the rendered `<img>` when the page gained or lost an unrelated picture
 * (the site's own light/dark logo pair, for instance).
 */
export function imageReferencesOf(body) {
  const out = [];
  for (const match of body.matchAll(IMAGE_REFERENCE)) {
    if (match[0].startsWith('![')) {
      const url = unquote(match[2] ?? '');
      if (url) out.push({url, alt: match[1] ?? '', kind: 'image'});
      continue;
    }
    const attrs = match[3] ?? '';
    const src = quotedAttribute(attrs, 'src');
    if (!src) continue;
    out.push({url: src, alt: quotedAttribute(attrs, 'alt') ?? '', kind: 'image'});
  }
  return out;
}

/**
 * Markdown *links* whose destination is an image file.
 *
 * The corpus writes click-to-enlarge thumbnails as
 * `[![](img/a.png)](img/a.png)`. The image half is an image reference; the href
 * half is not, yet it names the same bytes and `address-images` refuses to run
 * while it points at nothing. `fetch-assets` therefore downloads it too.
 */
export function imageLinksOf(body) {
  const out = [];
  for (const match of body.matchAll(MARKDOWN_DESTINATION)) {
    const url = unquote(match[1] ?? '');
    if (!url || /^(?:https?:\/\/|\/\/)/i.test(url)) continue;
    const bare = url.split('#')[0].split('?')[0];
    if (!IMAGE_EXTENSION.test(bare)) continue;
    out.push({url, alt: '', kind: 'link'});
  }
  return out;
}

/** `./img/packages1.png#gh-light-mode-only` -> `packages1.png`. */
export function imageFileName(reference) {
  return path.basename(reference.split('#')[0].split('?')[0]);
}

/**
 * Ordered images of the rendered article.
 *
 * Scoped exactly like the other render consumers (`cache-structure`,
 * `restore-table-structure`): the site's navbar/footer carry logos that are not
 * part of the page body, and counting them would break positional alignment.
 */
export function renderedImages(html, origin) {
  const $ = cheerio.load(html);
  const marked = $('.theme-doc-markdown').first();
  const root = marked.length ? marked : $('article').first();
  const out = [];
  root.find('img').each((_, element) => {
    const src = $(element).attr('src');
    if (!src) return;
    out.push({
      src,
      alt: $(element).attr('alt') || '',
      // A `data:` URI has no fetchable URL; `url` stays null so callers cannot
      // accidentally request it.
      url: src.startsWith('data:') ? null : new URL(src, origin).href,
    });
  });
  return out;
}

const normaliseAlt = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The rendered `<img>` a Markdown image reference corresponds to.
 *
 * `alt` wins when it names exactly one image (or the same position): the page
 * can inline only some pictures, so a count mismatch must not disable matching
 * for the ones that do carry alt text. With no usable alt, position is the only
 * signal, and it is trusted only when the two lists have the same length — the
 * same assumption `address-images` and `materialize` already make.
 */
export function alignRenderedImage(images, {alt = '', index = 0, count = images.length} = {}) {
  if (!images.length) return null;
  const wanted = normaliseAlt(alt);
  if (wanted) {
    const matches = images.filter((image) => normaliseAlt(image.alt) === wanted);
    if (matches.length === 1) return matches[0];
    const positional = images[index];
    if (positional && normaliseAlt(positional.alt) === wanted) return positional;
  }
  if (count === images.length && images[index]) return images[index];
  return null;
}

function normaliseMime(mime) {
  const value = String(mime || '').trim().toLowerCase();
  return MIME_ALIASES[value] || value;
}

/** `data:<mime>[;param…],<payload>` -> parts, or null when it is not one. */
export function parseDataUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('data:')) return null;
  // The corpus keeps GitHub's `#gh-light-mode-only` display hint on the src
  // (`data:image/svg+xml;base64,…=#gh-light-mode-only`). It is a fragment of
  // the URL, not part of the payload; leaving it in corrupts the base64.
  const match = /^data:([^;,]+)((?:;[^,;]*)*),([^#]*)(?:#.*)?$/s.exec(uri);
  if (!match) return null;
  return {mime: normaliseMime(match[1]), parameters: match[2] || '', payload: match[3] ?? ''};
}

function signatureMatches(mime, bytes) {
  const head = bytes.subarray(0, 16);
  switch (mime) {
    case 'image/png':
      return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'image/gif': {
      const label = head.subarray(0, 6).toString('ascii');
      return label === 'GIF87a' || label === 'GIF89a';
    }
    case 'image/webp':
      return head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'image/svg+xml': {
      // SVG is text: accept either the XML prolog or a leading `<svg>`, after
      // any UTF-8 BOM. Nothing else about the document is assumed.
      const text = bytes.subarray(0, 4096).toString('utf8').replace(/^\uFEFF/, '').trimStart();
      return /^<\?xml/i.test(text) || /^<svg[\s>]/i.test(text);
    }
    default:
      return false;
  }
}

/**
 * Decode an inline image, rejecting anything that is not one of the five
 * supported types or whose bytes contradict the declared type.
 *
 * Returns `{mime, bytes, extension}`; throws an `Error` with a message fit for
 * the `FAILED` log line.
 */
export function decodeInlineImage(uri) {
  const parsed = parseDataUri(uri);
  if (!parsed) throw new Error('not a data: URI');
  const {mime} = parsed;
  if (!MIME_EXTENSION[mime]) throw new Error(`unsupported inline image type (${mime || 'none'})`);
  const base64 = /;\s*base64\b/i.test(parsed.parameters);
  let bytes;
  if (base64) {
    const clean = parsed.payload.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
      throw new Error('inline image payload is not valid base64');
    }
    bytes = Buffer.from(clean, 'base64');
  } else {
    try {
      bytes = Buffer.from(decodeURIComponent(parsed.payload), 'binary');
    } catch {
      throw new Error('inline image payload is not valid percent-encoding');
    }
  }
  if (!bytes.length) throw new Error('inline image payload is empty');
  if (!signatureMatches(mime, bytes)) throw new Error(`inline payload is not ${mime}`);
  return {mime, bytes, extension: MIME_EXTENSION[mime]};
}
