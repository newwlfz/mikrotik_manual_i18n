#!/usr/bin/env node
/**
 * Crawl the live sidebar and pagination from the rendered pages.
 *
 * The Playwright crawler needed one visit per category and lost a whole subtree
 * when the official site 404s a category URL. Every rendered page already ships
 * its sidebar branch (ancestors expanded, active category fully listed) plus its
 * previous/next links, so one visit per document is enough to recover:
 *
 *   - the sidebar label of every visible entry,
 *   - the sibling order of every expanded category,
 *   - the previous/next targets the official site really renders.
 *
 * Outputs the same manifest shape as `crawl-sidebar.mjs` (so `build-sidebars`
 * keeps one input contract) plus `docs-<version>-nav.json` with pagination.
 *
 *   node tools/sync/crawl-nav.mjs --version=7.24
 *   node tools/sync/crawl-nav.mjs --all --refresh
 *   node tools/sync/crawl-nav.mjs --version=7.24 --limit=20
 *
 * Cached snapshots are only reused when their `generation` matches the current
 * crawl source generation (upstream corpus ETag). Snapshots without a
 * generation (pre-fix cache) are always stale; `--refresh` ignores the cache
 * entirely and refetches every page.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {REPO} from '../translate/lib/paths.mjs';
import {allVersions, currentVersion, pageRouteUrl, versionPlan, versionPlans} from './lib/versions.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const ALL = process.argv.includes('--all');
const REFRESH = process.argv.includes('--refresh');
const ONLY = arg('version', '');
const LIMIT = Number(arg('limit', '0'));
const CONCURRENCY = Number(arg('concurrency', '6'));
const current = currentVersion();
const versions = ONLY ? [ONLY] : ALL ? allVersions() : [current];
const SECTIONS = versionPlans().map((plan) => ({
  dir: plan.docsDir,
  version: plan.version,
  prefix: plan.docsPrefix,
}));

/**
 * The prefix an href in this version uses is decided by the page sources, not
 * by the plan: right after a release the official site can still serve the
 * outgoing version under its own prefix, and a crawl must not rewrite ids that
 * are already versioned.
 */
function prefixFor(plan, pages) {
  const source = pages.find((page) => page.url)?.url;
  if (!source) return plan.docsPrefix;
  const pathname = new URL(source).pathname;
  const match = /^\/docs\/(\d+(?:\.\d+)*)\//.exec(pathname);
  if (match && match[1] === plan.version) return `/docs/${match[1]}`;
  return '/docs';
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** `/docs/7.24/reference/` -> `reference/index`, `/docs/7.24/reference` -> `reference`. */
function docIdOf(href, prefix) {
  if (!href) return null;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean.startsWith(prefix)) return null;
  const rest = clean.slice(prefix.length).replace(/^\/+/, '');
  if (rest === '') return 'index';
  const trimmed = rest.replace(/\/+$/, '');
  return clean.endsWith('/') ? `${trimmed}/index` : trimmed;
}

/**
 * Categories are identified by their label path, never by `href`: a category and
 * its first child category can link to the same page (`Install` ->
 * `chr-installation/`, `iot` -> `bluetooth/`), and Docusaurus renders an active
 * category header with `href="#"`. Keying by href merged such pairs and
 * flattened the child category.
 */
// Labels legitimately contain `/` (`LTE/5G`, `Bridge IGMP/MLD snooping`), so a
// slash-joined path could merge `A` + `B/C` with `A/B` + `C`. Join with a unit
// separator instead: it cannot appear in a rendered label.
const PATH_SEP = '\u001f';

function assignPaths(list, parent = '') {
  for (const entry of list) {
    entry.path = parent ? `${parent}${PATH_SEP}${entry.label}` : entry.label;
    if (entry.children?.length) assignPaths(entry.children, entry.path);
  }
  return list;
}

