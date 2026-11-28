#!/usr/bin/env node
/**
 * Remove local pages that the official site no longer publishes.
 *
 * The inventory is the official `llms.txt` for each RouterOS version (it lists
 * every page, including CLI entries) plus the blog/changelog manifest. Pages the
 * mirror generates itself are listed in config/mirror.yml as preserve_pages and
 * are never removed.
 *
 * Two guards were added after a clean-room sync pruned 12 pages that the
 * current official inventory still listed:
 *
 *   - the cached `llms.txt` carries a provenance sidecar (manifest version,
 *     source URL, corpus ETag / generated_at). A cache whose provenance no
 *     longer matches the manifest is refetched; if the refetch fails the
 *     section is skipped instead of pruning with a stale inventory;
 *   - after any deletion, every per-version `structure/index.json` is
 *     reconciled with the pages that actually remain on disk, so
 *     `structure:check` does not report just-deleted pages as
 *     `local page missing`.
 *
 *   node tools/sync/prune-orphans.mjs            # report only
 *   node tools/sync/prune-orphans.mjs --apply    # delete orphans and overlays
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import {SECTIONS, REPO, WORKSPACE, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {docsDir, readJson, routeFromOfficialUrl, sha256, storedCorpusEtag, writeJson} from './lib/upstream.mjs';
import {allVersions, versionForSection, versionPlan} from './lib/versions.mjs';

const APPLY = process.argv.includes('--apply');
const config = YAML.parse(fs.readFileSync(path.join(REPO, 'config/mirror.yml'), 'utf8'));
const preserve = new Set(config.sync?.preserve_pages || []);

/**
 * The inventory is the official `llms.txt` for the version. It is cached under
 * `.work/`, and fetched on demand: relying on a hand-created file made the
 * cleanup silently skip in CI, where nothing had ever written it.
 *
 * A cached file is only trusted with a matching provenance sidecar. The manifest
 * ETag is the corpus-change signal (`storedCorpusEtag` also checks version and
 * source); archived versions have no ETag, so their `generated_at` is used. When
 * either differs the cache is refetched before it can decide what is an orphan.
 */
const LLMS_META_SUFFIX = '.meta.json';

function llmsMetaFile(file) {
  return `${file}${LLMS_META_SUFFIX}`;
}

function cacheIsFresh(meta, plan, manifest, etag) {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.version !== plan.version) return false;
  if (meta.url !== plan.llmsUrl) return false;
  if (etag && meta.etag !== etag) return false;
  const generatedAt = manifest?.generated_at;
  if (generatedAt && meta.manifest_generated_at && meta.manifest_generated_at !== generatedAt) return false;
  return true;
}

async function inventoryFromLlms(plan, manifest) {
  const version = plan.version;
  const file = path.join(WORKSPACE, '.work', `llms-${version.replace(/\./g, '')}.txt`);
  const metaFile = llmsMetaFile(file);
  const etag = storedCorpusEtag(manifest, version, plan.llmsUrl);
  const meta = readJson(metaFile);
  const exists = fs.existsSync(file);
  const fresh = exists && cacheIsFresh(meta, plan, manifest, etag);
  llmsReport[version] = {
    url: plan.llmsUrl,
    expected_etag: etag,
    expected_generated_at: manifest?.generated_at || null,
    cached_version: meta?.version ?? null,
    cached_url: meta?.url ?? null,
    cached_etag: meta?.etag ?? null,
    fresh,
    action: fresh ? 'reused' : 'refetch',
  };
  if (exists && !fresh) {
    const why = !meta
      ? 'no provenance sidecar'
      : meta.version !== version
        ? `version ${meta.version} != ${version}`
        : meta.url !== plan.llmsUrl
          ? `source ${meta.url} != ${plan.llmsUrl}`
          : etag
            ? `corpus ETag ${meta.etag} != ${etag}`
            : `manifest generated_at ${meta.manifest_generated_at} != ${manifest?.generated_at}`;
    console.warn(`llms cache ${path.relative(WORKSPACE, file)} is stale (${why}); refetching ${plan.llmsUrl}`);
  }
  if (!fresh) {
    const url = plan.llmsUrl;
    try {
      const response = await fetch(url, {headers: {'user-agent': 'mikrotik-manual-i18n/2.0'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!/manual\.mikrotik\.com\/docs\//.test(text)) {
        throw new Error('fetched llms.txt has no official doc links');
      }
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, text);
      fs.writeFileSync(
        metaFile,
        `${JSON.stringify(
          {
            version,
            url,
            etag,
            manifest_generated_at: manifest?.generated_at || null,
            fetched_at: new Date().toISOString(),
            sha256: sha256(text),
            lines: text.split('\n').length,
          },
          null,
          2,
        )}\n`,
      );
      console.log(`fetched ${url}`);
    } catch (error) {
      // A stale inventory is never a safe basis for deletion: keep the pages.
      llmsReport[version].action = 'refetch-failed-skip';
      console.warn(
        `cannot fetch ${url}: ${error.message}; skipping ${plan.sectionName} ` +
          '(stale inventory is not trusted for deletion)',
      );
      return null;
    }
  }
  const text = fs.readFileSync(file, 'utf8');
  // The inventory may be versioned (`/docs/7.25/x.md`) or unversioned
  // (`/docs/x.md`, the current tree); both normalise to the same local id.
  const routes = new Set(
    [...text.matchAll(/https:\/\/manual\.mikrotik\.com\/docs\/[^)\s]+\.md/g)].map((match) =>
      routeFromOfficialUrl(match[0]),
    ),
  );
  return routes;
}

