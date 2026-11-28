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
 *   - **Shared asset root** (`ASSET_ORIGIN`, canonically a path-only base such
 *     as `/mikrotik_manual_i18n`; a full URL is still accepted for backward
 *     compatibility): references to files that live in `static/` (`/img/…`,
 *     `/assets/…`, `/videos/…`, `/official/…`, `/cli/…`) are rewritten to that
 *     root. With a path-only root the result is itself a root-absolute path
 *     (`/mikrotik_manual_i18n/img/x.webp`), which the browser resolves against
 *     whatever host serves the page — no origin is baked into the artifact.
 *     A localized repository does not ship `static/` at all; the asset bytes
 *     stay on the hub site. `pathname:///assets/…` links (the
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

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeBaseUrl, resolveBaseUrl} from '../lib/site-config.mjs';
import localeRegistry from '../content/locales.js';

const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STATIC_DIR = path.join(SITE_DIR, 'static');
/** `statSync` memo: static/ does not change during a build, this runs per image node. */
const staticAssetExistsCache = new Map();

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

/**
 * `ASSET_ORIGIN` without its trailing slash, or `null` when unset/empty.
 * Path-only (`/repo`) and full-URL (`https://host/repo`) forms share the single
 * normalizer used by `docusaurus.config.ts`; malformed values fail here too.
 */
function sharedAssetOrigin() {
  return localeRegistry.normalizeAssetOrigin(process.env.ASSET_ORIGIN);
}

