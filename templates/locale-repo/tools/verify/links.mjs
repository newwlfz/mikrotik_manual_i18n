#!/usr/bin/env node
/**
 * Link and title checks for the Chinese overlays.
 *
 * The overlays used to carry three kinds of link defect that nothing reported:
 *
 *   1. an internal link written as an absolute path with the capture's `.md`
 *      suffix ("[/docs/x.md](/docs/x.md)"): that names a file, not a route, and
 *      Docusaurus ships it as a literal path;
 *   2. a bare `/docs/<slug>` URL on an archived page, which silently points at
 *      the current release in the default locale;
 *   3. a link to the official site for a page the mirror already carries.
 *
 * Split-repository single-language layout changed the link semantics. Each
 * locale repo owns its own baseUrl and Docusaurus prepends it to a root-absolute
 * `/docs/<slug>` route at build time, so an absolute link that resolves to a
 * real route is valid - it is the form the English mirror and the official
 * pages use. Relative `.md` links remain the pipeline's canonical rewrite, but
 * the suffix is a style choice, not a functional gate (see
 * `tools/translate/lib/links.mjs`). What is still broken is a *relative* route
 * that escapes its content plugin: the browser resolves it from the page URL
 * and the built href loses the `/docs` prefix (a 404). The formerly failing
 * "could have been relative" and in-plugin relative-route buckets are kept as
 * informational counts (`shouldBeRelative`, `relativeRouteOk`) so the numbers
 * stay watchable; only the escaping relative routes fail as `relativeNonMd`.
 *
 * The title check rides along because it is the same class of bug, but a page
 * `title` that is still English is not one by itself: the title is not a link
 * text. The defect is a link whose visible text names the target page in
 * English while that page already has a Chinese title - the reader sees an
 * English label pointing at a Chinese page. Those are `failedTitle`. "Names the
 * page" is `classifyLinkText`: the exact English title, or a text similar enough
 * to it (`link_text_similarity` in `config/translation.yml`, word-set overlap)
 * to be the same words - "Quick start" pointing at "Quick Start guide" is the
 * same defect as an exact copy. An English page title with nothing to click, a
 * lowercase ASCII identifier (`tmpfs`, `poe-out`) and a glossary term are
 * counted as `toleratedTitle`.
 *
 * A raw `<a href="/docs/...">` is the other form of the same bypass: MDX renders
 * it verbatim and the Markdown-link resolver never sees it. On a split-repository
 * site the source route must be the bare `/docs/...` form: the build prepends the
 * site's base URL and the locale router adds `/<locale>` at runtime. An anchor
 * carrying a locale segment is the legacy single-repo-multilingual spelling and
 * ships as `/<repo>/<locale>/docs/...`, so it is now the defect (`htmlNoLocale`;
 * the bucket name is kept for continuity, the judgement is swapped); a bare
 * `/docs/...` anchor is `absoluteHtml`. The built HTML is asserted at the end of
 * this check so a stale build cannot hide behind a green source tree.
 */

import fs from 'node:fs';
import path from 'node:path';

import {SECTIONS, REPO, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {LOCALES_FILE, normalizeBaseUrl, resolveBaseUrl, resolveLocales} from '../lib/site-config.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {
  classifyLinkText,
  extractLinks,
  normaliseSlug,
  parseTarget,
  routeTable,
  sectionVersion,
  splitSuffix,
} from '../translate/lib/links.mjs';
import {currentVersion} from '../sync/lib/versions.mjs';

const CJK = /[\u4e00-\u9fff]/;
/** `pathname://`, `mailto:`, `tel:`, ... are explicit "do not touch" markers. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** A relative link to a file is an asset, not a route. */
const ASSET = /\.(?:png|jpe?g|webp|gif|svg|pdf|txt|zip|gz|rsc|json|csv|npk|pcap|bin|mp4|webm|iso|img)$/i;
/**
 * A version root (`/docs#x` or `/docs/<v>#x`) names no document: the fragment
 * belongs to the page carrying the link. `parseTarget` correctly calls it
 * `skip`, so it used to be silently counted as a harmless absolute link. It is
 * the exact shape the materialize self-link bug emitted, so it now fails.
 */
const VERSION_ROOT_RE = /^\/docs(?:\/[0-9][0-9.]*)?$/;

/**
 * A locale tag written as a path segment inside a relative overlay link.
 * Built from the site's locale registry, so a newly added locale is recognised
 * without touching this tool; matches repeated prefixes as well as single ones.
 * No `g` flag: `.test()` below must be stateless across files.
 */
