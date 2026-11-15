/**
 * Link normalisation for the translated overlays.
 *
 * The overlays are Markdown, so a link is only retargeted by Docusaurus when it
 * ends in `.md`/`.mdx`: `mdx-loader`'s `remark-resolve-markdown-links` resolves
 * such a path through the plugin's `sourceToPermalink` map, and the docs plugin
 * then adds the locale. A bare `/docs/<slug>` URL skips that path entirely: it
 * always points at the *current* release in the *default* locale, so an archived
 * overlay links into the wrong version and every Chinese page sends its reader
 * to the English site. Relative `.md` links fix both at once.
 *
 * An inline `<a href="/docs/...">` has the same problem for a worse reason: MDX
 * renders the raw attribute and the docs plugin's Markdown-link resolver never
 * sees it, so the browser lands on the English page of whatever release the
 * anchor spells. `normalize-links` turns such an anchor into a Markdown link
 * whenever no attribute has to survive; the ones that keep their HTML get a
 * `/<locale><docsPrefix>/<slug>` href here, which is the only form that works
 * without the router.
 *
 * Two consequences shape the rules below.
 *
 *   - A relative link is resolved inside the current locale's content directory
 *     only. A page without a Chinese overlay therefore cannot be linked that
 *     way (it would be a broken Markdown link in the Chinese build), so such a
 *     target keeps an absolute `/<route base>/<slug>` URL.
 *   - A link to another plugin (hardware, blog, changelog) never resolves
 *     through this plugin's map, so it stays absolute as well.
 *
 * The route table comes from the crawled official sidebar
 * (`data/manifests/docs-<v>-sidebar.routes.json`), falling back to the upstream
 * manifest when the crawl is missing. It answers "does this page exist in this
 * release", which is the only safe test for rewriting an official-site URL.
 */

import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import {REPO, SECTIONS} from './paths.mjs';
import {segmentSpans} from './blocks.mjs';
import {anchorPattern, parseAnchorAttributes, anchorHref, anchorLabel} from './html-links.mjs';
import {pdfAnchor} from './pdf-links.mjs';
import {glossaryTerms} from './tm.mjs';
import {splitFrontMatter, readField} from './frontmatter.mjs';
import {allVersions, currentVersion, isCurrentOnlyPage, versionForSection, versionPlan} from '../../sync/lib/versions.mjs';

