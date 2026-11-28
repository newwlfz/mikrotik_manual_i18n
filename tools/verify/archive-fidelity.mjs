#!/usr/bin/env node
/**
 * `npm run verify:archive-fidelity` — archived-content fidelity gate (hub-only).
 *
 * The 7.24/7.25 regression lost the rendered table-cell structure (`<ul>` /
 * `<li>`) and the authoritative `previous: null` pagination edge. Both are
 * produced by the sync pipeline, not hand-maintained in `versioned_docs/`, so
 * this gate asserts the three artefacts the pipeline must produce for every
 * version listed in `versions.json` (except the current one):
 *
 *   1. `upstream/<v>/structure/pages/**\/*.json` — the rendered-page structure
 *      cache, built by `cache-structure.mjs --version=<v>`;
 *   2. `versioned_docs/version-<v>/bridging-and-switching.md` — one page whose
 *      tables carry inline lists; the old nested path is accepted as a fallback
 *      while a release still has it;
 *   3. `versioned_docs/version-<v>/getting-started/networking-fundamentals.md`
 *      — the page whose crawled Previous edge is `null`, which must be written
 *      as the YAML literal `pagination_prev: null` so Docusaurus renders no
 *      Previous button;
 *   4. `data/manifests/docs-<v>-mermaid.json` and
 *      `data/manifests/docs-<v>-inline-colors.json` — the authoritative Mermaid
 *      sources (line breaks in diagram labels) and coloured enumeration values
 *      recovered from the official rendered pages by the first-install
 *      `capture-*-archive-<v>` stages. Both must exist and be non-empty,
 *      otherwise `materialize` writes reflowing diagrams and plain enum values.
 *   5. `data/manifests/docs-<v>-metadata.json` (tagged pages) and
 *      `upstream/<v>/manifest.json` (`frontmatter.mirror.tags` pages), with the
 *      archived Markdown front matter aligned to the version's own metadata —
 *      DNS is the canary: 7.24 has 3 tags, 7.25 has 4, never the current 4/4.
 *   6. When `build/` exists, the rendered archive DNS page carries
 *      `theme-doc-footer-tags-row` and exactly as many `rel="tag"` links as the
 *      Markdown front matter declares. CLI cross-links are checked the same way
 *      for all three versions: the number of built pages carrying
 *      `cli-reference-links` must equal each `cli-links-<v>.json` page count.
 *
 * No network and no browser-check thresholds: this is a source-data assertion
 * that fails closed with exit 1 on any missing or mismatched item. Build-page
 * assertions run when the build output exists and report SKIP otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

import {REPO, archivedVersions, currentVersion} from '../sync/lib/versions.mjs';

function countStructurePages(version) {
  const root = path.join(REPO, 'upstream', version, 'structure', 'pages');
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return 0;
  let count = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) count++;
    }
  };
  walk(root);
  return count;
}

/**
 * Non-empty capture manifest? Both capture tools write
 * `{version, generated, pages: {...}}`; an empty `pages` map means the capture
 * silently found nothing and materialize would degrade the archive content.
 */
function capturedPages(version, kind) {
  const relative = `data/manifests/docs-${version}-${kind}.json`;
  const absolute = path.join(REPO, relative);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return {ok: false, count: 0, relative};
  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    const pages = parsed && typeof parsed.pages === 'object' && parsed.pages !== null ? parsed.pages : {};
    const entries = Object.values(pages);
    const count = kind === 'mermaid'
      ? entries.reduce((sum, sources) => sum + (Array.isArray(sources) ? sources.filter((source) => typeof source === 'string' && source.trim()).length : 0), 0)
      : entries.reduce((sum, colors) => sum + (colors && typeof colors === 'object' ? Object.keys(colors).length : 0), 0);
    return {ok: count > 0, count, relative};
  } catch {
    return {ok: false, count: 0, relative};
  }
}

/** First existing candidate, so a still-nested release is not misreported. */
function findPage(candidates) {
  for (const relative of candidates) {
    const absolute = path.join(REPO, relative);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      return {relative, text: fs.readFileSync(absolute, 'utf8')};
    }
  }
  return null;
}

