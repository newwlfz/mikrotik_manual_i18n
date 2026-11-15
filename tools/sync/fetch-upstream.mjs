#!/usr/bin/env node
/**
 * Fetch the official Markdown corpus into upstream/<version>/docs.
 *
 * The page inventory comes from the official `llms.txt`; each link is the exact
 * `.md` endpoint. Files are stored as raw bytes (no newline or encoding
 * rewriting) and recorded in a manifest with sha256.
 *
 * Before the page loop one conditional GET asks for `llms-full.txt` (the
 * whole-corpus file) with the `corpus_etag` stored in the previous manifest. A
 * 304 means the official corpus is unchanged, so the page loop is skipped after
 * verifying that every recorded local file still exists. Anything else (200,
 * missing ETag, 404, network error) falls back to the full download, so a
 * failed probe can never silently skip pages.
 *
 *   node tools/sync/fetch-upstream.mjs --all
 *   node tools/sync/fetch-upstream.mjs --version=7.25
 *   node tools/sync/fetch-upstream.mjs --version=7.25 --check   # full read-only run
 *   node tools/sync/fetch-upstream.mjs --version=7.25 --limit=5
 *   node tools/sync/fetch-upstream.mjs --version=7.25 --force   # ignore the etag
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  docsDir,
  ensureDir,
  loadConfig,
  localPathForRoute,
  manifestPath,
  missingCorpusFiles,
  normaliseSourceUrl,
  pageFrontmatter,
  probeCorpus,
  readJson,
  routeFromOfficialUrl,
  sha256,
  sortedPages,
  buildSourceMap,
  storedCorpusEtag,
  writeBuffer,
  writeJson,
} from './lib/upstream.mjs';
import {parseOfficial} from './lib/official-md.mjs';
import {REPO} from '../translate/lib/paths.mjs';
import {allVersions, knownVersion, versionPlan} from './lib/versions.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const CHECK = process.argv.includes('--check');
const FORCE = process.argv.includes('--force');
const ALL = process.argv.includes('--all');
const LIMIT = Number(arg('limit', '0'));
const CONCURRENCY = Number(arg('concurrency', '0'));
const REQUESTED = arg('version', '');
const config = loadConfig();
const versions = REQUESTED ? [REQUESTED] : allVersions();

function parseLlms(text, version, origin = 'https://manual.mikrotik.com') {
  // The inventory links point at the same origin that served llms.txt; building
  // the pattern from it keeps a local mock (or an override on another host)
  // parseable without hard-coding the official host.
  const escaped = String(origin)
    .replace(/\/+$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\[([^\\]]+)\\]\\((${escaped}\\/docs\\/[^)\\s]+\\.md)\\)`, 'g');
  const pages = [];
  const seen = new Set();
  let match;
  while ((match = pattern.exec(text))) {
    const url = match[2];
    const key = normaliseSourceUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    pages.push({url, route: routeFromOfficialUrl(url, version), label: match[1].trim()});
  }
  return pages;
}

/**
 * `fetch.retry_limit` is the single source of truth for attempts per request;
 * the literal only covers an absent or invalid key.
 */
function retryLimit() {
  const configured = Number(config.fetch?.retry_limit);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 3;
}

async function fetchWithRetry(url, attempts = retryLimit()) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': config.fetch?.user_agent || 'mikrotik-manual-mirror/1.0'},
        signal: AbortSignal.timeout((config.fetch?.timeout_seconds || 60) * 1000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw last;
}

/** The `source:` line of a page's frontmatter, as an absolute URL. */
function declaredSource(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!front) return null;
  const line = /^source:[ \t]*(\S+)[ \t]*$/m.exec(front[1]);
  return line ? normaliseSourceUrl(line[1]) : null;
}

/**
 * Does the official site still serve this page? Only asked for a page the
 * inventory no longer lists, and only to tell two very different cases apart:
 * the mirror's own page (adopt it) and a page the release dropped (leave it out
 * of the manifest so `prune-orphans` deletes it instead of the fetch
 * resurrecting it every day). 404/410 is the only answer that means "gone"; a
 * network error keeps the page, because deleting on a timeout is worse.
 */
async function stillServed(url) {
  try {
    const response = await fetch(url, {
      headers: {'user-agent': config.fetch?.user_agent || 'mikrotik-manual-mirror/1.0'},
      signal: AbortSignal.timeout((config.fetch?.timeout_seconds || 60) * 1000),
    });
    await response.body?.cancel();
    return response.status !== 404 && response.status !== 410;
  } catch {
    return true;
  }
}

function pickLocalPath(candidates) {
  if (!candidates?.length) return null;
  if (candidates.length === 1) return candidates[0];
  // Prefer the flat route; directory aliases are kept as local duplicates.
  return [...candidates].sort((a, b) => Number(a.endsWith('/index.md')) - Number(b.endsWith('/index.md')))[0];
}

