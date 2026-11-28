/**
 * Link resolver for materialisation.
 *
 * The route index is built from the upstream manifest, not from the current
 * docs tree, so materialisation does not depend on its own output. Non-docs
 * sections are still read from their current trees during P1; they have no
 * upstream manifest yet.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../../translate/lib/paths.mjs';
import {headingIds, slugify} from '../../translate/lib/anchors.mjs';
import {buildRouteIndex} from './routes.mjs';
import {
  knownVersion,
  sectionNameFor,
  versionForSection,
  versionPlans,
} from './versions.mjs';

const OFFICIAL = 'https://manual.mikrotik.com';

/** Route base of every mirrored section; docs versions are derived. */
const BASE = Object.fromEntries([
  ...versionPlans().map((plan) => [
    plan.sectionName,
    plan.isCurrent ? '/docs' : `/docs/${plan.version}`,
  ]),
  ['hardware', '/hardware'],
  ['blog', '/blog'],
  ['changelog', '/changelog'],
]);

const isDocsSection = (name) => name === 'docs' || name.startsWith('docs-');
const ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|pdf|txt|rsc|ovpn|conf|json|js|css|html?|zip|gz|xlsx?|docx?|csv|pcap|bin|img|iso|npk|mp4|webm)$/i;

export function buildManifestIndex(manifest, version) {
  const index = new Map();
  const byName = new Map();
  const byFile = new Map();
  const section = sectionNameFor(version);
  const base = BASE[section];
  const routes = [];

  for (const page of manifest.pages || []) {
    if (page.origin !== 'official' && page.origin !== 'local') continue;
    const route = `${base}/${page.route}`.replace(/\/+$/, '') || base;
    const isIndex = page.local_path.endsWith('/index.md');
    const entry = {section, file: page.local_path, rel: page.local_path, route, isIndex};
    routes.push(entry);
    index.set(route, entry);
    index.set(`${route}/`, entry);
    byFile.set(page.local_path, entry);
  }
  byName.set(section, routes);

  // Hardware / blog / changelog still come from the current trees in P1.
  const site = buildRouteIndex();
  for (const [name, entries] of site.byName) {
    // Every docs version is described by its own manifest, never by the tree.
    if (isDocsSection(name)) continue;
    byName.set(name, entries);
    for (const entry of entries) {
      index.set(entry.route, entry);
      index.set(`${entry.route}/`, entry);
    }
  }

  return {index, byName, byFile, section};
}

function branchOf(route, base) {
  const rest = route.slice(base.length).replace(/^\/+/, '');
  return rest.split('/')[0] || '';
}

function bestMatch(section, rest, sourceFile, data) {
  const base = BASE[section];
  const clean = rest.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.mdx?$/i, '').replace(/\/index$/, '');
  const exact = data.index.get(`${base}/${clean}`) || data.index.get(`${base}/${clean}/`);
  if (exact) return exact;

  const sourceParts = sourceFile.split('/').filter(Boolean);
  const sourceBranch = sourceParts[0] || '';
  const requested = new Set(clean.split('/').filter(Boolean));
  const leaf = [...requested].at(-1) || '';
  const candidates = [];
  for (const candidate of data.byName.get(section) || []) {
    const route = candidate.route.replace(/\/+$/, '');
    if (!leaf || !(route.endsWith(`/${leaf}`) || route === `${base}/${leaf}`)) continue;
    const segments = new Set(route.slice(base.length).split('/').filter(Boolean));
    let score = 0;
    for (const segment of requested) if (segments.has(segment)) score++;
    if (branchOf(route, base) && branchOf(route, base) === sourceBranch) score += 3;
    for (const segment of sourceParts) {
      if (segment !== 'index' && segment !== sourceBranch && segments.has(segment)) score += 2;
    }
    candidates.push({entry: candidate, score});
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
  return candidates[0].entry;
}

function localHref(entry) {
  return entry.isIndex ? `${entry.route}/` : entry.route;
}

function sectionRootOfSource(sourceFile) {
  const parts = sourceFile.split('/');
  return parts.length > 2 ? parts[1] : '';
}

