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
 */

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
  const categories = new Map();
  const routes = new Map();
  const labels = {};
  const pagination = {};
  const failures = [];
  let fetched = 0;
  let cached = 0;
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
        data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        cached++;
      } else {
        try {
          const html = await fetchPage(page.url);
          const $ = cheerio.load(html);
          data = {id, url: page.url, sidebar: parseSidebar($), pagination: parsePagination($)};
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
            categories.set(entry.path, entry.children.map((child) => ({
              label: child.label,
              href: child.href,
              sublist: child.sublist,
              path: child.path,
            })));
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
          const items = buildTree(categories.get(path) || [], nextSeen, depth + 1);
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
    `${JSON.stringify({version, pagination, labels, totals: {pages: pages.length, fetched, cached, failed: failures.length}}, null, 2)}\n`,
  );
  console.log(`[${version}] pages=${pages.length} fetched=${fetched} cached=${cached} failed=${failures.length} categories=${categories.size} routes=${routes.size} root=${rootEntries.length}`);
  if (failures.length) console.log(failures.slice(0, 5));
}