const LOCALE_IN_PATH_RE = (() => {
  let alternatives = '';
  try {
    const {locales, defaultLocale} = resolveLocales();
    alternatives = locales
      .filter((locale) => locale !== defaultLocale && !/\{\{|\}\}/.test(locale))
      .map((locale) => locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
  } catch {
    /* locale registry unavailable: fall through to the generic tag shape */
  }
  // `resolved.file` is a relative path: the locale segment may be the first
  // segment (no leading slash), so anchor on either start-of-string or `/`.
  return new RegExp(
    `(?:^|/)(?:${alternatives || '[a-z]{2,3}(?:-[A-Za-z]{2,8})*'})(?:/|$)`,
    '',
  );
})();

const failures = [];
const details = {};
/** Per-section sample lists, keyed by kind; used for the summary at the end. */
const sectionSamples = new Map();

/** Per-kind sample count; a full list is one env var away. */
const SAMPLE_LIMIT = Number(process.env.VERIFY_LINKS_SAMPLES || 3);

/**
 * Does the English source page carry a link to the same dead route?
 *
 * An absolute `/docs/...` link in the overlay is often copied verbatim from the
 * English page (the export kept it, or the translation reused the block). When
 * that page is just as dead upstream, the mirror did not break it and it must
 * not count as a failure: `deadRoute` is split into `upstreamDead` (inherited)
 * and `myDead` (introduced here). Relative `.md` links are resolved from the
 * source page before the comparison.
 */
function sourceHasTarget(file, rel, target) {
  if (!fs.existsSync(file)) return false;
  for (const link of extractLinks(fs.readFileSync(file, 'utf8'))) {
    if (link.kind === 'image') continue;
    const {pathPart} = splitSuffix(link.url);
    if (!pathPart) continue;
    let slug = null;
    if (pathPart.startsWith('/')) {
      const parsed = parseTarget(pathPart);
      if (parsed.kind === 'docs') slug = parsed.slug;
    } else if (/\.mdx?$/i.test(pathPart)) {
      const resolved = path.posix
        .normalize(path.posix.join(path.posix.dirname(rel), pathPart))
        .replace(/^\.\//, '');
      if (!resolved.startsWith('../')) slug = normaliseSlug(resolved);
    }
    if (slug === target.slug) return true;
  }
  return false;
}

/** A relative link, resolved from the page that carries it. */
function resolveRelative(rel, url) {
  const {pathPart} = splitSuffix(url);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), pathPart)).replace(/^\.\//, '');
  const outside = resolved.startsWith('../');
  if (!/\.mdx?$/i.test(pathPart)) return {notMarkdown: true, outside, file: resolved};
  if (outside) return {outside: true};
  return {file: resolved, slug: normaliseSlug(resolved)};
}

/** Front-matter titles, read once per file. */
const titleCache = new Map();
function frontMatterTitle(file) {
  if (titleCache.has(file)) return titleCache.get(file);
  const value = fs.existsSync(file)
    ? readField(splitFrontMatter(fs.readFileSync(file, 'utf8')).frontMatter, 'title')
    : null;
  titleCache.set(file, value);
  return value;
}

/**
 * Is this link's visible text the English title of a page that is translated?
 *
 * That is the only title defect worth failing on: the target has a Chinese
 * `title`, so the English label could and should have been translated. A link
 * to a page that has no Chinese title yet is tolerated - there is nothing to
 * point the text at. The comparison is `normalize-links`' own
 * (`classifyLinkText`): case, whitespace, punctuation and a leading article do
 * not count, so the check and the rewrite can never disagree.
 *
 * Returns `'failed'` for a defect, `'tolerated'` for a lowercase ASCII
 * identifier that matches the English title, and `null` otherwise.
 */
