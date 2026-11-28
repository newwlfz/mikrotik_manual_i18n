#!/usr/bin/env node
/**
 * Sidebar consistency checks, in two layers.
 *
 * Offline (always runs, including CI): only committed data — the crawled
 * sidebar manifest (`data/manifests/docs-<v>-sidebar.json`), the generated tree
 * (`sidebars.ts` / `versioned_sidebars/version-<v>-sidebars.json`) and the docs
 * trees themselves. This catches the failures a new release introduces: a doc
 * that fell out of the sidebar, one listed twice, a category left empty, an id
 * that no longer has a file.
 *
 * Online (only when `data/nav/<v>/` exists, i.e. after `npm run sidebar:crawl`):
 * the crawl-derived invariants. `crawl-nav.mjs` identifies a category by its
 * label path, which is only sound while a handful of invariants hold; every
 * cached observation must agree, so a crawl that would silently merge two
 * categories fails here instead of surfacing as a wrong sidebar months later.
 * `data/nav/` is git-ignored, so a missing cache prints SKIP and exits 0;
 * `--strict` turns that into a failure (use it after a crawl).
 *
 *   node tools/verify/sidebar-consistency.mjs [--version=7.24] [--strict]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {allVersions, currentVersion} from '../sync/lib/versions.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const requested = argv.find((arg) => arg.startsWith('--version='));
const versions = requested ? [requested.split('=')[1]] : allVersions();

const docsDirFor = (version) =>
  version === currentVersion() ? 'docs' : `versioned_docs/version-${version}`;

function loadSidebarsTs(file) {
  const text = fs.readFileSync(file, 'utf8');
  return JSON.parse(
    text.slice(text.indexOf('= {') + 2, text.lastIndexOf('};') + 1).replace(/,\s*([}\]])/g, '$1'),
  ).docs;
}

const sidebarTreeFile = (version) =>
  version === currentVersion()
    ? path.join(REPO, 'sidebars.ts')
    : path.join(REPO, `versioned_sidebars/version-${version}-sidebars.json`);

/** `null` means the version was never materialised (e.g. a cold start). */
function treeDocs(version) {
  const file = sidebarTreeFile(version);
  if (!fs.existsSync(file)) return null;
  return version === currentVersion() ? loadSidebarsTs(file) : JSON.parse(fs.readFileSync(file, 'utf8')).docs;
}

const docIds = (items, out = []) => {
  for (const item of items) {
    if (item.type === 'doc' || item.type === 'ref') out.push(item.id);
    else if (item.type === 'category') {
      if (item.link?.id) out.push(item.link.id);
      docIds(item.items || [], out);
    }
  }
  return out;
};
const normalized = (id) => id.replace(/\/index$/, '');