/** Path part of the shared-asset root: `/repo` for both accepted forms. */
function assetOriginPath(origin) {
  if (!origin) return null;
  if (origin.startsWith('/')) return origin.replace(/\/+$/, '') || null;
  try {
    return new URL(origin).pathname.replace(/\/+$/, '') || null;
  } catch {
    return null;
  }
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

/** Last segment of the shared-asset root (`mikrotik_manual_i18n`). */
function assetOriginName(originPath) {
  if (!originPath || originPath === '/') return null;
  return originPath.split('/').filter(Boolean).pop() ?? null;
}

/**
 * `/mikrotik_manual_i18n/assets/x` -> `/assets/x`: strip an already-present
 * hub prefix so it can never be prepended a second time. `null` when `path`
 * does not carry it. Applies to both origin forms (path-only and full URL).
 */
function stripOriginPrefix(path, context) {
  const originPath = context.originPath;
  if (!originPath || originPath === '/') return null;
  if (path === originPath) return '/';
  if (path.startsWith(`${originPath}/`)) return path.slice(originPath.length) || '/';
  return null;
}

/**
 * `../../mikrotik_manual_i18n/assets/x` -> `/assets/x`: a hub prefix written as
 * a relative path. Only the hub's own directory name is consumed, so ordinary
 * relative links (`../docs/x`, `../assets/x`) return `null` and are left alone.
 */
function stripRelativeOriginPrefix(value, context) {
  const name = context.originName;
  if (!name) return null;
  let rest = value;
  while (rest.startsWith('./') || rest.startsWith('../')) {
    rest = rest.slice(rest.startsWith('../') ? 3 : 2);
  }
  const prefix = `${name}/`;
  return rest.startsWith(prefix) ? `/${rest.slice(prefix.length)}` : null;
}

/**
 * `/img/x` (or `pathname:///img/x`, or an already hub-prefixed
 * `/mikrotik_manual_i18n/img/x`) -> `<ASSET_ORIGIN>/img/x`, or `null` when the
 * value is not a shared asset (a page route, an external URL, an unrelated
 * relative path, or no origin set). With a path-only `ASSET_ORIGIN` the result
 * is a root-absolute path: `origin=/repo` + `path=/img/x` -> `/repo/img/x`.
 *
 * The hub prefix is stripped *before* the `ASSET_PREFIXES` gate. That is what
 * makes the "never prepend twice" rule effective: a value such as
 * `/mikrotik_manual_i18n/assets/x` no longer falls through the gate into
 * `prefixUrl()` (which would add the site `baseUrl` and create a double base).
 * The function is idempotent, which matters because the plugin is registered
 * both in `beforeDefaultRemarkPlugins` and in `remarkPlugins`.
 */
function sharedAssetUrl(value, context) {
  if (!context.origin || typeof value !== 'string') return null;
  const pathname = PATHNAME_SCHEME.exec(value);
  let path;
  if (pathname) {
    // Docusaurus' "use this path as-is" scheme, used by the downloadable
    // examples (`pathname:///assets/…`): the asset is still a `static/` file.
    path = pathname[1].replace(/^\/{2,}/, '/');
  } else if (value.startsWith('/') && !value.startsWith('//')) {
    path = stripBaseUrlPrefix(value, context);
  } else {
    // A hub prefix written as a relative path is still a shared asset.
    path = stripRelativeOriginPrefix(value, context);
    if (path === null) return null;
  }
  // Normalize an already-present hub prefix first (both origin forms).
  const bare = stripOriginPrefix(path, context);
  if (bare !== null) path = bare;
  if (!ASSET_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return `${context.origin}${path}`;
}

/**
 * Docusaurus renders every `<a>` — including a Markdown `[x](…)` link —
 * through `<MDXComponents/A>` -> `<Link>`, which prepends the deployment
 * `baseUrl` to any `href` starting with `/`. A path-only `ASSET_ORIGIN`
 * deliberately produces such a path (`/mikrotik_manual_i18n/assets/x`); left
 * as a Markdown link it becomes
 * `/<siteBase>/mikrotik_manual_i18n/assets/x` and 404s. Emitting the anchor
 * with `autoAddBaseUrl={false}` keeps the single hub prefix. Images and raw
 * HTML/JSX attributes are unaffected: they are not routed through `<Link>`.
 * Full-URL `ASSET_ORIGIN` needs no conversion (an external URL is never
 * prefixed by Docusaurus), so this is backward compatible with both forms.
 */
function renderHubLink(node, url) {
  const falseExpression = {
    type: 'mdxJsxAttributeValueExpression',
    value: 'false',
    data: {
      estree: {
        type: 'Program',
        body: [{type: 'ExpressionStatement', expression: {type: 'Literal', value: false, raw: 'false'}}],
        sourceType: 'module',
        comments: [],
      },
    },
  };
  const attributes = [
    {type: 'mdxJsxAttribute', name: 'href', value: url},
    {type: 'mdxJsxAttribute', name: 'autoAddBaseUrl', value: falseExpression},
  ];
  if (node.title) attributes.push({type: 'mdxJsxAttribute', name: 'title', value: node.title});
  delete node.url;
  delete node.title;
  Object.assign(node, {type: 'mdxJsxTextElement', name: 'a', attributes});
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
 * Local-asset mode: does a bare `/img/…` / `/assets/files/…` URL point at a
 * real file under `static/`?
 *
 * Docusaurus' `transformImage` resolves such a URL against `staticDirs`, then
 * emits a hashed `assets/images/<hash>-<webpack>.<ext>` URL (baseUrl-prefixed
 * through webpack publicPath) **and reads the file with `image-size` to add
 * real `width`/`height` attributes**. Those intrinsic dimensions are what keeps
 * a `loading="lazy"` image from collapsing to a 0px box before it is scrolled
 * into view. Prefixing the URL here makes `transformImage` look under
 * `<staticDir>/<baseUrl>/…`, find nothing, and leave the raw string behind —
 * no hashed asset, no width/height. So only prefix references with no matching
 * `static/` file: those are the ones `transformImage` cannot resolve and that
 * would otherwise 404 under a sub-path deployment.
 */
function localStaticAssetExists(url, context) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return false;
  // An already-prefixed URL (an earlier pass, or a source that was rewritten
  // once already) is not a bare static path; prefixUrl() is idempotent for it.
  if (context.baseUrl !== '/' && (url === context.bareBaseUrl || url.startsWith(context.baseUrl))) {
    return false;
  }
  // Strip the `#gh-light-mode-only` / `#gh-dark-mode-only` fragments and any
  // query string before looking on disk.
  const pathname = url.split('#', 1)[0].split('?', 1)[0];
  if (!pathname.startsWith('/')) return false;
  const candidate = path.join(STATIC_DIR, pathname);
  if (!candidate.startsWith(`${STATIC_DIR}${path.sep}`)) return false;
  let exists = staticAssetExistsCache.get(candidate);
  if (exists === undefined) {
    try {
      exists = fs.statSync(candidate).isFile();
    } catch {
      exists = false;
    }
    staticAssetExistsCache.set(candidate, exists);
  }
  return exists;
}

/**
 * Markdown link/image destinations.
 *
 * Shared-asset mode: rewrite `image`/`link`/`definition` to `ASSET_ORIGIN`
 * before `transformImage` / `transformLinks` can resolve them locally.
 *
 * Local-asset mode: bare `/img/…` or `/assets/files/…` image URLs whose file
 * exists under `static/` are left untouched for `transformImage` (hashed asset
 * + intrinsic width/height). Only references with no matching static file are
 * prefixed with the deployment baseUrl. Links and definitions stay untouched.
 */
function rewriteMarkdownDestination(node, context) {
  if (!context.origin) {
    // Local-asset mode. Docusaurus' `transformImage` owns Markdown images and
    // normally rewrites them to hashed `assets/images` requires. When it cannot
    // resolve a static path it leaves the raw string in the AST, which is
    // rendered verbatim and 404s under a sub-path deployment. Prefix only those
    // unresolvable references; leave resolvable ones to transformImage so the
    // emitted <img> keeps its real width/height. `prefixUrl()` is idempotent and
    // skips a path that already carries the baseUrl, so the second registration
    // (`remarkPlugins`) and already-prefixed docs pages are unaffected.
    if (node.type !== 'image' || typeof node.url !== 'string') return;
    if (!/^\/(?:img|assets\/files)\//.test(node.url)) return;
    if (localStaticAssetExists(node.url, context)) return;
    const prefixed = prefixUrl(node.url, context);
    if (prefixed) node.url = prefixed;
    return;
  }
  // `imageReference` / `linkReference` carry only a label; the URL lives on the
  // matching `definition` node, which is visited too.
  if (node.type !== 'image' && node.type !== 'link' && node.type !== 'definition') return;
  if (typeof node.url !== 'string') return;
  const url = sharedAssetUrl(node.url, context);
  if (!url) return;
  node.url = url;
  // Path-only ASSET_ORIGIN + a Markdown link is the one combination Docusaurus
  // would prefix again (its <Link> autoAddBaseUrl). References have no href of
  // their own, so only inline links need the explicit no-base anchor.
  if (node.type === 'link' && context.origin.startsWith('/') &&
      context.originPath && url.startsWith(`${context.originPath}/`)) {
    renderHubLink(node, url);
  }
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
    const originPath = assetOriginPath(origin);
    const context = {
      origin,
      originPath,
      originName: assetOriginName(originPath),
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