function readJson(relative) {
  const absolute = path.join(REPO, relative);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch {
    return null;
  }
}

/** YAML front-matter `tags:` list of a materialized page (null = unparsable). */
function frontmatterTags(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  try {
    const parsed = YAML.parse(match[1]);
    const tags = parsed?.tags;
    return Array.isArray(tags) ? tags.map(String) : [];
  } catch {
    return null;
  }
}

const sameTags = (left, right) =>
  Array.isArray(left) &&
  Array.isArray(right) &&
  left.length === right.length &&
  left.every((tag, index) => tag === right[index]);

/** Tagged pages in a per-version metadata capture, plus the DNS canary entry. */
function metadataCoverage(version) {
  const relative = `data/manifests/docs-${version}-metadata.json`;
  const docs = readJson(relative)?.docs;
  if (!docs || typeof docs !== 'object') return {ok: false, tagged: 0, dns: null, relative};
  const tagged = Object.values(docs).filter((doc) => Array.isArray(doc?.tags) && doc.tags.length).length;
  return {
    ok: tagged > 0,
    tagged,
    dns: docs['network-management/dns']?.tags || null,
    relative,
  };
}

/** Upstream manifest pages carrying `frontmatter.mirror.tags`. */
function manifestTagCoverage(version) {
  const relative = `upstream/${version}/manifest.json`;
  const pages = readJson(relative)?.pages;
  if (!Array.isArray(pages)) return {ok: false, tagged: 0, dns: null, relative};
  const tagged = pages.filter((page) => page.frontmatter?.mirror?.tags?.length).length;
  const dns = pages.find((page) => page.local_path === 'network-management/dns.md');
  return {ok: tagged > 0, tagged, dns: dns?.frontmatter?.mirror?.tags || null, relative};
}

/** Count built HTML pages carrying the CLI cross-link block for one version. */
function builtCliLinkPages(version, archives) {
  const isCurrent = version === 'current';
  const root = path.join(REPO, isCurrent ? 'build/docs' : `build/docs/${version}`);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
  let pages = 0;
  const walk = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      // Docusaurus nests the archived versions under build/docs/<v>/; those
      // pages belong to their own index key, not to `current`.
      if (entry.isDirectory()) {
        if (isCurrent && depth === 0 && archives.includes(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.name.endsWith('.html') && fs.readFileSync(full, 'utf8').includes('class="cli-reference-links"')) pages++;
    }
  };
  walk(root, 0);
  return pages;
}

/** The canary's tag count is version-specific — current's 4 must not leak back. */
const DNS_TAG_CANARY = {'7.24': 3, '7.25': 4};
const expectedDnsTags = (version) => DNS_TAG_CANARY[version] ?? null;

console.log('verify:archive-fidelity  archived rendered structure + pagination + metadata');
const versions = archivedVersions();
if (!versions.length) {
  console.error('verify:archive-fidelity: versions.json has no archived version');
  process.exit(1);
}

