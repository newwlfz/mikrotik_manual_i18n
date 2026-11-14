/**
 * PDF attachment links, written as raw HTML anchors on purpose.
 *
 * A Markdown link to a site-absolute attachment
 * (`[PDF file](/assets/files/lhg-60g-<hash>.pdf)`) is picked up by Docusaurus'
 * `mdx-loader`: its `transformLinks` remark plugin resolves the URL against
 * `static/` and replaces the link with `<a href={require("./x.pdf")}>`, which
 * makes the bundled `@docusaurus/utils` `otherAssets` file loader emit
 * `[name]-[contenthash].[ext]`. Our cached attachments are *already*
 * content-addressed (`<stem>-<sha256>.pdf`), so the emitted name appends a
 * second hash: `knot-<h>.pdf` becomes `knot-<h>-<h>.pdf` in `build/`, and every
 * page that links the file ships the duplicate too. The loader also cannot tell
 * the English and the Chinese page apart, so a single static file produced a
 * copy under every locale tree that `build:slim` then has to delete.
 *
 * `transformLinks` only visits Markdown `link`/`definition` nodes, so a raw
 * `<a>` in the Markdown is rendered as-is and the attachment stays one file
 * served from `static/`. The href is site-absolute because the deployment
 * `baseUrl` is added by `tools/build/remark-prefix-root-refs.mjs`; a relative
 * path would be resolved by the same `transformLinks` pass and defeat the point.
 * `target`/`rel` match what Docusaurus' own asset branch emits for a PDF.
 */

import {fenceMask} from './blocks.mjs';

/** A local attachment URL: the only form this module rewrites. */
const PDF_HREF = /^\/assets\/files\/[^)\s]+?\.pdf(?:[?#][^)\s]*)?$/i;

/**
 * `[label](/assets/files/<name>.pdf)` with an optional Markdown title. A
 * leading `!` (an image) is not a document link and is left alone.
 */
const PDF_MARKDOWN_LINK = /(?<!!)\[([^\]\n]*)\]\((\/assets\/files\/[^)\s]+?\.pdf(?:[?#][^)\s]*)?)(?:\s+"([^"]*)")?\)/g;

/** Is this href a cached PDF the mirror ships? */
export function isPdfHref(href) {
  return PDF_HREF.test(String(href ?? '').trim());
}

/** The anchor form of one document link. */
export function pdfAnchor(href, label, title = '') {
  const attributes = [`href="${href}"`, 'target="_blank"', 'rel="noopener"'];
  if (title) attributes.push(`title="${title}"`);
  return `<a ${attributes.join(' ')}>${label}</a>`;
}

/**
 * A label an HTML anchor can carry verbatim.
 *
 * The anchor's children are parsed as MDX, so `<`, `>` and `{` would start a
 * tag or an expression instead of rendering as text. None of the corpus labels
 * use them; a link that does keeps its Markdown form (and is reported by
 * `verify:assets` as the double hash it causes) rather than being mangled here.
 */
function renderableLabel(label) {
  return !/[<>{}]/.test(label);
}

/**
 * Rewrite the Markdown PDF links of one body into anchors.
 *
 * Fenced code is quoted material, not links, so it is skipped line by line
 * (a page may show the Markdown form as an example). The pass is idempotent:
 * an anchor no longer matches, and a second run changes nothing.
 */
export function anchorPdfLinks(text) {
  const src = String(text ?? '');
  if (!src.includes('/assets/files/')) return src;
  const mask = fenceMask(src);
  return src
    .split('\n')
    .map((line, index) => {
      if (mask[index]) return line;
      return line.replace(PDF_MARKDOWN_LINK, (whole, label, href, title) => {
        if (!renderableLabel(label)) return whole;
        return pdfAnchor(href, label, title ?? '');
      });
    })
    .join('\n');
}

/** How many Markdown PDF links a body still has (for reporting). */
export function countMarkdownPdfLinks(text) {
  const source = String(text ?? '');
  const mask = fenceMask(source);
  let count = 0;
  source.split('\n').forEach((line, index) => {
    if (!mask[index]) count += (line.match(PDF_MARKDOWN_LINK) ?? []).length;
  });
  return count;
}