async function processVersion(version) {
  // A release that is not installed yet has no local tree to reconcile with;
  // mapping its pages against the *previous* tree would mis-assign every path.
  const plan = versionPlan(version, {prospective: !knownVersion(version)});
  const base = plan.upstreamDir;
  const docsRoot = plan.prospective ? null : docsDir(version);
  const llmsUrl = plan.llmsUrl;
  const manifestFile = path.join(REPO, plan.manifest);
  const docsManifest = readJson(manifestFile);
  const previousEtag = storedCorpusEtag(docsManifest, version, llmsUrl);
  let corpusEtag = previousEtag || null;
  // A prefix fetch writes a partial page list; recording the corpus ETag for it
  // would let the next full run skip pages the manifest never listed.
  if (LIMIT) corpusEtag = null;

  // `--force` means "download everything", `--check` is a verification pass
  // that must keep comparing every byte, and `--limit` only fetches a prefix:
  // none of them may take the 304 shortcut.
  if (!FORCE && !CHECK && !LIMIT) {
    const probe = await probeCorpus(plan.llmsFullUrl, previousEtag);
    if (probe.status === 'unchanged') {
      if (probe.etag) corpusEtag = probe.etag;
      const missing = missingCorpusFiles(docsManifest, base, docsRoot);
      const priorFailures = (docsManifest?.failures || []).length;
      if (!missing.length && !priorFailures) {
        const skipped =
          docsManifest.totals?.official ??
          (docsManifest.pages || []).filter((page) => page.origin === 'official').length;
        console.log(
          `[${version}] corpus unchanged (etag ${probe.etag}): skip fetching ${skipped} pages`,
        );
        const stats = {
          official: skipped,
          local: docsManifest.totals?.local ?? 0,
          written: 0,
          unchanged: 0,
          failed: 0,
          skipped,
        };
        // A skipped run is a no-op on disk: the previous manifest stays accurate.
        console.log(
          `[${version}] done official=${stats.official} local=${stats.local} deleted=0 written=0 unchanged=0 skipped=${stats.skipped} failed=0`,
        );
        return {version, manifest: docsManifest, stats, failures: [], skipped: true};
      }
      const reason = missing.length
        ? `${missing.length} local file(s) missing (${missing[0]})`
        : `${priorFailures} recorded failure(s)`;
      console.warn(`[${version}] corpus unchanged but ${reason}; falling back to full fetch`);
    } else if (probe.status === 'missing') {
      corpusEtag = null;
      console.log(`[${version}] no whole-corpus file (${plan.llmsFullUrl}): full fetch`);
    } else if (probe.status === 'error') {
      console.warn(`[${version}] corpus probe failed (${probe.detail}); falling back to full fetch`);
    } else if (probe.status === 'no-etag') {
      corpusEtag = null;
      console.log(`[${version}] whole-corpus file has no ETag: full fetch`);
    } else if (probe.etag) {
      corpusEtag = probe.etag;
      console.log(
        previousEtag
          ? `[${version}] corpus changed (etag ${previousEtag} -> ${corpusEtag}): full fetch`
          : `[${version}] corpus etag ${corpusEtag}: full fetch`,
      );
    }
  } else if (FORCE) {
    console.log(`[${version}] --force: ignoring corpus etag`);
  }

  console.log(`[${version}] llms ${llmsUrl}`);
  const llms = (await fetchWithRetry(llmsUrl)).toString('utf8');
  const inventory = parseLlms(llms, plan.version, new URL(llmsUrl).origin);
  console.log(`[${version}] official pages ${inventory.length}`);

  const sourceMap = plan.prospective ? {byUrl: new Map(), files: []} : buildSourceMap(version);
  const planned = inventory.map((item) => {
    const key = normaliseSourceUrl(item.url);
    const candidates = sourceMap.byUrl.get(key) || [];
    let localPath = pickLocalPath(candidates);
    let mapping = localPath ? (candidates.length > 1 ? 'source-frontmatter+multiple' : 'source-frontmatter') : '';
    if (!localPath) {
      localPath = localPathForRoute(version, item.route, {prospective: plan.prospective});
      mapping = localPath ? 'route-heuristic' : '';
    }
    if (!localPath) {
      // A page the mirror has never seen: the official export addresses it as
      // `<route>.md`, and a flat file serves the same route. This is not only a
      // version-bump case — the official site also *adds* pages to a release it
      // already publishes (7.26 gained `wireless/wifi/configuring-meshpoint`
      // and `firewall-and-quality-of-service/firewall/raw`), and a refresh must
      // materialise them instead of failing the whole run.
      localPath = `${item.route}.md`;
      mapping = 'route-new';
      console.log(`[${version}] new page ${item.route} -> ${localPath}`);
    }
    return {...item, localPath, mapping};
  });
  const plannedPaths = new Set(planned.map((item) => item.localPath).filter(Boolean));
  const pages = [];
  const failures = [];
  const stats = {official: 0, local: 0, written: 0, unchanged: 0, failed: 0, skipped: 0, deleted: 0};
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= planned.length || (LIMIT && index >= LIMIT)) return;
      const item = planned[index];
      if (!item.localPath) {
        failures.push({route: item.route, url: item.url, error: 'no local path mapping'});
        stats.failed++;
        console.error(`[${version}] FAIL ${item.route}: no local path mapping`);
        continue;
      }
      const localPath = item.localPath;
      const mapping = item.mapping;
      try {
        const raw = await fetchWithRetry(item.url);
        const hash = sha256(raw);
        const target = path.join(base, 'docs', localPath);
        const existing = fs.existsSync(target) ? fs.readFileSync(target) : null;
        const unchanged = existing && sha256(existing) === hash;
        if (!CHECK && !unchanged) {
          writeBuffer(target, raw);
          stats.written++;
        } else if (unchanged) {
          stats.unchanged++;
        }
        const parsed = parseOfficial(raw.toString('utf8'));
        const frontmatter = pageFrontmatter(version, localPath, {prospective: plan.prospective});
        if (!frontmatter.mirror.source) frontmatter.mirror.source = item.url.replace(/\.md$/i, '');
        pages.push({
          route: item.route,
          origin: 'official',
          mapping,
          local_path: localPath,
          source_url: item.url,
          sha256: hash,
          bytes: raw.length,
          official_title: parsed.title,
          official_summary: parsed.summary,
          frontmatter,
        });
        stats.official++;
        if (stats.official % 100 === 0) console.log(`[${version}] ${stats.official}/${inventory.length}`);
      } catch (error) {
        failures.push({route: item.route, url: item.url, error: error.message});
        stats.failed++;
        console.error(`[${version}] FAIL ${item.route}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({length: Math.max(1, CONCURRENCY || config.fetch?.concurrency || 6)}, worker));

  // Anything in the current English tree that the official inventory does not
  // list is either a mirror-owned local page (recorded under
  // corrections/local-pages: copy its source there) or a page the official site
  // has dropped. A dropped page must stay out of the manifest: `prune-orphans`
  // deletes it from `docs/` anyway, and adopting it here would make the next
  // fetch resurrect it, forever.
  const localOnly = sourceMap.files.filter((rel) => !plannedPaths.has(rel)).sort();
  const deleted = [];
  for (const rel of localOnly) {
    const source = path.join(docsRoot, rel);
    const localSource = path.join('corrections/local-pages', plan.docsDir, rel);
    const target = path.join(REPO, localSource);
    const raw = fs.readFileSync(source);
    const hash = sha256(raw);
    const frontmatter = pageFrontmatter(version, rel, {prospective: plan.prospective});
    if (!fs.existsSync(target)) {
      const sourceUrl = declaredSource(raw.toString('utf8'));
      if (sourceUrl && !(await stillServed(sourceUrl))) {
        deleted.push(rel);
        stats.deleted++;
        console.log(`[${version}] dropped ${rel}: the official site no longer serves ${sourceUrl}`);
        continue;
      }
    }
    if (fs.existsSync(target)) {
      const existingHash = sha256(fs.readFileSync(target));
      if (existingHash !== hash) {
        failures.push({route: rel, url: null, error: `local source conflict: ${localSource}`});
        stats.failed++;
        continue;
      }
    } else if (!CHECK) {
      ensureDir(path.dirname(target));
      fs.writeFileSync(target, raw);
    }
    const localRoute = rel.replace(/\.md$/i, '');
    pages.push({
      route: localRoute,
      duplicate_of: localRoute.endsWith('/index') ? localRoute.slice(0, -'/index'.length) : undefined,
      origin: 'local',
      mapping: 'local-source',
      local_path: rel,
      local_source: localSource,
      source_url: null,
      sha256: hash,
      bytes: raw.length,
      frontmatter,
    });
    stats.local++;
  }

  const manifest = {
    schema: 1,
    section: 'docs',
    version,
    route_version: plan.version,
    generated_at: new Date().toISOString(),
    source: llmsUrl,
    // ETag of the whole-corpus file seen by the last full fetch. Absent means
    // the next run cannot probe and downloads every page (old manifests are
    // compatible: no field, no shortcut).
    corpus_etag: corpusEtag || undefined,
    docs_dir: plan.docsDir,
    upstream_dir: base,
    totals: {
      official: stats.official,
      local: stats.local,
      pages: pages.length,
      written: stats.written,
      unchanged: stats.unchanged,
      failed: stats.failed,
      skipped: stats.skipped,
      // Pages the official site stopped serving. They stay out of `pages` so
      // `prune-orphans` removes them; kept here as the fetch's own record.
      deleted: stats.deleted,
    },
    pages: sortedPages(pages),
    deleted: deleted.sort(),
    failures,
  };
  if (!CHECK) writeJson(manifestFile, manifest);

  console.log(
    `[${version}] done official=${stats.official} local=${stats.local} deleted=${stats.deleted} written=${stats.written} unchanged=${stats.unchanged} skipped=${stats.skipped} failed=${stats.failed}`,
  );
  return {version, manifest, stats, failures};
}

const results = [];
for (const version of versions) {
  results.push(await processVersion(version));
}
const failed = results.reduce((sum, result) => sum + result.failures.length, 0);
if (failed) {
  console.error(`upstream fetch completed with ${failed} failure(s)`);
  process.exitCode = 1;
}