function parseSidebar($) {
  const nav = $('nav[aria-label="Docs sidebar"]').first();
  if (!nav.length) return null;
  const parseList = (ul) =>
    $(ul)
      .children('li')
      .map((index, li) => {
        const anchor = $(li).find('a').first();
        const label = anchor.text().trim().replace(/\s+/g, ' ');
        // Docusaurus renders a category *without* a link as a button and fills
        // `href` only for the server-side render (the first child's URL). The
        // caret class and `role=button` are the real markers.
        const linked = !(anchor.hasClass('menu__link--sublist-caret') || anchor.attr('role') === 'button');
        const href = linked ? (anchor.attr('href') || null) : null;
        const sublist = $(li).children('ul').first();
        return {
          label,
          href,
          linked,
          // A collapsed category ships its caret class but no child list; the
          // class is the only reliable marker in the server-rendered HTML.
          sublist: anchor.hasClass('menu__link--sublist') || sublist.length > 0,
          children: sublist.length ? parseList(sublist) : [],
        };
      })
      .get();
  const root = nav.find('ul').first();
  if (!root.length) return null;
  return parseList(root);
}

function parsePagination($) {
  const read = (selector) => {
    const anchor = $(selector).first();
    if (!anchor.length) return null;
    return {href: anchor.attr('href') || null, label: anchor.find('.pagination-nav__label').first().text().trim() || null};
  };
  const nav = $('.pagination-nav').first();
  if (!nav.length) return {previous: null, next: null, present: false};
  return {
    previous: read('.pagination-nav__link--prev'),
    next: read('.pagination-nav__link--next'),
    present: true,
  };
}

async function fetchPage(url, attempts = 3) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': 'mikrotik-manual-mirror/1.0'},
        signal: AbortSignal.timeout(60000),
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw last;
}

function pagesOf(section, version) {
  const pages = [];
  const plan = versionPlan(version);
  for (const file of walk(path.join(REPO, section.dir))) {
    const text = fs.readFileSync(file, 'utf8');
    const {frontMatter} = splitFrontMatter(text);
    const localPath = path.relative(path.join(REPO, section.dir), file).replace(/\\/g, '/');
    // A freshly installed release has no front matter yet: `materialize` writes
    // it afterwards. The official route is still known from the plan.
    const source = readField(frontMatter, 'source') || pageRouteUrl(plan, localPath);
    if (!source || !source.startsWith('https://manual.mikrotik.com/')) continue;
    pages.push({file, localPath, url: source.endsWith('/') ? source : `${source}/`, prefix: section.prefix, version});
  }
  return pages;
}

/**
 * Generation identity of the crawl source, written into every snapshot as
 * `generation` and compared before a cache hit is accepted.
 *
 * Choice: the upstream corpus ETag from `upstream/<version>/manifest.json`
 * (`corpus_etag`, recorded by sync/fetch-upstream from the official llms-full
 * response). It changes when the official corpus changes even if the page count
 * stays the same, and it reads a committed file — no extra network probe.
 * The version is folded into the digest so a cache copied between version
 * directories cannot masquerade as current.
 *
 * Graceful degradation: if the manifest or its ETag is absent, fall back to a
 * digest of the local page identity list (paths + URLs), which still
 * invalidates on page add/remove. A snapshot with no `generation` field is
 * always treated as stale (the pre-fix cache), never as a valid hit.
 */
function generationOf(version, pages) {
  const manifest = path.join(REPO, `upstream/${version}/manifest.json`);
  let etag = null;
  if (fs.existsSync(manifest)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (typeof parsed.corpus_etag === 'string' && parsed.corpus_etag.trim()) {
        etag = parsed.corpus_etag.trim();
      }
    } catch {
      // Unreadable manifest: the page-set fallback below still gives a stable id.
    }
  }
  const basis = etag
    ? `etag:${etag}`
    : `pages:${pages.map((page) => `${page.localPath}\u0000${page.url}`).sort().join('\u0001')}`;
  return `${version}\u001f${crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16)}`;
}

