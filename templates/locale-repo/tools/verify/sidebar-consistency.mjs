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

function treeDocs(version) {
  return version === currentVersion()
    ? loadSidebarsTs(path.join(REPO, 'sidebars.ts'))
    : JSON.parse(
        fs.readFileSync(path.join(REPO, `versioned_sidebars/version-${version}-sidebars.json`), 'utf8'),
      ).docs;
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
    visit(data.sidebar || [], '', file);
  }

  return {
    header: `${files.length} pages, ${paths.size} label paths`,
    multiParent: [...paths].filter(([, record]) => record.parents.size > 1),
    multiHref: [...paths].filter(([, record]) => record.hrefs.size > 1),
    conflictingChildren: [...paths].filter(([, record]) => record.childSets.size > 1),
    unstableLabels: [...byHref].filter(([, labels]) => labels.size > 1),
    duplicateSiblings,
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
        ['same path under two parents', crawl.multiParent],
        ['same path with two hrefs', crawl.multiHref],
        ['same path with different children', crawl.conflictingChildren],
        ['same href with different labels', crawl.unstableLabels],
        ['duplicate sibling labels', crawl.duplicateSiblings],
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