const idOf = (rel) => rel.replace(/\.md$/, '').replace(/\/index$/, '');

async function expectedDocPaths(plan, manifest) {
  const routes = await inventoryFromLlms(plan, manifest);
  if (!routes) return null;
  // Official links and local files differ only in whether a directory page is
  // written as "x" or "x/index"; compare normalised ids.
  return new Set([...routes].map(idOf));
}

/**
 * Reconcile one version's structure index with the pages that remain on disk.
 * Exported so it can be exercised with an offline fixture. `index` may be passed
 * by the caller; when omitted it is loaded from `indexFile`. Only `apply` writes.
 *
 * Idempotent: a second run over the already-reconciled index drops nothing and
 * writes no file. `pruned_pages` records what was dropped for audit; every other
 * entry is carried over unchanged.
 */
export function reconcileStructureIndex({
  version,
  index = null,
  indexFile = null,
  docsRoot,
  removedRels = new Set(),
  apply = false,
}) {
  const current = index ?? (indexFile ? readJson(indexFile) : null);
  if (!current || !Array.isArray(current.pages)) {
    return {version, before: 0, after: 0, dropped: [], justRemoved: [], changed: false, index: current};
  }
  const before = current.pages.length;
  const kept = [];
  const dropped = [];
  for (const page of current.pages) {
    const rel = page?.local_path;
    // A malformed entry has no local_path: keep it and let structure:check flag
    // it — reconciliation must never silently discard a record it cannot judge.
    if (!rel || fs.existsSync(path.join(docsRoot, rel))) {
      kept.push(page);
    } else {
      dropped.push(rel);
    }
  }
  const uniqueDropped = [...new Set(dropped)].sort();
  const changed = uniqueDropped.length > 0;
  const next = {
    ...current,
    pages: kept,
    totals: {...(current.totals || {}), pages: kept.length},
    pruned_pages: [...new Set([...(current.pruned_pages || []), ...uniqueDropped])].sort(),
  };
  if (changed && apply && indexFile) writeJson(indexFile, next);
  return {
    version,
    before,
    after: kept.length,
    dropped: uniqueDropped,
    justRemoved: uniqueDropped.filter((rel) => removedRels.has(rel)).sort(),
    changed,
    index: next,
    indexFile,
  };
}

let removed = 0;
const report = {sections: {}};
const llmsReport = {};
const removedByVersion = new Map();

function noteRemoved(version, rel) {
  if (!version) return;
  if (!removedByVersion.has(version)) removedByVersion.set(version, new Set());
  removedByVersion.get(version).add(rel);
}

function remove(file) {
  removed++;
  console.log(APPLY ? 'REMOVE' : 'WOULD-REMOVE', relative(REPO, file));
  if (APPLY) fs.rmSync(file);
}

function pruneSection(section, expected, version = null) {
  const base = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  const files = walkMarkdown(base);
  const stats = {files: files.length, orphanPages: 0, orphanOverlays: 0};
  const kept = new Set();

  for (const file of files) {
    const rel = relative(base, file);
    if (expected && !expected.has(idOf(rel)) && !preserve.has(idOf(rel))) {
      stats.orphanPages++;
      remove(file);
      noteRemoved(version, rel);
      const overlay = path.join(overlayBase, rel);
      if (fs.existsSync(overlay)) {
        stats.orphanOverlays++;
        remove(overlay);
      }
      continue;
    }
    kept.add(rel);
  }

  // Two spellings of the same page: keep the directory form, drop the flat one.
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const flat = relative(base, file);
    if (flat.endsWith('/index.md')) continue;
    const dirForm = path.join(base, flat.replace(/\.md$/, ''), 'index.md');
    if (!fs.existsSync(dirForm)) continue;
    stats.duplicates = (stats.duplicates || 0) + 1;
    remove(file);
    noteRemoved(version, flat);
    const overlay = path.join(overlayBase, flat);
    if (fs.existsSync(overlay)) {
      stats.orphanOverlays++;
      remove(overlay);
    }
    kept.delete(flat);
  }

  // An overlay whose English page is gone is always an orphan.
  if (fs.existsSync(overlayBase)) {
    for (const overlay of walkMarkdown(overlayBase)) {
      const rel = relative(overlayBase, overlay);
      if (!kept.has(rel)) {
        stats.orphanOverlays++;
        remove(overlay);
      }
    }
  }

  report.sections[section.name] = stats;
}