function linkTitleIsUntranslated(section, version, rel, link) {
  if (link.kind === 'image' || !link.text || !link.text.trim()) return null;
  const {pathPart} = splitSuffix(link.url);
  if (!pathPart) return null;
  let slug = null;
  let targetSection = section;
  let targetVersion = version;
  if (!pathPart.startsWith('/')) {
    if (!/\.mdx?$/i.test(pathPart)) return null;
    const resolved = path.posix
      .normalize(path.posix.join(path.posix.dirname(rel), pathPart))
      .replace(/^\.\//, '');
    if (resolved.startsWith('../')) return null;
    slug = normaliseSlug(resolved);
  } else {
    if (SCHEME.test(pathPart)) return null;
    const target = parseTarget(pathPart);
    if (target.kind !== 'docs') return null;
    slug = target.slug;
    // A link into another release resolves inside the release it names.
    if (target.version && target.version !== version) {
      targetSection = SECTIONS.find((item) => item.name === `docs-${target.version}`) || section;
      targetVersion = target.version;
    }
  }
  const entry = routeTable(targetVersion || currentVersion()).entries.get(slug);
  if (!entry?.file) return null;
  const english = frontMatterTitle(path.join(REPO, targetSection.source, entry.file));
  const chinese = frontMatterTitle(path.join(REPO, targetSection.overlay, entry.file));
  if (!english || !chinese || !CJK.test(chinese)) return null;
  return classifyLinkText(link.text, english);
}

for (const section of SECTIONS) {
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) continue;
  const sourceBase = path.join(REPO, section.source);
  const version = sectionVersion(section.name);
  // A non-versioned section (hardware, blog, changelog) still links into the
  // docs; those links belong to the current release.
  const table = routeTable(version || currentVersion());
  const counts = {
    files: 0,
    relative: 0,
    relativeNonMd: 0,
    relativeRouteOk: 0,
    absolute: 0,
    external: 0,
    official: 0,
    mdSuffixAbsolute: 0,
    deadRoute: 0,
    myDead: 0,
    upstreamDead: 0,
    absoluteHtml: 0,
    htmlNoLocale: 0,
    crossVersion: 0,
    versionRootAnchor: 0,
    officialInternal: 0,
    overlayMissing: 0,
    localeInRelative: 0,
    shouldBeRelative: 0,
    failedTitle: 0,
    toleratedTitle: 0,
  };
  // Three examples per kind: enough to see what a bucket holds without burying
  // the summary in thousands of identical lines.
  const samples = new Map();
  const note = (kind, where, link) => {
    const list = samples.get(kind) || [];
    if (list.length < SAMPLE_LIMIT) list.push(`${where} -> ${link}`);
    samples.set(kind, list);
  };

  for (const file of walkMarkdown(overlayBase)) {
    counts.files++;
    const rel = relative(overlayBase, file);
    const text = fs.readFileSync(file, 'utf8');

    for (const link of extractLinks(text)) {
      if (link.kind === 'image') continue;
      const titleState = linkTitleIsUntranslated(section, version, rel, link);
      if (titleState === 'tolerated') {
        counts.toleratedTitle++;
      } else if (titleState === 'failed') {
        counts.failedTitle++;
        note('failed-title', `${section.name}/${rel}`, `${JSON.stringify(link.text.trim())} -> ${link.url}`);
      }
      const {pathPart, suffix} = splitSuffix(link.url);
      if (!pathPart) continue;
      if (SCHEME.test(pathPart)) continue;

      if (!pathPart.startsWith('/')) {
        // Relative: the desired form for a docs page, but it has to point at a
        // file this locale really has.
        if (ASSET.test(pathPart)) {
          counts.external++;
          continue;
        }
        const resolved = resolveRelative(rel, link.url);
        if (resolved.notMarkdown) {
          // A relative route without `.md` is only broken when it escapes its
          // own content plugin: the browser resolves `../` from the page URL
          // and the built href loses the `/docs` prefix (a 404). The legacy
          // single-repo locale resolver made every such link look broken; on a
          // split-repo single-language site an in-plugin relative route (e.g.
          // a hardware page's `../docs/tags/netinstall`) resolves correctly and
          // the `.md` suffix is just the pipeline's preferred spelling.
          if (resolved.outside) {
            counts.relativeNonMd++;
            note('relative-non-md', `${section.name}/${rel}`, link.url);
          } else {
            counts.relativeRouteOk++;
          }
          continue;
        }
        counts.relative++;
        if (resolved.outside) {
          counts.deadRoute++;
          note('outside-section', `${section.name}/${rel}`, link.url);
          continue;
        }
        if (LOCALE_IN_PATH_RE.test(resolved.file)) {
          // The locale is added by the docs plugin; spelling it here produces
          // `/<locale>/<locale>/...` in any translation locale.
          counts.localeInRelative++;
          note('locale-in-relative', `${section.name}/${rel}`, link.url);
        }
        if (fs.existsSync(path.join(overlayBase, resolved.file))) continue;
        // No overlay for the target: the Chinese build reports a broken
        // Markdown link, so the link must have stayed absolute.
        counts.overlayMissing++;
        note('overlay-missing', `${section.name}/${rel}`, link.url);
        continue;
      }

      const target = parseTarget(pathPart);
      if (VERSION_ROOT_RE.test(pathPart) && suffix.includes('#')) {
        // A fragment pinned to the version root is never a valid document link:
        // the heading lives on the page that carries it. Count it as a defect
        // (no whitelist) so a regression cannot hide in `absolute`.
        counts.versionRootAnchor++;
        note('version-root-anchor', `${section.name}/${rel}`, link.url);
        continue;
      }
      if (target.kind !== 'docs') {
        if (/^https?:/i.test(pathPart)) counts.external++;
        else counts.absolute++;
        continue;
      }
      if (target.official) counts.official++;
      if (/\.mdx?$/i.test(pathPart)) {
        counts.mdSuffixAbsolute++;
        note('md-suffix-absolute', `${section.name}/${rel}`, link.url);
        continue;
      }
      const entry = table.entries.get(target.slug);
      if (!entry) {
        const other = target.version && target.version !== table.version ? routeTable(target.version) : null;
        if (other?.entries.has(target.slug)) {
          // A deliberate link into another release: it resolves, but it leaves
          // this version, so it is reported without being an error on its own.
          counts.crossVersion++;
          continue;
        }
        counts.deadRoute++;
        // Same route missing on the English page: inherited, not our defect.
        if (sourceHasTarget(path.join(sourceBase, rel), rel, target)) {
          counts.upstreamDead++;
          note('upstream-dead', `${section.name}/${rel}`, link.url);
        } else {
          counts.myDead++;
          note('my-dead', `${section.name}/${rel}`, link.url);
        }
        continue;
      }
      if (target.official) {
        counts.officialInternal++;
        note('official-internal', `${section.name}/${rel}`, link.url);
        continue;
      }
      const overlay = path.join(overlayBase, entry.file || '');
      if (version && entry.file && fs.existsSync(overlay)) {
        // A raw `<a href>` renders verbatim, so only an absolute URL works there.
        // On a split-repository site it must be the bare `/docs/...` route: the
        // build prepends the base URL and no locale prefix is added. A locale
        // segment is the legacy single-repo spelling and ships as a defect
        // (`htmlNoLocale`, name kept for continuity).
        if (link.kind === 'html') {
          if (target.locale) {
            counts.htmlNoLocale++;
            note('html-no-locale', `${section.name}/${rel}`, link.url);
          } else {
            counts.absoluteHtml++;
            note('absolute-html', `${section.name}/${rel}`, link.url);
          }
        } else {
          // A resolved absolute `/docs/...` Markdown link is valid in the
          // split-repo layout: baseUrl is prepended at build time and the
          // target route has a translated overlay. The old "could have been
          // relative" rule belonged to the single-repo locale resolver, where
          // an unprefixed route silently pointed at the default locale; that
          // resolver no longer exists. Keep the count for visibility only.
          counts.shouldBeRelative++;
          note('should-be-relative', `${section.name}/${rel}`, link.url);
        }
      } else {
        counts.absolute++;
      }
    }

    if (!version) continue;
    // Title: an overlay title that is still the English one is not translated.
    const sourceFile = path.join(sourceBase, rel);
    if (!fs.existsSync(sourceFile)) continue;
    const english = readField(splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter, 'title');
    const chinese = readField(splitFrontMatter(text).frontMatter, 'title');
    if (!english || !chinese) continue;
    if (chinese.trim() !== english.trim()) continue;
    if (CJK.test(chinese)) continue;
    // The title is not clickable: it is reported, but it is not the defect the
    // link-text check above fails on.
    counts.toleratedTitle++;
  }

  details[section.name] = counts;
  sectionSamples.set(section.name, samples);
  for (const [kind, list] of samples) {
    for (const sample of list) console.log(`  ${kind}: ${sample}`);
  }
}

