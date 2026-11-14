#!/usr/bin/env node
/**
 * Offline verification of the upstream layer.
 *
 *   node tools/sync/verify-upstream.mjs
 *
 * Checks every manifest entry against the stored bytes, detects duplicate
 * paths/routes, and reports Markdown files that are not in a manifest. It never
 * touches the network.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, walkMarkdown} from '../translate/lib/paths.mjs';
import {allVersions} from './lib/versions.mjs';
import {
  loadConfig,
  loadManifest,
  manifestPath,
  sha256,
  upstreamDir,
  writeJson,
} from './lib/upstream.mjs';

const config = loadConfig();
const versions = allVersions();
const report = {generated_at: new Date().toISOString(), versions: {}, totals: {pages: 0, errors: 0, warnings: 0}};

for (const version of versions) {
  const manifest = loadManifest(version);
  const entry = {ok: true, official: 0, local: 0, pages: 0, errors: [], warnings: []};
  if (!manifest) {
    entry.ok = false;
    entry.errors.push(`missing manifest: ${manifestPath(version)}`);
    report.versions[version] = entry;
    report.totals.errors += 1;
    continue;
  }

  const docsRoot = path.join(upstreamDir(version), 'docs');
  const seenPaths = new Set();
  const seenRoutes = new Set();
  for (const page of manifest.pages || []) {
    entry.pages += 1;
    report.totals.pages += 1;
    if (page.origin === 'official') entry.official += 1;
    else if (page.origin === 'local') entry.local += 1;
    else entry.errors.push(`${page.local_path}: unknown origin ${page.origin}`);

    if (seenPaths.has(page.local_path)) entry.errors.push(`duplicate local_path: ${page.local_path}`);
    seenPaths.add(page.local_path);
    if (seenRoutes.has(page.route)) entry.errors.push(`duplicate route: ${page.route}`);
    seenRoutes.add(page.route);

    let file = null;
    if (page.origin === 'official') file = path.join(docsRoot, page.local_path);
    else if (page.local_source) file = path.join(REPO, page.local_source);

    if (!file || !fs.existsSync(file)) {
      entry.errors.push(`${page.local_path}: missing stored file ${file || ''}`);
      continue;
    }
    const bytes = fs.readFileSync(file);
    const hash = sha256(bytes);
    if (hash !== page.sha256) entry.errors.push(`${page.local_path}: sha256 mismatch`);
    if (bytes.length !== page.bytes) entry.errors.push(`${page.local_path}: byte length mismatch`);
    if (page.origin === 'official') {
      if (!page.frontmatter?.mirror?.source) {
        entry.warnings.push(`${page.local_path}: mirror.source is missing`);
      }
      if (!page.frontmatter?.official?.title && !page.official_title) {
        entry.warnings.push(`${page.local_path}: no official title`);
      }
    }
  }

  const known = new Set((manifest.pages || []).filter((page) => page.origin === 'official').map((page) => page.local_path));
  for (const file of walkMarkdown(docsRoot)) {
    const rel = path.relative(docsRoot, file).split(path.sep).join('/');
    if (!known.has(rel)) entry.errors.push(`extra upstream file: ${rel}`);
  }

  entry.ok = entry.errors.length === 0;
  if (!entry.ok) report.totals.errors += entry.errors.length;
  report.totals.warnings += entry.warnings.length;
  report.versions[version] = entry;
  console.log(
    `${version}: pages=${entry.pages} official=${entry.official} local=${entry.local} errors=${entry.errors.length} warnings=${entry.warnings.length}`,
  );
  for (const error of entry.errors.slice(0, 10)) console.log(`  ERROR ${error}`);
  for (const warning of entry.warnings.slice(0, 5)) console.log(`  WARN ${warning}`);
}

writeJson(path.join(REPO, 'reports/upstream-verify.json'), report);
if (report.totals.errors) {
  console.error(`upstream verification failed: ${report.totals.errors} error(s)`);
  process.exitCode = 1;
} else {
  console.log(`upstream verification passed: ${report.totals.pages} pages, ${report.totals.warnings} warning(s)`);
}