/** Deterministic ordering for children merged from several page observations. */
function childKey(child) {
  return `${child.label}\u001f${child.href || ''}\u001f${child.path || ''}`;
}
function childrenSignature(children) {
  return children.map(childKey).sort().join('\u001e');
}
function mergeChildren(left, right) {
  const byKey = new Map();
  for (const child of [...left, ...right]) {
    const key = childKey(child);
    const previous = byKey.get(key);
    // A category observation wins over a plain link for the same key; otherwise
    // first-seen wins. The final sort removes any dependence on worker order.
    if (!previous || (child.sublist && !previous.sublist)) byKey.set(key, child);
  }
  return [...byKey.values()].sort((a, b) => {
    const leftKey = childKey(a);
    const rightKey = childKey(b);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

for (const version of versions) {
  const section = SECTIONS.find((entry) => entry.version === version);
  if (!section) throw new Error(`no section for version ${version}`);
  const plan = versionPlans().find((entry) => entry.version === version);
  const cacheRoot = path.join(REPO, 'data/nav', version);
  fs.mkdirSync(cacheRoot, {recursive: true});
  const pages = pagesOf(section, version).slice(0, LIMIT || undefined);
  if (!pages.length) {
    throw new Error(
      `no crawlable pages for ${version} in ${section.dir}: ` +
        'the installed tree has neither a source URL nor a known route',
    );
  }
  section.prefix = prefixFor(plan, pages);
  const generation = generationOf(version, pages);
  console.log(`[${version}] generation=${generation}`);
  const categories = new Map(); // path -> {generation, children}
  const categoryConflicts = [];
  const routes = new Map();
  const labels = {};
  const pagination = {};
  const failures = [];
  let fetched = 0;
  let cached = 0;
  let stale = 0;
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= pages.length) return;
      const page = pages[index];
      const id = page.localPath.replace(/\.mdx?$/, '').replace(/\/index$/, '') || 'index';
      const cacheFile = path.join(cacheRoot, `${id.replace(/\//g, '__')}.json`);
      let data;
      if (!REFRESH && fs.existsSync(cacheFile)) {
        // A cache file is not a hit by itself: only a snapshot from the same
        // source generation is. Missing/unreadable/mismatched generations are
        // stale and fall through to a fresh fetch (safe downgrade for old data).
        try {
          const candidate = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          if (candidate.generation === generation) {
            data = candidate;
            cached++;
          } else {
            stale++;
          }
        } catch {
          stale++;
        }
      }
      if (!data) {
        try {
          const html = await fetchPage(page.url);
          const $ = cheerio.load(html);
          data = {
            id,
            url: page.url,
            sidebar: parseSidebar($),
            pagination: parsePagination($),
            generation,
          };
          fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
          fetched++;
          if (fetched % 100 === 0) console.log(`[${version}] fetched ${fetched}`);
        } catch (error) {
          failures.push({id, url: page.url, error: error.message});
          continue;
        }
      }
      if (!data.sidebar) continue;
      assignPaths(data.sidebar);
      // Ancestor links: `/docs/7.24/getting-started/` is the category page.
      const collect = (entries) => {
        for (const entry of entries) {
          if (entry.href && entry.href.startsWith(page.prefix)) routes.set(entry.href, entry.label);
          if (entry.sublist && entry.children.length) {
            const children = entry.children.map((child) => ({
              label: child.label,
              href: child.href,
              sublist: child.sublist,
              path: child.path,
            }));
            const existing = categories.get(entry.path);
            if (!existing) {
              categories.set(entry.path, {generation: data.generation || null, children});
            } else if (existing.generation !== (data.generation || null)) {
              // Never silently mix observations from two crawl generations:
              // fail loudly instead of producing a nondeterministic tree.
              throw new Error(
                `mixed cache generations for path ${JSON.stringify(entry.path)}: ` +
                  `${existing.generation || 'MISSING'} vs ${data.generation || 'MISSING'}`,
              );
            } else if (childrenSignature(existing.children) !== childrenSignature(children)) {
              // Same generation, different children: a real conflict. Record it
              // and merge in a worker-order-independent order rather than
              // letting the last Promise.all writer win.
              categoryConflicts.push(entry.path);
              existing.children = mergeChildren(existing.children, children);
            }
          }
          if (entry.children.length) collect(entry.children);
        }
      };
      collect(data.sidebar);
      if (data.pagination?.present) {
        pagination[id] = {
          previous: docIdOf(data.pagination.previous?.href, page.prefix),
          next: docIdOf(data.pagination.next?.href, page.prefix),
        };
      }
    }
  }

  await Promise.all(Array.from({length: Math.max(1, CONCURRENCY)}, worker));

  // Root order: every page renders the full top-level list.
  let rootEntries = [];
  for (const page of pages) {
    const id = page.localPath.replace(/\.mdx?$/, '').replace(/\/index$/, '') || 'index';
    const cacheFile = path.join(cacheRoot, `${id.replace(/\//g, '__')}.json`);
    if (!fs.existsSync(cacheFile)) continue;
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (data.generation !== generation) continue;
    if (!data.sidebar || !data.sidebar.length) continue;
    rootEntries = data.sidebar.map((entry) => ({label: entry.label, href: entry.href, sublist: entry.sublist, path: entry.path}));
    break;
  }

  function buildTree(entries, seen = new Set(), depth = 0) {
    return entries
      .map((entry) => {
        const path = entry.path || entry.label;
        const id = docIdOf(entry.href, section.prefix);
        if (entry.sublist) {
          if (seen.has(path) || depth > 24) return null;
          const nextSeen = new Set(seen);
          nextSeen.add(path);
          const items = buildTree(categories.get(path)?.children || [], nextSeen, depth + 1);
          if (!id && items.length === 0) return null;
          return {
            type: 'category',
            label: entry.label,
            ...(id ? {link: {type: 'doc', id}} : {}),
            items,
          };
        }
        if (!entry.href) return null;
        return id ? {type: 'doc', id, label: entry.label} : null;
      })
      .filter(Boolean);
  }

  const tree = buildTree(rootEntries);
  const manifestFile = path.join(REPO, `data/manifests/docs-${version}-sidebar.json`);
  const routesFile = path.join(REPO, `data/manifests/docs-${version}-sidebar.routes.json`);
  const navFile = path.join(REPO, `data/manifests/docs-${version}-nav.json`);
  for (const [href, label] of routes) {
    const id = docIdOf(href, section.prefix);
    if (id) labels[id] = label;
  }
  fs.writeFileSync(manifestFile, `${JSON.stringify({version, docs: tree}, null, 2)}\n`);
  fs.writeFileSync(
    routesFile,
    `${JSON.stringify([...routes.entries()].map(([href, label]) => ({href, label, id: docIdOf(href, section.prefix)})), null, 2)}\n`,
  );
  fs.writeFileSync(
    navFile,
    `${JSON.stringify({version, generation, pagination, labels, totals: {pages: pages.length, fetched, cached, stale, failed: failures.length, categoryConflicts: categoryConflicts.length}}, null, 2)}\n`,
  );
  console.log(`[${version}] pages=${pages.length} fetched=${fetched} cached=${cached} stale=${stale} failed=${failures.length} categories=${categories.size} routes=${routes.size} root=${rootEntries.length} conflicts=${categoryConflicts.length}`);
  if (categoryConflicts.length) {
    console.log(`[${version}] category conflicts (deterministically merged, not last-writer-wins):`);
    for (const entry of categoryConflicts.slice(0, 10)) console.log(`       ${JSON.stringify(entry)}`);
  }
  if (failures.length) console.log(failures.slice(0, 5));
}
