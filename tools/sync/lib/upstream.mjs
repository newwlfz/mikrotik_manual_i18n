/**
 * Shared upstream-layer helpers: config, manifest, hashes, frontmatter and
 * official-URL to local-path mapping.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {REPO, pageRouteUrl, upstreamConfig, versionPlan} from './versions.mjs';
import {walkMarkdown} from '../../translate/lib/paths.mjs';

export const CONFIG_PATH = path.join(REPO, 'config/upstream.yml');

export function loadConfig() {
  return upstreamConfig();
}

/**
 * Backwards-compatible view of a version plan, in the shape the older tools
 * read (`docs_dir`, `route_version`, `manifest`, `upstream_dir`).
 */
export function versionConfig(version, options = {}) {
  const plan = versionPlan(version, options);
  return {
    config: upstreamConfig(),
    sectionName: 'docs',
    section: plan.section,
    version,
    isCurrent: plan.isCurrent,
    docs_dir: plan.docsDir,
    route_version: plan.version,
    route_base: plan.routeBase,
    docs_prefix: plan.docsPrefix,
    llms_url: plan.llmsUrl,
    manifest: plan.manifest,
    upstream_dir: plan.upstreamDir,
  };
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(file, text) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function writeBuffer(file, buffer) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, file);
}

export function manifestPath(version, options = {}) {
  return path.join(REPO, versionConfig(version, options).manifest);
}

export function upstreamDir(version, options = {}) {
  return path.join(REPO, versionConfig(version, options).upstream_dir);
}

export function docsDir(version, options = {}) {
  return path.join(REPO, versionConfig(version, options).docs_dir);
}

export function loadManifest(version) {
  return readJson(manifestPath(version));
}

export function normaliseSourceUrl(url) {
  if (!url) return null;
  return url.split('#')[0].split('?')[0].replace(/\/+$/, '').replace(/\.md$/i, '');
}

/**
 * `/docs/7.25/x/` (archive), `/docs/x/` (current, unversioned) and a bare
 * `/x/` all map to the same local route: `x`.
 */
export function routeFromOfficialUrl(url) {
  const pathname = new URL(url).pathname;
  const route = pathname
    .replace(/^\/docs\/\d+(?:\.\d+)*\//, '')
    .replace(/^\/docs\//, '')
    .replace(/^\/+/, '');
  return route.replace(/\.md$/i, '').replace(/\/+$/, '');
}

export function htmlUrlForPage(page) {
  if (!page?.source_url) return null;
  const url = new URL(page.source_url);
  let pathname = url.pathname.replace(/\.md$/i, '');
  if (page.local_path.endsWith('/index.md')) {
    if (!pathname.endsWith('/')) pathname += '/';
  } else {
    pathname = pathname.replace(/\/+$/, '');
  }
  return `${url.origin}${pathname}`;
}

/**
 * Rendered URL of an installed page.
 *
 * The upstream manifest is authoritative (it records the exact official URL the
 * page was fetched from), so a page keeps working when the current tree is
 * served unversioned. The plan is the fallback for a page the manifest does not
 * list yet: `<routeBase>/<path>/`.
 */
/** Official docs always render with a trailing slash. */
export function fetchUrlFor(plan, localPath) {
  return `${pageUrlFor(plan, localPath).replace(/\/+$/, '')}/`;
}

export function pageUrlFor(plan, localPath) {
  const manifest = readJson(path.join(REPO, plan.manifest));
  for (const page of manifest?.pages || []) {
    if (page.local_path === localPath && page.source_url) {
      return page.source_url.replace(/\.md$/i, '');
    }
  }
  return pageRouteUrl(plan, localPath);
}


export function splitFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return {raw: '', data: {}, body: text};
  let data = {};
  try {
    data = YAML.parse(match[1]) || {};
  } catch {
    data = {};
  }
  return {raw: match[1], data, body: text.slice(match[0].length)};
}

function optionalString(value) {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * Keep the frontmatter contract explicit:
 * - official fields come from the official page / sidebar;
 * - mirror fields are maintained by this project.
 *
 * `source` is never normalised or rewritten here. Asset tooling reads it.
 */
export function frontmatterGroups(data = {}) {
  const official = {};
  const mirror = {};

  for (const key of ['title', 'sidebar_label', 'description', 'slug']) {
    const value = optionalString(data[key]);
    if (value !== undefined) official[key] = value;
  }

  for (const key of ['sidebar_key', 'source', 'captured_at']) {
    const value = optionalString(data[key]);
    if (value !== undefined) mirror[key] = value;
  }

  const position = optionalNumber(data.sidebar_position);
  if (position !== undefined) mirror.sidebar_position = position;

  if (Array.isArray(data.tags)) mirror.tags = data.tags.map(String);
  else if (typeof data.tags === 'string' && data.tags) mirror.tags = [data.tags];

  return {official, mirror};
}

export function pageFrontmatter(version, localPath, options = {}) {
  const file = path.join(docsDir(version, options), localPath);
  if (!fs.existsSync(file)) return {official: {}, mirror: {}};
  return frontmatterGroups(splitFrontMatter(fs.readFileSync(file, 'utf8')).data);
}

export function buildSourceMap(version) {
  const root = docsDir(version);
  const byUrl = new Map();
  const files = walkMarkdown(root).map((file) => path.relative(root, file).split(path.sep).join('/'));
  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    const {data} = splitFrontMatter(text);
    const source = normaliseSourceUrl(data.source);
    if (!source) continue;
    if (!byUrl.has(source)) byUrl.set(source, []);
    byUrl.get(source).push(rel);
  }
  return {byUrl, files};
}

/**
 * Existing spelling of a route (`x/index.md` vs `x.md`). With `prospective`, an
 * uninstalled release is mapped against the installed tree, whose spellings are
 * the ones the mirror already uses.
 */
export function localPathForRoute(version, route, options = {}) {
  const root = docsDir(version, options);
  const clean = route.replace(/^\/+|\/+$/g, '');
  const asIndex = path.join(root, clean, 'index.md');
  if (fs.existsSync(asIndex)) return `${clean}/index.md`;
  const flat = path.join(root, `${clean}.md`);
  if (fs.existsSync(flat)) return `${clean}.md`;
  return null;
}

export function sortedPages(pages) {
  return [...pages].sort((a, b) => a.local_path.localeCompare(b.local_path));
}

// ---------------------------------------------------------------------------
// Corpus probe
//
// One conditional GET on the whole-corpus file answers "did the official site
// change?" for a handful of bytes instead of ~1.5k page requests. The probe is
// shared by `fetch-upstream` (where a 304 skips the page loop) and by
// `sync --probe` (where a 304 skips the whole pipeline).
// ---------------------------------------------------------------------------

/** Drop a probe response body: only its status and ETag are needed. */
async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // A body that is already gone (304 has none) is not an error.
  }
}

