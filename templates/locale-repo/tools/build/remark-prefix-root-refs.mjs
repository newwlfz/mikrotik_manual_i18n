/**
 * Rewrite root-absolute asset references in content for the deployed site.
 *
 * Two modes, selected by the build environment:
 *
 *   - **Local assets** (default): every root-absolute reference gets the
 *     deployment `baseUrl`. The mirror is deployed under a sub-path
 *     (`/mikrotik_manual_i18n/`), so a value like
 *     `/videos/wireless-setup_video.mp4` copied verbatim from the official
 *     site (which is served from the origin root) leaves the mirror and 404s.
 *     Docusaurus only prefixes values it owns — `useBaseUrl()` for links and
 *     theme components, `transformImage` for markdown images — and a raw
 *     HTML/JSX attribute in the Markdown is rendered byte for byte, so the
 *     prefix has to be added here.
 *   - **Shared asset origin** (`ASSET_ORIGIN`, e.g.
 *     `https://newwlfz.github.io/mikrotik_manual_i18n`): references to files
 *     that live in `static/` (`/img/…`, `/assets/…`, `/videos/…`,
 *     `/official/…`, `/cli/…`) are rewritten to the English site's origin
 *     instead. A localized repository does not ship `static/` at all; the
 *     asset bytes stay on the hub site. `pathname:///assets/…` links (the
 *     "keep this path as-is" form used by the download examples) are treated
 *     as the root path they stand for. Page routes (`/docs/…`,
 *     `/hardware/…`, …) are **not** rewritten: they are local routes and keep
 *     the `baseUrl` behaviour. With `ASSET_ORIGIN` unset nothing changes.
 *
 * The transform runs on mdast during MDX compilation:
 *
 *   - `image` / `link` / `definition` nodes, for Markdown `![]()` images and
 *     links. These run *before* Docusaurus' built-in `transformImage` /
 *     `transformLinks`, which turn a reference into a `require()` of a local
 *     file; rewriting first is what lets a localized build run without
 *     `static/`. Only shared-asset references are touched in this early pass,
 *     every other URL is left for the later pass (and for Docusaurus).
 *   - `mdxJsxFlowElement` / `mdxJsxTextElement` attributes. MDX parses raw HTML
 *     in `.md` into JSX elements (a block `<video>` is *not* an `html` node),
 *     so this is the branch that covers the corpus. Uppercase elements are
 *     React components, not HTML: `<Img src>` already resolves its `src`
 *     through `customFields.assetBaseUrl`, and prefixing it here would be
 *     wrong.
 *   - `html` nodes, for a document compiled as plain CommonMark.
 *
 * Attributes are prefixed only when they are single-`/` absolute, not
 * protocol-relative (`//`), and not already external; `srcset` is split on
 * commas so every candidate keeps its descriptor. The `content` attribute is
 * limited to `<meta>` (open-graph images), because on other tags it is not a
 * URL.
 *
 * Deliberately *not* handled: the captured WebFig page
 * `static/assets/295239801_index2.html`. Its `/favicon.png`, `/assets/style.css`
 * and `/assets/script.js` are paths on the *router*, not on the mirror; it is
 * copied verbatim and exempted by file in `tools/verify/base-url-refs.mjs`.
 */

import {normalizeBaseUrl, resolveBaseUrl} from '../lib/site-config.mjs';

/** Attributes that can hold a URL (mdast `html` nodes and JSX elements). */
const URL_ATTRIBUTES = new Set(['src', 'href', 'srcset', 'poster']);
/** `content` only names a URL on `<meta>`. */
const META_CONTENT_ATTRIBUTES = new Set([...URL_ATTRIBUTES, 'content']);

/**
 * Paths under `static/`, i.e. the bytes a localization repository no longer
 * keeps. `/assets/` covers the `files/` (PDFs) and `images/` sub-trees the hub
 * writes plus the captured `assets/*.html|txt|zip` downloads.
 */
const ASSET_PREFIXES = ['/img/', '/assets/', '/videos/', '/official/', '/cli/'];