// --- Version comparison position -------------------------------------------
// The crawled manifest and the generated tree spell the same entry differently
// (`.../compare-versions/index` doc vs. a link to
// `/docs/cli-reference/compare-versions/`). Normalise both before comparing
// positions; the type of the entry (doc/link) is not part of the contract.
const COMPARE_ROUTE = 'cli-reference/compare-versions';
const COMPARE_LABELS = new Set(['Version comparison', '版本比较']);
const normalizeCompare = (value) =>
  String(value ?? '')
    .replace(/^\/docs\//, '')
    .replace(/\/index$/, '')
    .replace(/\/$/, '');
const isCompareItem = (item) =>
  COMPARE_LABELS.has(String(item?.label ?? '').trim()) ||
  [item?.id, item?.link?.id, item?.href, item?.link?.href].some(
    (value) => normalizeCompare(value) === COMPARE_ROUTE,
  );
/** Finds the CLI Reference category in a generated tree (`items`) or crawl cache (`children`). */
function cliReference(items, childKey = 'items') {
  for (const item of items || []) {
    if (/^cli reference$/i.test(String(item?.label ?? '').trim())) return item;
    const found = cliReference(item?.[childKey] || [], childKey);
    if (found) return found;
  }
  return null;
}
const compareIndex = (cli, childKey = 'items') => (cli?.[childKey] || []).findIndex(isCompareItem);

/** Offline authority: the crawled manifest. A missing entry means "append at end". */
function comparePositionMismatch(tree, manifest) {
  const treeCli = cliReference(tree);
  const manifestCli = cliReference(manifest);
  if (!treeCli || !manifestCli) {
    return [`CLI Reference missing (tree=${Boolean(treeCli)}, manifest=${Boolean(manifestCli)})`];
  }
  const treeItems = treeCli.items || [];
  const manifestItems = manifestCli.items || [];
  const treeIdx = compareIndex(treeCli);
  const manifestIdx = compareIndex(manifestCli);
  // Current version: the crawl lists the entry, so it must be replaced in place.
  // Archived versions: the crawl has no entry, so the appended link belongs at
  // the end (index === manifest item count).
  const officialIdx = manifestIdx === -1 ? manifestItems.length : manifestIdx;
  const hits = [];
  const occurrences = treeItems.filter(isCompareItem).length;
  if (occurrences !== 1) hits.push(`${occurrences} Version comparison entries in the tree`);
  if (treeIdx !== officialIdx) {
    hits.push(`tree index=${treeIdx}, official index=${officialIdx} (manifest index=${manifestIdx}, cli items=${manifestItems.length})`);
  }
  return hits;
}

/** Does a Docusaurus doc id resolve to a committed file in this version? */
function docFileExists(version, id) {
  const dir = path.join(REPO, docsDirFor(version));
  for (const suffix of ['.md', '.mdx']) {
    if (fs.existsSync(path.join(dir, `${id}${suffix}`))) return true;
    if (fs.existsSync(path.join(dir, id, `index${suffix}`))) return true;
  }
  return false;
}

/** Labels repeated among the direct children of one level. */
function repeatedSiblings(items, trail = [], out = []) {
  const labels = items.map((item) => item.label);
  const repeated = labels.filter((label, index) => labels.indexOf(label) !== index);
  if (repeated.length) {
    out.push(`${trail.join('/') || '(root)'}: ${[...new Set(repeated)].join(', ')}`);
  }
  for (const item of items) {
    if (item.type === 'category') repeatedSiblings(item.items || [], [...trail, item.label], out);
  }
  return out;
}

/** Checks that need nothing but committed data. */
function offline(version) {
  const tree = treeDocs(version);
  if (!tree) return null;
  const treeIds = docIds(tree);
  const treeNorm = treeIds.map(normalized);
  const manifestPath = path.join(REPO, `data/manifests/docs-${version}-sidebar.json`);
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).docs
    : null;
  const manifestNorm = (manifest ? docIds(manifest) : []).map(normalized);

  const categories = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.type !== 'category') continue;
      categories.push(item);
      walk(item.items || []);
    }
  };
  walk(tree);

  const duplicated = treeNorm.filter((id, index) => treeNorm.indexOf(id) !== index);
  const missingFiles = [...new Set([...manifestNorm, ...treeNorm])]
    .filter((id) => !docFileExists(version, id))
    .map((id) => `${id} (${docsDirFor(version)})`);

  return {
    manifestMissing: !manifest,
    header:
      `${manifestNorm.length} docs in manifest, ${treeNorm.length} in sidebar, ` +
      `${categories.length} categories`,
    dropped: manifestNorm.filter((id) => !treeNorm.includes(id)),
    extra: treeNorm.filter((id) => !manifestNorm.includes(id)),
    duplicated: [...new Set(duplicated)],
    comparePositionMismatch: comparePositionMismatch(tree, manifest),
    missingFiles,
    emptyCategories: categories
      .filter((item) => !item.items?.length)
      .map((item) => item.label ?? item.key),
    unlabelled: categories
      .filter((item) => !String(item.label ?? '').trim())
      .map((item) => item.key ?? '(category)'),
    duplicateSiblings: repeatedSiblings(tree),
  };
}

