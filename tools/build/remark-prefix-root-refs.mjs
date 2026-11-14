/**
 * Add the deployment `baseUrl` to root-absolute asset references in content.
 *
 * The mirror is deployed under a sub-path (`/mikrotik_manual_i18n/`), so a
 * value like `/videos/wireless-setup_video.mp4` copied verbatim from the
 * official site (which is served from the origin root) leaves the mirror and
 * 404s. Docusaurus only prefixes values it owns — `useBaseUrl()` for links and
 * theme components, `transformImage` for markdown images — and a raw HTML/JSX
 * attribute in the Markdown is rendered byte for byte, so the prefix has to be
 * added here.
 *
 * The transform runs on mdast during MDX compilation:
 *
 *   - `mdxJsxFlowElement` / `mdxJsxTextElement` attributes. MDX parses raw HTML
 *     in `.md` into JSX elements (a block `<video>` is *not* an `html` node),
 *     so this is the branch that covers the corpus. Uppercase elements are
 *     React components, not HTML: `<Img src>` already runs its `src` through
 *     `useBaseUrl`, and prefixing it here would be wrong even though
 *     `addBaseUrl` happens to tolerate an existing prefix.
 *   - `html` nodes, for a document compiled as plain CommonMark.
 *
 * Attributes are prefixed only when they are single-`/` absolute, not
 * protocol-relative (`//`), and not already under `baseUrl`; `srcset` is
 * split on commas so every candidate keeps its descriptor. The `content`
 * attribute is limited to `<meta>` (open-graph images), because on other tags
 * it is not a URL.
 *
 * Deliberately *not* handled: `static/` files. `static/assets/295239801_index2.html`
 * is a captured WebFig login page whose `/favicon.png`, `/assets/style.css`
 * and `/assets/script.js` are paths on the *router*, not on the mirror; it is
 * copied verbatim and exempted by file in `tools/verify/base-url-refs.mjs`.
 */

import {normalizeBaseUrl, resolveBaseUrl} from '../lib/site-config.mjs';

/** Attributes that can hold a URL (mdast `html` nodes and JSX elements). */
const URL_ATTRIBUTES = new Set(['src', 'href', 'srcset', 'poster']);
/** `content` only names a URL on `<meta>`. */
const META_CONTENT_ATTRIBUTES = new Set([...URL_ATTRIBUTES, 'content']);

const HTML_TAG = /<([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const HTML_ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** `/x` -> `<baseUrl>x`, or `null` when the value must be left alone. */
function prefixUrl(value, bareBaseUrl, baseUrl) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  // Already under the deployment prefix (or the bare prefix without its
  // trailing slash): prefixing again would double it.
  if (value === bareBaseUrl || value.startsWith(baseUrl)) return null;
  return `${bareBaseUrl}${value}`;
}

/** Prefix every candidate of a `srcset`, keeping whitespace and descriptors. */
function prefixSrcset(value, bareBaseUrl, baseUrl) {
  let changed = false;
  const next = value
    .split(',')
    .map((candidate) => {
      const match = /^(\s*)(\S+)([\s\S]*)$/.exec(candidate);
      if (!match) return candidate;
      const [, leading, url, descriptor] = match;
      const prefixed = prefixUrl(url, bareBaseUrl, baseUrl);
      if (!prefixed) return candidate;
      changed = true;
      return `${leading}${prefixed}${descriptor}`;
    })
    .join(',');
  return changed ? next : null;
}

function prefixAttribute(attribute, value, bareBaseUrl, baseUrl) {
  return attribute === 'srcset'
    ? prefixSrcset(value, bareBaseUrl, baseUrl)
    : prefixUrl(value, bareBaseUrl, baseUrl);
}

/** Rewrite the URL attributes of one raw HTML tag. */
function rewriteTag(tag, bareBaseUrl, baseUrl) {
  const match = /^<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s[^>]*)?)(\/?)>$/.exec(tag);
  if (!match) return tag;
  const name = match[1].toLowerCase();
  const allowed = name === 'meta' ? META_CONTENT_ATTRIBUTES : URL_ATTRIBUTES;
  const attributes = match[2].replace(HTML_ATTRIBUTE, (whole, attribute, doubleQ, singleQ, bare) => {
    const lower = attribute.toLowerCase();
    if (!allowed.has(lower)) return whole;
    const value = doubleQ ?? singleQ ?? bare ?? '';
    const prefixed = prefixAttribute(lower, value, bareBaseUrl, baseUrl);
    if (!prefixed) return whole;
    const quote = doubleQ !== undefined ? '"' : singleQ !== undefined ? "'" : '';
    return `${attribute}=${quote}${prefixed}${quote}`;
  });
  if (attributes === match[2]) return tag;
  return `<${match[1]}${attributes}${match[3]}>`;
}

function rewriteHtml(value, bareBaseUrl, baseUrl) {
  return value.replace(HTML_TAG, (tag) => rewriteTag(tag, bareBaseUrl, baseUrl));
}

function rewriteJsxElement(node, bareBaseUrl, baseUrl) {
  if (!Array.isArray(node.attributes)) return;
  // `<Img>`, `<Link>`, `<Tabs>`… are components: their props are values, not
  // rendered attributes. `<Img src>` resolves through `useBaseUrl` already.
  if (typeof node.name === 'string' && /^[A-Z]/.test(node.name)) return;
  for (const attribute of node.attributes) {
    if (attribute?.type !== 'mdxJsxAttribute') continue;
    const name = String(attribute.name || '').toLowerCase();
    if (!URL_ATTRIBUTES.has(name)) continue;
    // `{expression}` values are computed at render time; they are not literals
    // a static pass can resolve.
    if (typeof attribute.value !== 'string') continue;
    const prefixed = prefixAttribute(name, attribute.value, bareBaseUrl, baseUrl);
    if (prefixed) attribute.value = prefixed;
  }
}

function walk(node, visit) {
  visit(node);
  if (Array.isArray(node.children)) for (const child of node.children) walk(child, visit);
}

export default function remarkPrefixRootRefs() {
  return (tree) => {
    // Read once per compile from the single source of truth
    // (`docusaurus.config.ts`, honouring `BASE_URL`).
    const baseUrl = normalizeBaseUrl(resolveBaseUrl().value);
    // Under `/` every root-absolute reference is already correct.
    if (baseUrl === '/') return;
    const bareBaseUrl = baseUrl.replace(/\/+$/, '');

    walk(tree, (node) => {
      if (node.type === 'html') {
        node.value = rewriteHtml(node.value, bareBaseUrl, baseUrl);
      } else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        rewriteJsxElement(node, bareBaseUrl, baseUrl);
      }
    });
  };
}