const HTML_TAG = /<([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const HTML_ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** `ASSET_ORIGIN` without its trailing slash, or `null` when unset/empty. */
function sharedAssetOrigin() {
  const value = String(process.env.ASSET_ORIGIN || '').trim();
  return value ? value.replace(/\/+$/, '') : null;
}

/** `/x` -> `<baseUrl>x`, or `null` when the value must be left alone. */
function prefixUrl(value, context) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (context.baseUrl === '/') return null;
  // Already under the deployment prefix (or the bare prefix without its
  // trailing slash): prefixing again would double it.
  if (value === context.bareBaseUrl || value.startsWith(context.baseUrl)) return null;
  return `${context.bareBaseUrl}${value}`;
}

/** `/base/img/x` -> `/img/x`: the deployment prefix is not part of the asset path. */
function stripBaseUrlPrefix(value, context) {
  if (context.baseUrl === '/') return value;
  if (value === context.bareBaseUrl) return '/';
  return value.startsWith(context.baseUrl) ? `/${value.slice(context.baseUrl.length)}` : value;
}

/** `pathname:///assets/x` -> `///assets/x` (the scheme only marks the form). */
const PATHNAME_SCHEME = /^pathname:(\/.*)$/;

/**
 * `/img/x` (or `pathname:///img/x`) -> `<ASSET_ORIGIN>/img/x`, or `null` when
 * the value is not a shared asset (a page route, an external URL, a relative
 * path, or no origin set).
 */
function sharedAssetUrl(value, context) {
  if (!context.origin || typeof value !== 'string') return null;
  const pathname = PATHNAME_SCHEME.exec(value);
  let path;
  if (pathname) {
    // Docusaurus' "use this path as-is" scheme, used by the downloadable
    // examples (`pathname:///assets/…`): the asset is still a `static/` file.
    path = pathname[1].replace(/^\/{2,}/, '/');
  } else {
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    path = stripBaseUrlPrefix(value, context);
  }
  if (!ASSET_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return `${context.origin}${path}`;
}

/** Prefix every candidate of a `srcset`, keeping whitespace and descriptors. */
function prefixSrcset(value, context) {
  let changed = false;
  const next = value
    .split(',')
    .map((candidate) => {
      const match = /^(\s*)(\S+)([\s\S]*)$/.exec(candidate);
      if (!match) return candidate;
      const [, leading, url, descriptor] = match;
      const prefix = sharedAssetUrl(url, context) ?? prefixUrl(url, context);
      if (!prefix) return candidate;
      changed = true;
      return `${leading}${prefix}${descriptor}`;
    })
    .join(',');
  return changed ? next : null;
}

function prefixAttribute(attribute, value, context) {
  if (attribute === 'srcset') return prefixSrcset(value, context);
  return sharedAssetUrl(value, context) ?? prefixUrl(value, context);
}

/** Rewrite the URL attributes of one raw HTML tag. */
function rewriteTag(tag, context) {
  const match = /^<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s[^>]*)?)(\/?)>$/.exec(tag);
  if (!match) return tag;
  const name = match[1].toLowerCase();
  const allowed = name === 'meta' ? META_CONTENT_ATTRIBUTES : URL_ATTRIBUTES;
  const attributes = match[2].replace(HTML_ATTRIBUTE, (whole, attribute, doubleQ, singleQ, bare) => {
    const lower = attribute.toLowerCase();
    if (!allowed.has(lower)) return whole;
    const value = doubleQ ?? singleQ ?? bare ?? '';
    const prefixed = prefixAttribute(lower, value, context);
    if (!prefixed) return whole;
    const quote = doubleQ !== undefined ? '"' : singleQ !== undefined ? "'" : '';
    return `${attribute}=${quote}${prefixed}${quote}`;
  });
  if (attributes === match[2]) return tag;
  return `<${match[1]}${attributes}${match[3]}>`;
}

function rewriteHtml(value, context) {
  return value.replace(HTML_TAG, (tag) => rewriteTag(tag, context));
}

function rewriteJsxElement(node, context) {
  if (!Array.isArray(node.attributes)) return;
  // `<Img>`, `<Link>`, `<Tabs>`… are components: their props are values, not
  // rendered attributes. `<Img src>` resolves through `assetBaseUrl` already.
  if (typeof node.name === 'string' && /^[A-Z]/.test(node.name)) return;
  for (const attribute of node.attributes) {
    if (attribute?.type !== 'mdxJsxAttribute') continue;
    const name = String(attribute.name || '').toLowerCase();
    if (!URL_ATTRIBUTES.has(name)) continue;
    // `{expression}` values are computed at render time; they are not literals
    // a static pass can resolve.
    if (typeof attribute.value !== 'string') continue;
    const prefixed = prefixAttribute(name, attribute.value, context);
    if (prefixed) attribute.value = prefixed;
  }
}

/**
 * Markdown link/image destinations. Only runs in the shared-asset mode: the
 * early pass must not touch a URL otherwise, because `transformImage` and
 * `transformLinks` own them in the default mode and add the baseUrl
 * themselves.
 */
function rewriteMarkdownDestination(node, context) {
  if (!context.origin) return;
  // `imageReference` / `linkReference` carry only a label; the URL lives on the
  // matching `definition` node, which is visited too.
  if (node.type !== 'image' && node.type !== 'link' && node.type !== 'definition') return;
  if (typeof node.url !== 'string') return;
  const url = sharedAssetUrl(node.url, context);
  if (url) node.url = url;
}

function walk(node, visit) {
  visit(node);
  if (Array.isArray(node.children)) for (const child of node.children) walk(child, visit);
}

export default function remarkPrefixRootRefs() {
  return (tree) => {
    // Read once per compile from the single source of truth
    // (`docusaurus.config.ts`, honouring `BASE_URL`) and from the environment.
    const baseUrl = normalizeBaseUrl(resolveBaseUrl().value);
    const origin = sharedAssetOrigin();
    // Under `/` with no shared origin every root-absolute reference is already
    // correct.
    if (baseUrl === '/' && !origin) return;
    const context = {
      origin,
      baseUrl,
      bareBaseUrl: baseUrl === '/' ? '' : baseUrl.replace(/\/+$/, ''),
    };

    walk(tree, (node) => {
      if (node.type === 'html') {
        node.value = rewriteHtml(node.value, context);
      } else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        rewriteJsxElement(node, context);
      } else {
        rewriteMarkdownDestination(node, context);
      }
    });
  };
}