/**
 * One conditional request for `llms-full.txt`.
 *
 *   unchanged  304, the stored ETag still describes the official corpus
 *   changed    200 with an ETag (new corpus, or this version had no stored tag)
 *   no-etag    200 without an ETag: unusable as a probe
 *   missing    404/410: this release publishes no whole-corpus file
 *   error      network or protocol failure
 */
export async function probeCorpus(url, etag) {
  const config = loadConfig();
  const headers = {'user-agent': config.fetch?.user_agent || 'mikrotik-manual-mirror/1.0'};
  if (etag) headers['if-none-match'] = etag;
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout((config.fetch?.timeout_seconds || 60) * 1000),
    });
    if (response.status === 304) {
      await discardBody(response);
      return {status: 'unchanged', etag: response.headers.get('etag') || etag};
    }
    if (response.status === 404 || response.status === 410) {
      await discardBody(response);
      return {status: 'missing', etag: null, detail: `HTTP ${response.status}`};
    }
    if (!response.ok) {
      await discardBody(response);
      return {status: 'error', etag: null, detail: `HTTP ${response.status}`};
    }
    const next = response.headers.get('etag') || null;
    await discardBody(response);
    return next ? {status: 'changed', etag: next} : {status: 'no-etag', etag: null};
  } catch (error) {
    return {status: 'error', etag: null, detail: error.message};
  }
}

/**
 * The ETag is only comparable with the same manifest and inventory URL; a
 * changed `source` (route override) or a missing field means "full fetch".
 */
export function storedCorpusEtag(manifest, version, llmsUrl) {
  if (!manifest || manifest.version !== version) return '';
  if (manifest.source && manifest.source !== llmsUrl) return '';
  return typeof manifest.corpus_etag === 'string' ? manifest.corpus_etag : '';
}

/**
 * Every file the previous manifest records must still be on disk before a 304
 * may skip the download. A single missing page forces a full fetch.
 */
export function missingCorpusFiles(manifest, base, docsRoot) {
  if (!manifest?.pages?.length) return ['(manifest has no pages)'];
  const missing = [];
  for (const page of manifest.pages) {
    if (page.origin === 'official') {
      if (!page.local_path || !fs.existsSync(path.join(base, 'docs', page.local_path))) {
        missing.push(page.local_path || '(official page without local_path)');
      }
    } else if (page.origin === 'local') {
      if (!docsRoot || !page.local_path || !fs.existsSync(path.join(docsRoot, page.local_path))) {
        missing.push(page.local_path || '(local page without local_path)');
      }
    }
  }
  return missing;
}