/**
 * Heading ids the source page itself publishes.
 *
 * A root-targeting link (`/docs#x`, `/docs/<v>#x`) names no document: its
 * fragment belongs to the page that carries it. Decide from the published page
 * rather than from the link text. Upstream is tried first so a fresh archive
 * materialisation still resolves before `versioned_docs/` has been written.
 */
function publishedHeadingIds(sourceSection, sourceFile) {
  const version = versionForSection(sourceSection);
  const candidates = [];
  if (version && sourceFile) {
    candidates.push(path.join(REPO, 'upstream', version, 'docs', sourceFile));
  }
  if (sourceFile) {
    candidates.push(path.join(REPO, SECTION_SOURCE_DIR[sourceSection] || 'docs', sourceFile));
  }
  for (const file of candidates) {
    try {
      return headingIds(fs.readFileSync(file, 'utf8'));
    } catch {
      // Keep trying: a missing file is not evidence about a heading id.
    }
  }
  return [];
}

/** The containing page's own route — the only safe target of a self-link. */
function selfHref(data, sourceFile, anchor) {
  const source = data.byFile.get(sourceFile);
  return source ? `${source.route.replace(/\/+$/, '')}${anchor}` : null;
}

/**
 * Keep every docs link inside the version of the page that carries it.
 *
 * The current tree is unversioned, an archive carries its own prefix. A page
 * that links to an archived release it does not belong to is retargeted to its
 * own version: the same paragraph must not send a 7.25 reader to 7.26.
 */