/** Defects the rebuild is expected to clear. */
const defectKinds = [
  'relativeNonMd',
  'htmlNoLocale',
  'mdSuffixAbsolute',
  'versionRootAnchor',
  'myDead',
  'officialInternal',
  'overlayMissing',
  'localeInRelative',
  // `shouldBeRelative` is intentionally not a defect: in split-repo
  // single-language builds an absolute /docs/<slug> link that resolves to a
  // translated route is valid (baseUrl is prepended at build time). Kept in
  // each section's counts so the number remains watchable.
];

const totals = {
  defects: 0,
  absolute: 0,
  crossVersion: 0,
  versionRootAnchor: 0,
  failedTitle: 0,
  myDead: 0,
  upstreamDead: 0,
  absoluteHtml: 0,
  htmlNoLocale: 0,
  toleratedTitle: 0,
};
for (const [name, counts] of Object.entries(details)) {
  const broken = defectKinds.reduce((sum, kind) => sum + counts[kind], 0);
  totals.defects += broken;
  totals.absolute += counts.absolute;
  totals.crossVersion += counts.crossVersion;
  totals.versionRootAnchor += counts.versionRootAnchor;
  totals.failedTitle += counts.failedTitle;
  totals.myDead += counts.myDead;
  totals.upstreamDead += counts.upstreamDead;
  totals.absoluteHtml += counts.absoluteHtml;
  totals.htmlNoLocale += counts.htmlNoLocale;
  totals.toleratedTitle += counts.toleratedTitle;
  console.log(`  ${broken ? 'FAIL' : 'ok  '} ${name}: ${JSON.stringify(counts)}`);
  if (broken) failures.push(`${name}: ${broken} link defect(s)`);
  if (counts.failedTitle) failures.push(`${name}: ${counts.failedTitle} link text(s) still the English title`);
}