let failed = 0;
const totals = {
  versions: 0,
  structure_json: 0,
  ul_pages: 0,
  null_prev_pages: 0,
  mermaid_manifests: 0,
  inline_color_manifests: 0,
  metadata_manifests: 0,
  manifest_tagged: 0,
  dns_canary: 0,
  dns_aligned: 0,
  build_tag_rows: 0,
  build_tag_skips: 0,
  checks: 0,
};
for (const version of versions) {
  totals.versions++;
  const structureJson = countStructurePages(version);
  totals.structure_json += structureJson;
  const structureOk = structureJson > 0;
  if (!structureOk) failed++;
  totals.checks++;

  const bridge = findPage([
    `versioned_docs/version-${version}/bridging-and-switching.md`,
    `versioned_docs/version-${version}/bridging-and-switching/index.md`,
  ]);
  const ulCount = bridge ? (bridge.text.match(/<ul\b/g) || []).length : 0;
  if (ulCount > 0) totals.ul_pages++;
  const bridgeOk = Boolean(bridge) && ulCount > 0;
  if (!bridgeOk) failed++;
  totals.checks++;

  const fundamentals = findPage([
    `versioned_docs/version-${version}/getting-started/networking-fundamentals.md`,
    `versioned_docs/version-${version}/getting-started/networking-fundamentals/index.md`,
  ]);
  const nullPrev = fundamentals ? /^pagination_prev:\s*null\s*$/m.test(fundamentals.text) : false;
  if (nullPrev) totals.null_prev_pages++;
  if (!nullPrev) failed++;
  totals.checks++;

  const mermaid = capturedPages(version, 'mermaid');
  if (mermaid.ok) totals.mermaid_manifests++;
  if (!mermaid.ok) failed++;
  totals.checks++;

  const inlineColors = capturedPages(version, 'inline-colors');
  if (inlineColors.ok) totals.inline_color_manifests++;
  if (!inlineColors.ok) failed++;
  totals.checks++;

  // --- Archived page metadata: capture -> upstream manifest -> Markdown. ---
  const metadata = metadataCoverage(version);
  if (metadata.ok) totals.metadata_manifests++;
  if (!metadata.ok) failed++;
  totals.checks++;

  const manifestTags = manifestTagCoverage(version);
  if (manifestTags.ok) totals.manifest_tagged++;
  if (!manifestTags.ok) failed++;
  totals.checks++;

  const dnsPage = findPage([
    `versioned_docs/version-${version}/network-management/dns.md`,
    `versioned_docs/version-${version}/network-management/dns/index.md`,
  ]);
  const dnsMdTags = dnsPage ? frontmatterTags(dnsPage.text) : null;
  const canary = expectedDnsTags(version);
  const dnsCanaryOk =
    Boolean(metadata.dns?.length) &&
    dnsMdTags !== null &&
    (canary === null
      ? metadata.dns.length > 0
      : metadata.dns.length === canary && dnsMdTags.length === canary);
  if (dnsCanaryOk) totals.dns_canary++;
  if (!dnsCanaryOk) failed++;
  totals.checks++;

  const dnsAlignedOk =
    Boolean(metadata.dns?.length) &&
    sameTags(metadata.dns, dnsMdTags) &&
    sameTags(metadata.dns, manifestTags.dns);
  if (dnsAlignedOk) totals.dns_aligned++;
  if (!dnsAlignedOk) failed++;
  totals.checks++;

  // Build output is optional here (the static gate also runs before `build/`),
  // but whenever it exists the rendered tags must match the source front matter.
  const buildRel = `build/docs/${version}/network-management/dns/index.html`;
  const buildAbs = path.join(REPO, buildRel);
  let buildTagsOk = null;
  if (fs.existsSync(buildAbs)) {
    const html = fs.readFileSync(buildAbs, 'utf8');
    const relTagCount = (html.match(/rel="tag"/g) || []).length;
    buildTagsOk =
      html.includes('theme-doc-footer-tags-row') &&
      Array.isArray(dnsMdTags) &&
      dnsMdTags.length > 0 &&
      relTagCount === dnsMdTags.length;
    if (buildTagsOk) totals.build_tag_rows++;
    else failed++;
    totals.checks++;
  } else {
    totals.build_tag_skips++;
  }

  const row = (ok, label) => console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${version} ${label}`);
  row(structureOk, `structure cache: ${structureJson} .json file(s) (min 1)`);
  row(
    bridgeOk,
    `table-cell lists: ${ulCount} <ul> in ${bridge ? bridge.relative : 'bridging-and-switching.md (missing)'}`,
  );
  row(
    nullPrev,
    `pagination_prev: null in ${fundamentals ? fundamentals.relative : 'networking-fundamentals.md (missing)'}`,
  );
  row(mermaid.ok, `mermaid capture: ${mermaid.count} diagram source(s) in ${mermaid.relative}`);
  row(
    inlineColors.ok,
    `inline-colors capture: ${inlineColors.count} coloured code(s) in ${inlineColors.relative}`,
  );
  row(metadata.ok, `metadata capture: ${metadata.tagged} tagged page(s) in ${metadata.relative}`);
  row(manifestTags.ok, `manifest tags: ${manifestTags.tagged} tagged page(s) in ${manifestTags.relative}`);
  row(
    dnsCanaryOk,
    `DNS canary: metadata=${metadata.dns?.length ?? 0} md=${dnsMdTags?.length ?? 0}` +
      `${canary === null ? ' (min 1)' : ` (expected ${canary})`}`,
  );
  row(
    dnsAlignedOk,
    `DNS tags aligned: metadata=[${(metadata.dns || []).join(',')}] md=[${(dnsMdTags || []).join(',')}] ` +
      `upstream=[${(manifestTags.dns || []).join(',')}]`,
  );
  if (buildTagsOk === null) {
    console.log(`  SKIP ${version} build tags: ${buildRel} not present (build/ not run yet)`);
  } else {
    const html = fs.readFileSync(buildAbs, 'utf8');
    row(
      buildTagsOk,
      `build tags: theme-doc-footer-tags-row=${html.includes('theme-doc-footer-tags-row')} ` +
        `rel=tag=${(html.match(/rel="tag"/g) || []).length} (expected ${dnsMdTags?.length ?? 0})`,
    );
  }
}

// --- CLI cross-links: index shape + all three rendered versions. ---
const current = currentVersion();
const expectedKeys = ['current', ...versions];
const index = readJson('data/manifests/cli-links.json');
const indexKeys = index && typeof index === 'object' ? Object.keys(index) : [];
const keysOk =
  indexKeys.length === expectedKeys.length && expectedKeys.every((key) => indexKeys.includes(key));
if (!keysOk) failed++;
totals.checks++;
console.log(
  `  ${keysOk ? 'ok  ' : 'FAIL'} cli-links index keys=[${indexKeys.join(',')}] ` +
    `(expected [${expectedKeys.join(',')}])`,
);

const cliVersions = [['current', current], ...versions.map((version) => [version, version])];
for (const [key, version] of cliVersions) {
  const source = readJson(`data/manifests/cli-links-${version}.json`);
  const pages = source && typeof source === 'object'
    ? Object.entries(source).filter(([, links]) => Array.isArray(links) && links.length).length
    : 0;
  const entry = index?.[key];
  const indexPages = entry && typeof entry === 'object'
    ? Object.entries(entry).filter(([, links]) => Array.isArray(links) && links.length).length
    : 0;
  const dataOk = pages > 0 && indexPages === pages && Boolean(entry?.['network-management/dns']?.length);
  if (!dataOk) failed++;
  totals.checks++;
  console.log(
    `  ${dataOk ? 'ok  ' : 'FAIL'} cli-links ${key}: source pages=${pages} index pages=${indexPages} ` +
      `dns links=${entry?.['network-management/dns']?.length ?? 0}`,
  );

  const built = builtCliLinkPages(key, versions);
  if (built === null) {
    console.log(`  SKIP cli-links ${key}: build/docs${key === 'current' ? '' : `/${key}`} not present`);
    continue;
  }
  const htmlOk = built > 0 && built === pages;
  if (!htmlOk) failed++;
  totals.checks++;
  console.log(
    `  ${htmlOk ? 'ok  ' : 'FAIL'} cli-links ${key}: built pages with cli-reference-links=${built} ` +
      `(expected ${pages} from cli-links-${version}.json)`,
  );
}

console.log(
  `verify:archive-fidelity: versions=${totals.versions} structure_json=${totals.structure_json} ` +
    `ul_pages=${totals.ul_pages}/${totals.versions} null_prev_pages=${totals.null_prev_pages}/${totals.versions} ` +
    `mermaid_manifests=${totals.mermaid_manifests}/${totals.versions} ` +
    `inline_color_manifests=${totals.inline_color_manifests}/${totals.versions} ` +
    `metadata_manifests=${totals.metadata_manifests}/${totals.versions} ` +
    `manifest_tagged=${totals.manifest_tagged}/${totals.versions} ` +
    `dns_canary=${totals.dns_canary}/${totals.versions} ` +
    `dns_aligned=${totals.dns_aligned}/${totals.versions} ` +
    `build_tag_rows=${totals.build_tag_rows}/${totals.versions} ` +
    `build_tag_skips=${totals.build_tag_skips} checks=${totals.checks} failed=${failed}`,
);
if (failed) {
  console.error(`verify:archive-fidelity: ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('verify:archive-fidelity: PASS');