function normaliseVersionedTarget(target, sourceSection) {
  const sourceVersion = versionForSection(sourceSection);
  if (!sourceVersion) return target;
  // A version root (`/docs` or `/docs/<v>`) names no document. Leaving it alone
  // lets the section-root handling in resolveLink bind its fragment to the
  // containing page; prefixing it here would double the version (`/docs/v/v`).
  if (/^\/docs(?:\/[0-9][0-9.]*)?$/.test(target)) return target;
  const own = `/docs/${sourceVersion}/`;
  if (target.startsWith(own)) {
    return sourceSection === 'docs' ? target.replace(own, '/docs/') : target;
  }
  if (sourceSection === 'docs' || !target.startsWith('/docs/')) return target;
  const versioned = /^\/docs\/(\d+(?:\.\d+)*)\//.exec(target);
  if (versioned && knownVersion(versioned[1])) return target;
  if (versioned) return target.replace(`/docs/${versioned[1]}/`, own);
  return target.replace(/^\/docs\//, own);
}

/**
 * Map an official heading anchor onto the id Docusaurus actually publishes.
 *
 * The official renderer spells the `802.3ad` heading `#802-3ad`, while
 * Docusaurus slugifies the same heading to `#8023ad`. Only known official
 * spellings are rewritten, and the replacement id is derived with the site's
 * own slugger instead of being hard-coded; every other fragment is left
 * byte-for-byte alone so `verify:anchors` stays authoritative. This is called
 * for table-cell links as they pass through the
 * `table-structure -> link-resolver -> rewrite-links` chain.
 */
const OFFICIAL_ANCHOR_HEADINGS = new Map([['802-3ad', '802.3ad']]);

export function normaliseAnchor(anchor) {
  if (!anchor) return '';
  const name = String(anchor).replace(/^#/, '');
  const heading = OFFICIAL_ANCHOR_HEADINGS.get(name);
  if (!heading) return anchor;
  const slug = slugify(heading);
  return slug && slug !== name ? `#${slug}` : anchor;
}

export function resolveLink(target, sourceSection, sourceFile, data) {
  let url = target;
  let anchor = '';
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    anchor = normaliseAnchor(url.slice(hashIndex));
    url = url.slice(0, hashIndex);
  }
  if (!url) return null;
  if (url.startsWith(OFFICIAL)) url = url.slice(OFFICIAL.length);
  url = normaliseVersionedTarget(url, sourceSection);

  if (!url.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    const source = data.byFile.get(sourceFile);
    if (source) {
      // Upstream publishes a landing page as `<slug>/index.md`; after the
      // route-new migration the very same page is a flat `<slug>.md`. In that
      // flat page a relative `index.md` / `./index.md` still points at itself.
      // Resolving it against the parent directory pinned it to the version root
      // (`/docs/<v>#anchor`), so keep it on the source page's own route.
      if (/^(?:\.\/)?index(?:\.mdx?)?$/i.test(url) && !source.isIndex) {
        url = source.route.replace(/\/+$/, '');
      } else {
        const dirname = source.isIndex
          ? source.route.replace(/\/+$/, '')
          : source.route.slice(0, source.route.lastIndexOf('/'));
        url = path.posix.normalize(`${dirname}/${url}`).replace(/\.mdx?$/i, '').replace(/\/index$/, '');
        if (!url.startsWith('/')) url = `/${url}`;
      }
    }
  }

  if (ASSET_EXT.test(url)) {
    if (url.startsWith('/assets/')) {
      return {href: url, dead: !fs.existsSync(path.join(REPO, 'static', url))};
    }
    return {skip: true};
  }

  let section = null;
  let rest = null;
  const bases = Object.entries(BASE).sort((a, b) => b[1].length - a[1].length);
  for (const [name, base] of bases) {
    if (url === base || url.startsWith(`${base}/`)) {
      section = name;
      rest = url.slice(base.length + 1);
      break;
    }
  }
  if (!section) {
    if (url.startsWith('/assets/')) return null;
    return null;
  }

  if ((rest === '' || rest === 'index') && isDocsSection(section)) {
    // A root-targeting link whose fragment is a heading published by the
    // source page is a self-link. Bind it to that page in its own release:
    // current stays `/docs/<slug>#x`, an archive stays `/docs/<v>/<slug>#x`.
    if (
      anchor &&
      publishedHeadingIds(sourceSection, sourceFile).includes(anchor.replace(/^#/, ''))
    ) {
      const href = selfHref(data, sourceFile, anchor);
      if (href) return {href, exact: true};
    }
    const root = sectionRootOfSource(sourceFile);
    if (root) {
      const rootEntry = data.index.get(`${BASE[section]}/${root}/`) || data.index.get(`${BASE[section]}/${root}`);
      if (rootEntry) return {href: `${localHref(rootEntry)}${anchor}`, exact: true};
    }
    // The old unconditional `/docs/introduction` fallback is gone: it moved a
    // fragment onto an unrelated page and mixed releases.
  }
  if (section === 'blog' || section === 'changelog') {
    if (rest === '' || rest === 'index') return {href: `${BASE[section]}/${anchor}`, exact: true};
  }

  let entry = bestMatch(section, rest, sourceFile, data);
  if (!entry) {
    const parts = rest.replace(/\/+$/, '').split('/');
    if (parts.length > 1 && parts.at(-1) === parts.at(-2)) {
      entry = bestMatch(section, parts.slice(0, -1).join('/'), sourceFile, data);
    }
  }
  if (!entry) {
    const leaf = rest.replace(/\/+$/, '').split('/').at(-1);
    const candidates = [];
    for (const [name, routes] of data.byName) {
      // A docs page is only ever matched inside its own version; a shared
      // section can be reached from any version.
      if (isDocsSection(section) && isDocsSection(name) && name !== section) continue;
      for (const candidate of routes) {
        const route = candidate.route.replace(/\/+$/, '');
        if (route.endsWith(`/${leaf}`)) candidates.push(candidate);
      }
    }
    if (candidates.length === 1) entry = candidates[0];
  }
  if (!entry) {
    // Never emit `${BASE[section]}#anchor`: that is the version root with a
    // fragment from another page, i.e. the cross-version link defect. A dead
    // link keeps its containing page (with its own release prefix) and its dead
    // marker so `materialize` still reports it.
    if (anchor && (rest === '' || rest === 'index')) {
      const href = selfHref(data, sourceFile, anchor);
      if (href) return {href, dead: true};
    }
    const fallback = `${BASE[section]}/${rest.replace(/^\/+/, '')}`.replace(/\/+$/, '');
    return {href: `${fallback}${anchor}`, dead: true};
  }
  return {href: `${localHref(entry)}${anchor}`, exact: true};
}

function mapOutsideFences(text, fn) {
  const lines = text.split('\n');
  let fence = null;
  return lines
    .map((line) => {
      const match = /^\s*(?:(?:\d+\.|[-*+])\s+)?(```+|~~~+)/.exec(line);
      if (match) {
        if (!fence) fence = match[1][0];
        else if (match[1][0] === fence) fence = null;
        return line;
      }
      return fence ? line : fn(line);
    })
    .join('\n');
}

const SECTION_SOURCE_DIR = Object.fromEntries([
  ...versionPlans().map((plan) => [plan.sectionName, plan.docsDir]),
  ['hardware', 'hardware'],
  ['blog', 'blog'],
  ['changelog', 'changelog'],
]);

/**
 * Map an image reference to the file the page actually ships.
 *
 * The official Markdown names its images (`mtu-in-routeros-01.webp`) while the
 * rendered page serves content-hashed copies (`...-01-<hash>.webp`); a cell
 * restored from the rendered page therefore carries a path that never exists
 * locally. Keep the reference's `#gh-light-mode-only`/`#gh-dark-mode-only`
 * fragment: dropping it printed both the light and the dark image.
 */
function resolveImage(target, sourceSection, sourceFile) {
  const split = target.indexOf('#');
  const pathPart = split === -1 ? target : target.slice(0, split);
  const fragment = split === -1 ? '' : target.slice(split);
  if (/^(?:data|mailto|tel):/i.test(pathPart)) return target;
  let relative = pathPart.startsWith(OFFICIAL) ? pathPart.slice(OFFICIAL.length) : pathPart;
  if (/^[a-z]+:\/\//i.test(relative)) return target;
  const dir = path.dirname(path.join(REPO, SECTION_SOURCE_DIR[sourceSection] || 'docs', sourceFile));
  const basename = path.basename(relative);
  const candidates = [basename, basename.replace(/-[0-9a-f]{8,}(\.[a-z0-9]+)$/i, '$1')];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(dir, 'img', candidate))) return `./img/${candidate}${fragment}`;
  }
  // The page still gets a page-relative reference: `fetch-assets` reports and
  // fills the missing file, and a hashed name resolves once it is downloaded.
  if (relative.includes('/img/')) return `./img/${basename}${fragment}`;
  return relative.startsWith('/') ? `${relative}${fragment}` : `./${relative.replace(/^\.\//, '')}${fragment}`;
}

export function rewriteLinks(body, sourceSection, sourceFile, data, stats) {
  // Markdown links.
  let out = mapOutsideFences(body, (line) =>
    line.replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (whole, open, target, close) => {
      if (open.startsWith('![')) {
        const image = resolveImage(target, sourceSection, sourceFile);
        return image ? `${open}${image}${close}` : whole;
      }
      const resolved = resolveLink(target, sourceSection, sourceFile, data);
      if (!resolved || resolved.skip) return whole;
      stats.links++;
      if (resolved.dead) {
        stats.dead++;
        stats.deadTargets?.push(target);
      }
      stats.rewritten++;
      return `${open}${resolved.href}${close}`;
    }),
  );

  // Inline HTML attributes (the 137-link defect).
  out = mapOutsideFences(out, (line) =>
    line.replace(/(\b(?:href|src)=")([^"]+)(")/g, (whole, open, target, close) => {
      if (/^(#|mailto:|tel:|data:)/i.test(target)) return whole;
      if (open.endsWith('src="')) {
        const image = resolveImage(target, sourceSection, sourceFile);
        if (image !== target) stats.htmlImages = (stats.htmlImages || 0) + 1;
        return `${open}${image}${close}`;
      }
      const resolved = resolveLink(target, sourceSection, sourceFile, data);
      if (!resolved || resolved.skip) return whole;
      if (resolved.dead) {
        stats.dead++;
        stats.deadTargets?.push(target);
      }
      stats.htmlLinks++;
      return `${open}${resolved.href}${close}`;
    }),
  );

  return out;
}