// TOTAL stays within the last few lines on purpose: it is the number a reader
// checks first, and the failed-title examples below it are the rest.
if (failures.length) for (const line of failures) console.log(`FAIL ${line}`);
console.log(`TOTAL ${JSON.stringify(totals)}`);
if (totals.failedTitle) {
  const examples = [];
  for (const [name, counts] of Object.entries(details)) {
    if (!counts.failedTitle) continue;
    for (const line of sectionSamples.get(name)?.get('failed-title') || []) examples.push(`${name}: ${line}`);
  }
  console.log(`failedTitle=${totals.failedTitle} (English link text pointing at a Chinese title); examples:`);
  // One example per section first, so the tail shows all three releases.
  const picked = [];
  for (const name of Object.keys(details)) {
    const line = sectionSamples.get(name)?.get('failed-title')?.[0];
    if (line && picked.length < SAMPLE_LIMIT) picked.push(`${name}: ${line}`);
  }
  for (const example of examples) {
    if (picked.length >= SAMPLE_LIMIT) break;
    if (!picked.includes(example)) picked.push(example);
  }
  for (const example of picked) console.log(`  ${example}`);
}

// Build-product form of the same assertion. The overlay check above catches the
// source; this one reads the shipped HTML so a stale build (or a build-time
// rewrite that reintroduced the prefix) cannot hide behind a green source tree.
// Repo prefixes come from every registered base URL, not just the currently
// resolved one, so the check works without BASE_URL/SITE_LOCALE in the environment.
// Skipped when the repository has no build directory.
const BUILD_DIR = path.join(REPO, 'build');
if (fs.existsSync(BUILD_DIR)) {
  const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const repos = new Set();
  try {
    const registry = JSON.parse(fs.readFileSync(LOCALES_FILE, 'utf8'));
    for (const entry of Object.values(registry.locales || {})) {
      const repo = normalizeBaseUrl(entry?.baseUrl).replace(/^\/+|\/+$/g, '');
      if (repo) repos.add(repo);
    }
  } catch {
    /* no registry: fall back to the currently resolved base URL below */
  }
  const resolvedRepo = resolveBaseUrl().value.replace(/^\/+|\/+$/g, '');
  if (resolvedRepo) repos.add(resolvedRepo);
  const repoPart = repos.size ? `(?:${[...repos].map(escape).join('|')})/` : '[^/]+/';
  const locales = (() => {
    try {
      return resolveLocales().locales;
    } catch {
      return [];
    }
  })();
  const localePart = locales.length
    ? `(?:${locales.map(escape).join('|')})`
    : '[a-z]{2,3}(?:-[A-Za-z]{2,8})*';
  const DOUBLE_PREFIX_RE = new RegExp(`href="/${repoPart}${localePart}/`, 'g');
  let htmlFiles = 0;
  let doublePrefix = 0;
  const samples = [];
  const walkHtml = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkHtml(full);
      } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
        htmlFiles++;
        const text = fs.readFileSync(full, 'utf8');
        const found = text.match(DOUBLE_PREFIX_RE);
        if (found?.length) {
          doublePrefix += found.length;
          if (samples.length < SAMPLE_LIMIT) {
            const line = text.slice(0, text.indexOf(found[0])).split('\n').length;
            samples.push(`${path.relative(REPO, full)}:${line} ${found[0]}`);
          }
        }
      }
    }
  };
  walkHtml(BUILD_DIR);
  const ok = doublePrefix === 0;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} build double-prefix: href="/<repo>/<locale>/..." = ${doublePrefix}` +
      ` (in ${htmlFiles} html file(s))`,
  );
  for (const sample of samples) console.log(`  build-double-prefix: ${sample}`);
  if (!ok) failures.push(`build: ${doublePrefix} double-prefixed href(s) (/<repo>/<locale>/)`);
}

if (failures.length) process.exitCode = 1;