/** The official site, which the overlays still carry links to. */
const OFFICIAL_HOST = /^https?:\/\/(?:www\.)?manual\.mikrotik\.com(?=[/?#]|$)/i;
export const OFFICIAL_ORIGIN = 'https://manual.mikrotik.com';

/** Links to these are documents, not routes: never rewritten here. */
const ASSET = /\.(?:png|jpe?g|webp|gif|svg|pdf|txt|zip|gz|rsc|json|csv|npk|pcap|bin|mp4|webm|iso|img)$/i;

/** The cached attachments `sync-pdfs` downloads; served from the site root. */
export const ASSET_DIR = 'static/assets/files';
export const ASSET_ROUTE = '/assets/files';
/** `https://manual.mikrotik.com/assets/files/<name>.pdf`, the export's form. */
const OFFICIAL_PDF = /^https?:\/\/(?:www\.)?manual\.mikrotik\.com\/assets\/files\/([^/?#]+\.pdf)([?#].*)?$/i;

/** `[text](url)` and `![alt](url)`; the bang is kept so images are skipped. */
const MARKDOWN_LINK = /(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
/** Inline HTML anchors skip Markdown link resolution, so they are handled apart. */
const HTML_HREF = /(\bhref=")([^"]+)(")/g;
/** `pathname://` and friends are explicit "do not touch" markers. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const CJK = /[\u4e00-\u9fff]/;

const cache = {
  routes: new Map(),
  titles: new Map(),
};

const toPosix = (value) => String(value).split(path.sep).join('/');

/**
 * `/docs/7.25/getting-started/` -> `getting-started`; also strips a Markdown
 * extension, an `/index` suffix and any absolute origin.
 */
export function normaliseSlug(value) {
  let slug = String(value ?? '').trim();
  slug = slug.replace(OFFICIAL_HOST, '');
  const cut = slug.search(/[?#]/);
  if (cut !== -1) slug = slug.slice(0, cut);
  slug = slug.replace(/\\/g, '/').replace(/\/+$/, '');
  slug = slug.replace(/\.mdx?$/i, '');
  slug = slug.replace(/^\/+/, '');
  // A route may be written with its version prefix; the prefix is not a page.
  const versioned = /^docs\/(\d+(?:\.\d+)*)\/(.+)$/.exec(slug);
  if (versioned) slug = versioned[2];
  else slug = slug.replace(/^docs\/?/, '');
  slug = slug.replace(/\/+$/, '').replace(/\/index$/, '');
  return slug;
}

/** Split `?query` and `#fragment` off a link target. */
export function splitSuffix(url) {
  const match = /^([^?#]*)([?#].*)?$/.exec(String(url));
  if (!match) return {pathPart: String(url), suffix: ''};
  return {pathPart: match[1], suffix: match[2] || ''};
}

/**
 * Resolve an official PDF link to the cached attachment the mirror ships.
 *
 * The official export loses the content hash in `/assets/files/<name>.pdf`, so
 * the same name is stored either verbatim or content-addressed
 * (`<stem>-<sha256>.pdf`). Returns `{name, path}` for a cached file, `{missing}`
 * for a link whose file was never downloaded (keep the external URL and report
 * it), or `null` when the URL is not an asset link at all.
 */
export function resolvePdfAsset(url) {
  const match = OFFICIAL_PDF.exec(String(url ?? '').trim());
  if (!match) return null;
  // A page repeats the same attachment in prose and in a caption, and the
  // overlays share their links; one directory scan per name is enough.
  const cached = pdfCache.get(match[1]);
  const resolved = cached || lookupPdfAsset(match[1]);
  if (!cached) pdfCache.set(match[1], resolved);
  const suffix = match[2] || '';
  return 'missing' in resolved ? resolved : {name: resolved.name, path: `${resolved.path}${suffix}`};
}

const pdfCache = new Map();

function lookupPdfAsset(name) {
  if (fs.existsSync(path.join(REPO, ASSET_DIR, name))) return {name, path: `${ASSET_ROUTE}/${name}`};
  const stem = name.replace(/\.pdf$/i, '');
  const dir = path.join(REPO, ASSET_DIR);
  const matches = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((entry) => entry.startsWith(`${stem}-`) && entry.endsWith('.pdf'))
    : [];
  if (matches.length === 1) return {name: matches[0], path: `${ASSET_ROUTE}/${matches[0]}`};
  return {missing: name};
}

/** `docs` -> its version, or nothing for the sections that are not versioned. */
export function sectionVersion(name) {
  return versionForSection(name);
}

/** The overlay directory a docs section writes into. */
export function sectionOverlay(name) {
  return SECTIONS.find((section) => section.name === name)?.overlay ?? null;
}

/**
 * The locale an overlay belongs to: `i18n/<locale>/docusaurus-plugin-content-*`.
 *
 * Docusaurus prepends it to every route of a localised page, so a raw HTML href
 * that has to work without the router must spell it out.
 */
export function sectionLocale(section) {
  const match = /^i18n\/([^/]+)\//.exec(section?.overlay ?? '');
  return match ? match[1] : null;
}

let localeCache = null;

/** Every locale the repository translates into, read off the overlay paths. */
function knownLocales() {
  if (!localeCache) {
    localeCache = new Set(SECTIONS.map((section) => sectionLocale(section)).filter(Boolean));
  }
  return localeCache;
}

/** The route prefix a release is served under: `/docs` or `/docs/7.25`. */
export function routeBase(version) {
  return versionPlan(version).docsPrefix;
}

/**
 * Locate the Markdown file that owns a route in one release.
 *
 * The crawler keys sidebar items by document id (`a/b/index`), while the
 * materialised tree may flatten the same page to `a/b.md`; both spellings are
 * tried, and `null` means the route has no mirrored file.
 */
function fileForRoute(docsDir, id, slug) {
  const candidates = [
    id ? `${id}.md` : null,
    slug ? `${slug}.md` : null,
    slug ? `${slug}/index.md` : null,
    id ? `${id}/index.md` : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(REPO, docsDir, candidate))) return candidate;
  }
  return null;
}

/**
 * Routes of one release, keyed by page slug.
 *
 * Returns `{version, base, docsDir, source, entries}` where an entry is
 * `{slug, file, href, id, label}` and `file` is the page's path inside the
 * release's docs tree (`null` when the crawler knows a route the mirror does not
 * carry).
 */
export function routeTable(version) {
  if (cache.routes.has(version)) return cache.routes.get(version);
  const plan = versionPlan(version);
  const entries = new Map();
  let source = null;

  const routesFile = path.join(REPO, `data/manifests/docs-${version}-sidebar.routes.json`);
  if (fs.existsSync(routesFile)) {
    source = 'sidebar.routes';
    const rows = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
    for (const row of Array.isArray(rows) ? rows : []) {
      const slug = normaliseSlug(row.href || row.id || '');
      if (!slug) continue;
      entries.set(slug, {
        slug,
        file: fileForRoute(plan.docsDir, row.id, slug),
        href: row.href ?? null,
        id: row.id ?? null,
        label: row.label ?? null,
      });
    }
  }

  if (entries.size === 0 && fs.existsSync(path.join(REPO, plan.manifest))) {
    // No crawl: the upstream manifest lists the pages the mirror actually has.
    source = 'manifest';
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, plan.manifest), 'utf8'));
    for (const page of manifest.pages || []) {
      if (page.origin && page.origin !== 'official' && page.origin !== 'local') continue;
      const file = page.local_path ?? null;
      const slug = normaliseSlug(file || page.route || '');
      if (!slug) continue;
      entries.set(slug, {
        slug,
        file: file && fs.existsSync(path.join(REPO, plan.docsDir, file)) ? file : null,
        href: null,
        id: file ? file.replace(/\.mdx?$/i, '') : null,
        label: page.official_title ?? null,
      });
    }
  }

  const table = {version, base: plan.docsPrefix, docsDir: plan.docsDir, source, entries};
  cache.routes.set(version, table);
  return table;
}

/** First heading of a document, used when the front matter carries no title. */
function firstHeading(body) {
  const match = /^#\s+(.+)$/m.exec(String(body));
  return match ? match[1].trim() : null;
}

function fileTitle(file) {
  const absolute = path.join(REPO, file);
  if (!fs.existsSync(absolute)) return null;
  const parsed = splitFrontMatter(fs.readFileSync(absolute, 'utf8'));
  return readField(parsed.frontMatter, 'title') || firstHeading(parsed.body);
}

/**
 * The English and Chinese titles of one route.
 *
 * `chinese` is only set when the overlay really translated the title (a copy of
 * the English one is not a translation). Used to make link text follow the page
 * it points at.
 */
export function pageTitles(section, entry) {
  if (!entry?.file) return {english: null, chinese: null};
  const key = `${section.overlay}/${entry.file}`;
  if (cache.titles.has(key)) return cache.titles.get(key);
  const docsDir = SECTIONS.find((item) => item.name === section.name)?.source ?? section.source;
  const english = fileTitle(path.posix.join(docsDir, entry.file)) || entry.label || null;
  const chineseTitle = fileTitle(path.posix.join(section.overlay, entry.file));
  const chinese = chineseTitle && CJK.test(chineseTitle) ? chineseTitle : null;
  const titles = {english, chinese};
  cache.titles.set(key, titles);
  return titles;
}

/**
 * Path from one overlay page to another, as a Markdown link target.
 *
 * Both trees (English and overlay) have the same shape, so the same relative
 * path works in the overlay. `./` keeps the link out of the bare-filename
 * branch of the resolver.
 */
export function relativeDocLink(fromFile, toFile) {
  const from = toPosix(fromFile);
  const to = toPosix(toFile);
  const dir = path.posix.dirname(from);
  let rel = path.posix.relative(dir === '.' ? '.' : dir, to);
  if (rel === '') rel = path.posix.basename(to);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

/**
 * Classify a link target against the page's own release.
 *
 * `{kind: 'skip'}` means "not ours": external sites, assets, anchors and
 * already-relative links. `{kind: 'docs', slug, version, official, locale}` is
 * a `/docs/...` route, with `version` set when the URL names a release and
 * `locale` set when the URL already carries a locale prefix (`/zh-Hans/docs/...`).
 */
export function parseTarget(url) {
  const raw = String(url ?? '');
  if (!raw) return {kind: 'skip'};
  let rest = raw;
  let official = false;
  if (OFFICIAL_HOST.test(rest)) {
    official = true;
    rest = rest.replace(OFFICIAL_HOST, '');
  } else if (!rest.startsWith('/')) {
    // Relative paths and `pathname://`/`mailto:`-style schemes are left alone.
    return {kind: 'skip'};
  }
  if (SCHEME.test(rest)) return {kind: 'skip'};
  if (ASSET.test(rest)) return {kind: 'skip'};
  // A localised page is served under `/<locale>/docs/...`; the prefix is part of
  // the route the site actually renders, not part of the slug.
  let locale = null;
  const localised = /^\/([^/]+)\/(?=docs\/)/.exec(rest);
  if (localised && knownLocales().has(localised[1])) {
    locale = localised[1];
    rest = rest.slice(1 + localised[1].length);
  }
  if (!rest.startsWith('/docs/')) return {kind: 'skip'};
  const segments = rest.slice('/docs/'.length).split('/').filter(Boolean);
  if (segments.length === 0) return {kind: 'skip'};
  // `/docs/tags/<tag>` is a generated tag page, not a document route.
  if (segments[0] === 'tags') return {kind: 'skip'};
  const versions = allVersions();
  if (versions.includes(segments[0])) {
    const slug = normaliseSlug(segments.slice(1).join('/'));
    return slug ? {kind: 'docs', slug, version: segments[0], official, locale} : {kind: 'skip'};
  }
  const slug = normaliseSlug(segments.join('/'));
  return slug ? {kind: 'docs', slug, version: null, official, locale} : {kind: 'skip'};
}

/**
 * Where one link should point, or `null` when it is already fine.
 *
 * `context` carries the page's release (`table`), the overlay directory that
 * decides whether a relative link can resolve, and the page's own path inside
 * the release.
 */
function resolveTarget(target, context) {
  const {table, section, fromFile, suffix, preferExplicitVersion = false} = context;

  // A page only the current release publishes has exactly one copy in the whole
  // site (`config/mirror.yml: sync.current_only_pages`). An archive must link to
  // that copy, not to `/docs/<version>/<slug>`: the archive does not carry the
  // page, and the official site's sidebar entry does the same thing. Inside the
  // current release the normal rules apply, so the link can stay relative.
  if (table.version !== currentVersion() && isCurrentOnlyPage(target.slug)) {
    const currentTable = routeTable(currentVersion());
    const entry = currentTable.entries.get(target.slug) ?? null;
    return {href: `${currentTable.base}/${target.slug}${suffix}`, entry, currentOnly: true};
  }

  if (target.official) {
    // Rule 1: an official URL is only mirrored when this release has the page.
    if (!table.entries.has(target.slug)) return {keep: true};
  }

  // A raw HTML href spells its release on purpose; rewriting it onto the local
  // release would silently move a deliberate cross-release link.
  if (preferExplicitVersion && target.version && target.version !== table.version) {
    const named = routeTable(target.version);
    const entry = named.entries.get(target.slug);
    if (entry) return {href: `${named.base}/${entry.slug}${suffix}`, entry};
  }

  const own = table.entries.get(target.slug);
  if (own) {
    const overlay = path.join(REPO, section.overlay, own.file ?? '');
    // Only a docs section shares a content tree with its target, so only there
    // can a relative Markdown link resolve; the blog, changelog and hardware
    // plugins resolve against their own trees.
    if (context.canBeRelative && own.file && fromFile && fs.existsSync(overlay)) {
      return {href: `${relativeDocLink(fromFile, own.file)}${suffix}`, entry: own};
    }
    return {href: `${table.base}/${own.slug}${suffix}`, entry: own};
  }

  // Not in this release. Point at the release the URL named, if it has the page;
  // otherwise keep the release's own route base so the reader stays in it.
  if (target.version && target.version !== table.version) {
    const other = routeTable(target.version);
    if (other.entries.has(target.slug)) {
      return {href: `${other.base}/${target.slug}${suffix}`, entry: other.entries.get(target.slug)};
    }
  }
  const base = target.version ? routeBase(target.version) : table.base;
  return {href: `${base}/${target.slug}${suffix}`, entry: null, missing: true};
}

/**
 * Normalise a relative, non-Markdown link such as `../../management-tools/cmr`.
 *
 * Upstream pages are often authored as `<slug>/index.md`, so their relative
 * links count the page itself as a directory. The mirror flattens that page to
 * `<slug>.md`; resolving the authored path against the file's own directory
 * would then point one level too high (`/management-tools/cmr` instead of
 * `/docs/management-tools/cmr`, and `/zh-Hans/...` in the Chinese build).
 * Resolve against both readings and keep the one that names a real route, then
 * emit the canonical relative `.md` link relative to the real file.
 */
function rewriteRelativeMarkdownLink(whole, text, url, context) {
  const {table, section, fromFile} = context;
  if (!fromFile) return whole;
  const {pathPart, suffix} = splitSuffix(url);
  if (!pathPart || SCHEME.test(pathPart) || ASSET.test(pathPart)) return whole;
  // Already the canonical form: `mdx-loader` retargets it through the route map.
  if (/\.mdx?$/i.test(pathPart)) return whole;
  const page = normaliseSlug(fromFile);
  if (!page) return whole;
  const asDirectory = `/${page}`;
  const asFile = path.posix.dirname(`/${page}`);
  const bases = fromFile.endsWith('/index.md') ? [asDirectory, asFile] : [asFile, asDirectory];
  let entry = null;
  for (const base of bases) {
    const candidate = normaliseSlug(path.posix.join(base, pathPart));
    entry = candidate ? table.entries.get(candidate) : null;
    if (entry) break;
  }
  if (!entry || !entry.file) return whole;
  if (context.canBeRelative && fs.existsSync(path.join(REPO, section.overlay, entry.file))) {
    return `[${rewriteLinkText(text, entry, context)}](${relativeDocLink(fromFile, entry.file)}${suffix})`;
  }
  return `[${rewriteLinkText(text, entry, context)}](${table.base}/${entry.slug}${suffix})`;
}

function rewriteMarkdownLink(whole, bang, text, url, context) {
  if (bang) return whole;
  // An official PDF link points at a file `sync-pdfs` already cached under
  // `static/`, which the site serves from `/assets/files/`. Rewriting it keeps
  // the reader on the mirror; a link whose file was never downloaded keeps the
  // official URL and is reported as unresolved by the caller. The result is an
  // anchor, not a Markdown link: `mdx-loader` would turn the latter into a
  // `require()` and re-hash the already hashed file name (see `pdf-links.mjs`).
  const pdf = resolvePdfAsset(url);
  if (pdf) {
    if (pdf.missing) {
      if (context.stats) context.stats.unresolvedAssets = (context.stats.unresolvedAssets || 0) + 1;
      return whole;
    }
    if (context.stats) context.stats.pdfAssets = (context.stats.pdfAssets || 0) + 1;
    return pdfAnchor(pdf.path, text);
  }
  // Relative links are the desired end state, but only when they end in `.md`;
  // a bare relative route still has to be normalised (see above).
  if (!url.startsWith('/') && !OFFICIAL_HOST.test(url)) {
    const {pathPart} = splitSuffix(url);
    // Already canonical (`./page.md`): the href needs no work, but the visible
    // text may still be the target page's English title.
    if (/^\.[^?#]*\.mdx?$/i.test(pathPart)) return rewriteCanonicalLink(whole, text, pathPart, context);
    return rewriteRelativeMarkdownLink(whole, text, url, context);
  }
  const {pathPart, suffix} = splitSuffix(url);
  const target = parseTarget(pathPart);
  if (target.kind !== 'docs') return whole;
  const resolved = resolveTarget(target, {...context, suffix});
  if (!resolved || resolved.keep) return whole;
  const label = rewriteLinkText(text, resolved.entry, context);
  return `[${label}](${resolved.href})`;
}

/** The route entry a canonical relative `.md` link points at, if any. */
function entryForRelativeLink(pathPart, context) {
  if (!context.fromFile) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(context.fromFile), pathPart));
  if (!resolved || resolved.startsWith('..')) return null;
  const slug = normaliseSlug(resolved);
  return slug ? context.table.entries.get(slug) ?? null : null;
}

/**
 * Rewrite only the text of an already-relative `.md` link.
 *
 * The link text was copied from the English page even when the href was
 * already canonical, which is how a Chinese page ends up with an English label
 * pointing at a translated title. Keep the URL bytes and replace the label;
 * `whole` is `[text](url ...)`, so only the bracket part is rebuilt.
 */
function rewriteCanonicalLink(whole, text, pathPart, context) {
  const entry = entryForRelativeLink(pathPart, context);
  const label = rewriteLinkText(text, entry, context);
  if (label === text) return whole;
  return `[${label}]${whole.slice(2 + text.length)}`;
}

/**
 * The Chinese title to use for a link, or the text unchanged.
 *
 * Only a text that *is* the target page's English title is retranslated: free
 * prose that merely mentions the page must keep the author's wording. The
 * comparison ignores case, emphasis, whitespace, punctuation and a leading
 * article, because the English source itself is inconsistent there
 * (`Configuring a standalone access point` links to a page titled
 * `Configuring standalone access point`). A lowercase ASCII identifier
 * (`tmpfs`, `poe-out`) is a term, not a title, and keeps its spelling.
 */
function rewriteLinkText(text, entry, context) {
  if (!entry || !context.titleFor) return text;
  const {english, chinese} = context.titleFor(entry) || {};
  if (!chinese) return text;
  if (classifyLinkText(text, english) === 'failed') {
    if (context.stats) context.stats.linkText = (context.stats.linkText || 0) + 1;
    return chinese;
  }
  // A label that is prose wrapped around the page name ("Working with Static DNS"
  // pointing at "Static DNS") is below the similarity threshold, so the check
  // above declines it. Only the run the title names is rewritten, so the rest of
  // the author's sentence survives.
  const partial = containLinkText(text, english, chinese);
  if (!partial || partial === text) return text;
  if (context.stats) context.stats.linkTextPartial = (context.stats.linkTextPartial || 0) + 1;
  return partial;
}

/**
 * Rewrite only the part of a link text that the target page's title names.
 *
 * `… with WiFi CAPsMAN` pointing at a page titled `WiFi CAPsMAN` is the same
 * defect as an untranslated label, but the whole text is not the title: the
 * similarity check refuses it (the extra prose drags the overlap down) and
 * replacing the whole label would delete the author's words. So the title's
 * tokens are located as one contiguous run inside the text and only that run
 * becomes the Chinese title.
 *
 * Conservative on purpose: the run must be a *proper* part of the text (a text
 * that is exactly the title is the caller's job), the title must carry at least
 * two words, and a Chinese title is required. Anything else returns null and the
 * label is left alone (`tolerated`), because a partial rewrite that guesses is
 * worse than an English label.
 */
export function containLinkText(text, englishTitle, chineseTitle) {
  if (!text || !englishTitle || !chineseTitle) return null;
  if (!CJK.test(chineseTitle)) return null;
  if (CJK.test(text)) return null;
  const words = String(text).trim().split(/\s+/);
  // Fold word by word but keep the word each folded token came from: a title
  // token has to map back to the exact slice of text it replaces. Dropping an
  // article ("the") therefore leaves a hole instead of shifting the indices.
  const folded = [];
  const origin = [];
  words.forEach((word, index) => {
    for (const token of normaliseTitle(word).split(' ').filter(Boolean)) {
      folded.push(token);
      origin.push(index);
    }
  });
  const wanted = normaliseTitle(englishTitle).split(' ').filter(Boolean);
  if (wanted.length < 2 || folded.length <= wanted.length) return null;
  for (let start = 0; start + wanted.length <= folded.length; start++) {
    if (!wanted.every((token, index) => folded[start + index] === token)) continue;
    const from = origin[start];
    const to = origin[start + wanted.length - 1];
    const before = words.slice(0, from).join(' ');
    const after = words.slice(to + 1).join(' ');
    return [before, chineseTitle, after].filter(Boolean).join(' ');
  }
  return null;
}

const IDENTIFIER_TEXT = /^[a-z0-9][a-z0-9._-]*$/;

/** A lowercase ASCII token that names a thing, not a phrase: `tmpfs`, `nvme`. */
export function isIdentifierText(text) {
  return IDENTIFIER_TEXT.test(String(text ?? '').trim());
}

/**
 * Fold a link text or page title down to what a reader would call the same
 * words: no Markdown emphasis, no case, no dash/space/punctuation differences
 * and no filler article.
 */
export function normaliseTitle(text) {
  return String(text ?? '')
    .replace(/[*_`~]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\p{L}\p{N}+#./\s-]/gu, ' ')
    .replace(/-/g, ' ')
    .replace(/\b(?:a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Similarity a link text needs before it counts as naming the target page.
 *
 * `config/translation.yml: link_text_similarity`. The default keeps the check
 * forgiving enough for the English source's own drift ("Quick start" linking to
 * "Quick Start guide") while a one-word coincidence stays below it.
 */
export function linkTextSimilarity() {
  const configured = Number(translationConfig()?.link_text_similarity ?? NaN);
  return Number.isFinite(configured) && configured > 0 && configured <= 1 ? configured : 0.6;
}

let translationCache = null;

/** `config/translation.yml`, read once: the link policy lives there too. */
export function translationConfig() {
  if (translationCache === null) {
    const file = path.join(REPO, 'config/translation.yml');
    translationCache = fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) || {} : {};
  }
  return translationCache;
}

let similarityCache = null;

/** The configured threshold, read once per process. */
function similarityThreshold() {
  if (similarityCache === null) similarityCache = linkTextSimilarity();
  return similarityCache;
}

/** Words of a title or link text, after `normaliseTitle` folding. */
function tokens(text) {
  return normaliseTitle(text).split(' ').filter(Boolean);
}

/**
 * Sørensen-Dice overlap of two word sets: `2|A∩B| / (|A|+|B|)`.
 *
 * Set-based on purpose: a repeated word ("Wireless wireless setup") must not
 * inflate the score, and word order is not something a reader uses to decide
 * whether two labels name the same page.
 */
export function titleSimilarity(a, b) {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return (2 * shared) / (left.size + right.size);
}

/**
 * Prose, not an identifier: a link text written as English sentence words.
 *
 * `tmpfs`, `poe-out`, `nvme` and `interface/wifi` are names of things; a label
 * that starts lowercase and contains no separator is a term even when it shares
 * words with the page title, so only a text with an uppercase word (or two or
 * more words) may be re-labelled from the title.
 */
export function isEnglishProse(text) {
  const value = String(text ?? '').trim();
  if (!value || CJK.test(value)) return false;
  if (isIdentifierText(value)) return false;
  return /[A-Z]/.test(value) || tokens(value).length > 1;
}

/**
 * Is this link text the English title of the target page?
 *
 * `'failed'` means the text names that page (exactly, or closely enough to be
 * the same words) and the overlay already has a Chinese title, so the label
 * could and should have been translated; `'tolerated'` means the same but the
 * text is a technical identifier or a glossary term; `null` means the text is
 * something else (free prose, an already translated label, ...).
 *
 * Shared with `tools/verify/links.mjs` so the check and the rewrite cannot
 * drift apart.
 */
export function classifyLinkText(text, englishTitle) {
  if (!text || !String(text).trim() || !englishTitle) return null;
  if (CJK.test(text)) return null;
  const exact = normaliseTitle(text) === normaliseTitle(englishTitle);
  // Free prose that merely mentions the page keeps the author's wording: only a
  // label that is the title, or is close enough to read as the same words, is
  // re-labelled.
  if (!exact && !(isEnglishProse(text) && titleSimilarity(text, englishTitle) >= similarityThreshold())) {
    return null;
  }
  // A glossary term is a name, not a page title to translate: `Back To Home`
  // stays `Back To Home` on purpose (only its first mention is annotated), so a
  // link that uses the term must not be "corrected" into the annotated title.
  if (isGlossarySource(text)) return 'tolerated';
  return isIdentifierText(text) ? 'tolerated' : 'failed';
}

/** True when the text is exactly a glossary source term. */
export function isGlossarySource(text) {
  const wanted = String(text ?? '').trim().toLowerCase();
  if (!wanted) return false;
  return glossaryTerms().some(
    (term) => term && String(term.source).trim().toLowerCase() === wanted,
  );
}

/**
 * Rewrite the links of one translated body.
 *
 * Signature note: the second argument used to be `stripVersion` (a release
 * number), and `apply`/`derive` still call it that way in older code paths. A
 * string or `null` therefore takes the legacy route, which only removed the
 * capture's own `/docs/<v>/` prefix.
 */
export function rewriteLinks(text, options = {}) {
  if (options === null || options === undefined || typeof options === 'string') {
    return legacyRewrite(text, options);
  }
  const {section, fromFile = '', titleFor = null, stats = null} = options;
  if (!section) return String(text);
  // A section that is not versioned (hardware, blog, changelog) still links into
  // the docs; those links belong to the current release. Its own tree is a
  // different plugin, so the link can only be absolute.
  const version = options.version || currentVersion();
  const table = routeTable(version);
  if (table.entries.size === 0) return String(text);
  const locale = sectionLocale(section);
  const context = {
    version,
    base: table.base,
    table,
    section,
    fromFile,
    titleFor,
    canBeRelative: Boolean(options.version),
    // Raw HTML hrefs bypass the locale router, so they have to spell it out.
    localePrefix: locale ? `/${locale}` : '',
    // Optional counters for a reporting caller (`normalize-links --check`).
    stats,
  };

  const out = [];
  for (const span of segmentSpans(String(text))) {
    if (span.part.kind === 'sep' || span.code) {
      out.push(span.part.value);
      continue;
    }
    let segment = span.part.value.replace(MARKDOWN_LINK, (whole, bang, label, url) =>
      rewriteMarkdownLink(whole, bang, label, url, context),
    );
    // Inline HTML anchors are rendered verbatim: MDX never runs them through the
    // Markdown-link resolver, so the href must carry the locale and the release
    // itself. A target that does not resolve in any mirrored release keeps the
    // bytes it had - inventing a locale for a dead route would hide it.
    segment = segment.replace(HTML_HREF, (whole, open, url, close) => {
      if (!url.startsWith('/') && !OFFICIAL_HOST.test(url)) return whole;
      // An `<a href>` to a cached attachment is served from the site root, so it
      // needs no locale prefix and no Markdown resolver.
      const pdf = resolvePdfAsset(url);
      if (pdf) {
        if (pdf.missing) {
          if (context.stats) context.stats.unresolvedAssets = (context.stats.unresolvedAssets || 0) + 1;
          return whole;
        }
        if (context.stats) context.stats.pdfAssets = (context.stats.pdfAssets || 0) + 1;
        return `${open}${pdf.path}${close}`;
      }
      const {pathPart, suffix} = splitSuffix(url);
      const target = parseTarget(pathPart);
      if (target.kind !== 'docs') return whole;
      const resolved = resolveTarget(target, {...context, suffix, canBeRelative: false, preferExplicitVersion: true});
      if (!resolved || resolved.keep || !resolved.entry) return whole;
      return `${open}${context.localePrefix}${resolved.href}${close}`;
    });
    out.push(segment);
  }
  return out.join('');
}

/** The pre-2026 behaviour, kept so an old caller cannot crash. */
function legacyRewrite(body, stripVersion) {
  if (!stripVersion) return body;
  const prefix = `/docs/${stripVersion}/`;
  return String(body).split(`](${prefix}`).join('](/docs/');
}

/**
 * Every link of a body, outside fenced code, in document order.
 *
 * Used by `tools/verify/links.mjs`, which must judge exactly the links this
 * module would rewrite.
 */
export function extractLinks(text) {
  const links = [];
  for (const span of segmentSpans(String(text))) {
    if (span.part.kind === 'sep' || span.code) continue;
    const value = span.part.value;
    for (const match of value.matchAll(MARKDOWN_LINK)) {
      const [, bang, label, url] = match;
      links.push({kind: bang ? 'image' : 'markdown', text: label, url});
    }
    // An anchor carries a visible label just like a Markdown link, so the title
    // check has to see it; a stray `href` outside `<a>...</a>` only has the URL.
    const covered = [];
    for (const match of value.matchAll(anchorPattern())) {
      const href = anchorHref(parseAnchorAttributes(match[1]));
      if (!href) continue;
      covered.push([match.index, match.index + match[0].length]);
      links.push({kind: 'html', text: anchorLabel(match[2]), url: href});
    }
    for (const match of value.matchAll(HTML_HREF)) {
      if (covered.some(([start, end]) => match.index >= start && match.index < end)) continue;
      links.push({kind: 'html', text: '', url: match[2]});
    }
  }
  return links;
}