/**
 * IDs (`idOf` spelling) from the fetch product manifest of a section. Returns
 * null when neither the new manifest nor the legacy seed has usable entries,
 * so a missing/empty inventory can never trigger a mass prune.
 */
function expectedSectionIds(name) {
  const manifestFile = path.join(REPO, 'data/manifests', `${name}.json`);
  if (fs.existsSync(manifestFile)) {
    const manifest = readJson(manifestFile);
    const pages = manifest?.pages || [];
    if (pages.length) {
      return new Set(
        pages.map((page) => {
          const rel = String(page.local_path || `${name}/${page.slug}.md`).replace(/\\/g, '/');
          return rel.replace(new RegExp(`^${name}/`), '').replace(/\.md$/, '').replace(/\/index$/, '');
        }),
      );
    }
  }
  if (name === 'blog' || name === 'changelog') {
    const legacy = path.join(REPO, 'data/manifests/blog-changelog.json');
    if (fs.existsSync(legacy)) {
      const urls = readJson(legacy)?.[name] || [];
      const ids = new Set(
        urls
          .filter((url) => !url.includes('/page/'))
          .map((url) => url.replace(/\/+$/, '').split('/').at(-1)),
      );
      if (ids.size) return ids;
    }
  }
  return null;
}

function reconcileStructureIndexes() {
  const results = [];
  // Iterate every version, not just those pruned this run: a previous run may
  // have deleted pages without updating the index (the clean-room state).
  for (const version of allVersions()) {
    const indexFile = path.join(REPO, 'upstream', version, 'structure', 'index.json');
    if (!fs.existsSync(indexFile)) continue;
    const result = reconcileStructureIndex({
      version,
      indexFile,
      docsRoot: docsDir(version),
      removedRels: removedByVersion.get(version) || new Set(),
      apply: APPLY,
    });
    results.push(result);
    if (result.changed) {
      console.log(
        `structure-index ${version}: dropped ${result.dropped.length} page(s) ` +
          `(${result.justRemoved.length} pruned this run), ${result.before} -> ${result.after}` +
          (APPLY ? '' : ' (dry run)'),
      );
      for (const rel of result.dropped.slice(0, 5)) console.log(`  STALE-INDEX ${rel}`);
      if (result.dropped.length > 5) console.log(`  ... and ${result.dropped.length - 5} more`);
    } else {
      console.log(`structure-index ${version}: ${result.after} page(s), already consistent`);
    }
  }
  return results;
}

async function main() {
  for (const section of SECTIONS) {
    const version = versionForSection(section.name);
    if (version) {
      const plan = versionPlan(version);
      const manifestFile = path.join(REPO, plan.manifest);
      // versions.json lists archives a cold start has not materialised: no
      // upstream manifest means there is nothing to prune for that version.
      if (!fs.existsSync(manifestFile)) {
        console.warn(
          `WARNING: prune-orphans: ${path.relative(REPO, manifestFile)} missing; ` +
            `version ${version} is not materialized, skipping ${section.name}`,
        );
        continue;
      }
      const expected = await expectedDocPaths(plan, readJson(manifestFile));
      if (!expected) {
        console.log(`SKIP ${section.name}: cannot read ${plan.llmsUrl}`);
        continue;
      }
      pruneSection(section, expected, version);
    } else if (['hardware', 'blog', 'changelog'].includes(section.name)) {
      // All three sections are now fetch products with their own page-level
      // manifest. The old blog-changelog.json is only a legacy seed: it is
      // consulted when the new manifest is absent so an old checkout does not
      // prune everything, but it is never authoritative.
      const expected = expectedSectionIds(section.name);
      if (!expected) {
        console.warn(
          `WARNING: prune-orphans: no usable manifest for ${section.name}; skipping it`,
        );
        continue;
      }
      pruneSection(section, expected);
    } else {
      pruneSection(section, null);
    }
  }

  // The full `index` body is intentionally omitted from the report (it is ~1.5k
  // pages per version); only the reconciliation summary is emitted.
  const structure = reconcileStructureIndexes().map(({index: _index, ...summary}) => summary);
  console.log(JSON.stringify({removed, apply: APPLY, llms: llmsReport, structure, sections: report.sections}, null, 1));
  if (removed && !APPLY) console.log('dry run only; re-run with --apply to delete');
}

// Keep the module importable for offline fixture tests: the sync pipeline runs
// it as a script, in which case `main()` executes; importing it only registers
// the exported helpers.
const invoked = process.argv[1] && fs.existsSync(process.argv[1]) ? fs.realpathSync(process.argv[1]) : '';
const self = fs.realpathSync(fileURLToPath(import.meta.url));
if (invoked === self) await main();