/** Checks that need the git-ignored crawl cache. */
function online(version) {
  const dir = path.join(REPO, `data/nav/${version}`);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
  const paths = new Map(); // path -> {parents, hrefs, childSets}
  const byHref = new Map(); // href -> Set(labels)
  const duplicateSiblings = [];
  const generationCounts = new Map(); // generation -> files ("MISSING" for legacy snapshots)
  const compareNavIndices = new Set();

  const visit = (entries, parent, file) => {
    const labels = entries.map((entry) => entry.label);
    const repeated = labels.filter((label, index) => labels.indexOf(label) !== index);
    if (repeated.length) duplicateSiblings.push(`${file}: ${[...new Set(repeated)].join(', ')}`);

    for (const entry of entries) {
      const labelPath = parent ? `${parent}\u001f${entry.label}` : entry.label;
      const record = paths.get(labelPath) || {parents: new Set(), hrefs: new Set(), childSets: new Set()};
      paths.set(labelPath, record);
      record.parents.add(parent);
      record.hrefs.add(entry.href || '');
      if (entry.children?.length) {
        record.childSets.add(
          entry.children.map((child) => `${child.label}\u001f${child.href || ''}`).sort().join('\u001e'),
        );
      }
      if (entry.href) {
        if (!byHref.has(entry.href)) byHref.set(entry.href, new Set());
        byHref.get(entry.href).add(entry.label);
      }
      if (entry.children?.length) visit(entry.children, labelPath, file);
    }
  };

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const generation = data.generation || 'MISSING';
    if (!generationCounts.has(generation)) generationCounts.set(generation, []);
    generationCounts.get(generation).push(file);
    visit(data.sidebar || [], '', file);
    // Online authority: every cached snapshot must report one compare index.
    const cli = cliReference(data.sidebar || [], 'children');
    if (cli) {
      const index = compareIndex(cli, 'children');
      if (index >= 0) compareNavIndices.add(index);
    }
  }

  // Cache-generation coherence: every snapshot must come from the same crawl.
  // The largest cohort is the reference; any other cohort (including snapshots
  // with no generation field, i.e. the pre-fix cache) is stale. A uniformly
  // legacy cache has a single cohort and is not a *mix* — the crawler treats it
  // as stale and refetches it on its next run.
  // Selftest: point a copied tools tree at a temp data/nav/<version> holding two
  // snapshots with different `generation` values; expect FAIL below and exit 1.
  const cohorts = [...generationCounts.entries()].sort((a, b) => b[1].length - a[1].length);
  const reference = cohorts[0]?.[0] ?? null;
  const staleCacheGeneration =
    cohorts.length > 1
      ? cohorts
          .filter(([generation]) => generation !== reference)
          .flatMap(([generation, cohort]) => cohort.map((file) => `${file}: ${generation}`))
      : [];

  return {
    header: `${files.length} pages, ${paths.size} label paths, ${generationCounts.size} generation(s)`,
    staleCacheGeneration,
    multiParent: [...paths].filter(([, record]) => record.parents.size > 1),
    multiHref: [...paths].filter(([, record]) => record.hrefs.size > 1),
    conflictingChildren: [...paths].filter(([, record]) => record.childSets.size > 1),
    unstableLabels: [...byHref].filter(([, labels]) => labels.size > 1),
    duplicateSiblings,
    comparePositionMismatch: (() => {
      if (compareNavIndices.size !== 1) {
        return [`crawl cache compare indices: ${[...compareNavIndices].join(',') || 'none'}`];
      }
      const tree = treeDocs(version);
      const treeCli = tree ? cliReference(tree) : null;
      const treeIdx = treeCli ? compareIndex(treeCli) : -1;
      const officialIdx = [...compareNavIndices][0];
      return treeIdx === officialIdx
        ? []
        : [`tree index=${treeIdx}, crawl index=${officialIdx}`];
    })(),
  };
}

let offlineFailed = false;
let onlineFailed = false;
const onlineSkipped = [];
const onlineRan = [];

function report(lines, header) {
  let failed = false;
  console.log(`  ${header}`);
  for (const [name, hits] of lines) {
    const ok = hits.length === 0;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}: ${hits.length}`);
    if (!ok) {
      failed = true;
      for (const hit of hits.slice(0, 5)) console.log(`       ${String(hit).slice(0, 160)}`);
    }
  }
  return failed;
}

for (const version of versions) {
  const local = offline(version);
  console.log(`${version} offline`);
  if (!local) {
    console.warn(
      `WARNING: skip ${version}: ${path.relative(REPO, sidebarTreeFile(version))} missing; ` +
        `${docsDirFor(version)} not materialized`,
    );
    continue;
  }
  if (local.manifestMissing) {
    console.log(`  FAIL manifest: 0 (data/manifests/docs-${version}-sidebar.json missing)`);
    offlineFailed = true;
  } else {
    offlineFailed =
      report(
        [
          ['documents missing from the sidebar', local.dropped],
          ['sidebar documents absent from the manifest', local.extra],
          ['documents listed twice', local.duplicated],
          ['compare position mismatch', local.comparePositionMismatch],
          ['documents with no file', local.missingFiles],
          ['empty categories in the tree', local.emptyCategories],
          ['categories without a label', local.unlabelled],
          ['duplicate sibling labels in the tree', local.duplicateSiblings],
        ],
        local.header,
      ) || offlineFailed;
  }

  const crawl = online(version);
  if (!crawl) {
    onlineSkipped.push(version);
    console.log(`SKIP ${version}: no crawl cache (run npm run sidebar:crawl)`);
    continue;
  }
  onlineRan.push(version);
  console.log(`${version} online`);
  onlineFailed =
    report(
      [
        ['stale cache generation', crawl.staleCacheGeneration],
        ['same path under two parents', crawl.multiParent],
        ['same path with two hrefs', crawl.multiHref],
        ['same path with different children', crawl.conflictingChildren],
        ['same href with different labels', crawl.unstableLabels],
        ['duplicate sibling labels', crawl.duplicateSiblings],
        ['compare position mismatch', crawl.comparePositionMismatch],
      ],
      crawl.header,
    ) || onlineFailed;
}

// One summary line keeps the exit status readable in a CI log: the offline
// layer is the contract, the online layer only runs where a crawl cache exists.
const onlineState =
  onlineSkipped.length === 0
    ? 'ok'
    : onlineRan.length === 0
      ? `skipped(${onlineSkipped.join(',')})`
      : `partial(ran=${onlineRan.join(',')} skipped=${onlineSkipped.join(',')})`;
console.log(
  `offline=${offlineFailed ? 'FAIL' : 'ok'} online=${onlineState}` + (strict ? ' strict' : ''),
);

if (offlineFailed || onlineFailed || (strict && onlineSkipped.length)) process.exitCode = 1;
