#!/usr/bin/env node
/**
 * Offline check of the structure cache against the current local pages.
 *
 *   node tools/sync/check-structure.mjs
 *   node tools/sync/check-structure.mjs --strict
 *
 * This is a report by default; --strict exits non-zero when a page is stale or
 * a cached table signature no longer matches.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';
import {docsDir, loadConfig, loadManifest, readJson, sha256, upstreamDir, writeJson} from './lib/upstream.mjs';
import {allVersions} from './lib/versions.mjs';
import {countMarkdownStructure, mdTables} from './lib/table-structure.mjs';

const STRICT = process.argv.includes('--strict');
const config = loadConfig();
const versions = allVersions();
const report = {schema: 1, generated_at: new Date().toISOString(), strict: STRICT, versions: {}, totals: {pages: 0, errors: 0, warnings: 0}};

for (const version of versions) {
  const manifest = loadManifest(version);
  const index = readJson(path.join(upstreamDir(version), 'structure/index.json'));
  const entry = {pages: 0, stale: [], missingCache: [], tableCount: [], wide: [], errors: [], warnings: []};
  if (!manifest || !index) {
    entry.errors.push('manifest or structure index missing');
    report.versions[version] = entry;
    report.totals.errors += 1;
    continue;
  }
  const byPath = new Map((manifest.pages || []).filter((page) => page.origin === 'official').map((page) => [page.local_path, page]));
  for (const page of index.pages || []) {
    entry.pages += 1;
    report.totals.pages += 1;
    const manifestPage = byPath.get(page.local_path);
    if (!manifestPage) {
      entry.errors.push(`${page.local_path}: not in manifest`);
      continue;
    }
    const cacheFile = path.join(REPO, page.cache);
    if (!fs.existsSync(cacheFile)) {
      entry.missingCache.push(page.local_path);
      continue;
    }
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cache.md_sha256 !== page.md_sha256) entry.stale.push({local_path: page.local_path, reason: 'index/cache md hash'});

    const localFile = path.join(docsDir(version), page.local_path);
    if (!fs.existsSync(localFile)) {
      entry.errors.push(`${page.local_path}: local page missing`);
      continue;
    }
    const localText = fs.readFileSync(localFile, 'utf8');
    const local = countMarkdownStructure(localText);
    if (local.tables !== (page.mdTables ?? page.tables)) {
      entry.tableCount.push({local_path: page.local_path, cache: page.mdTables ?? page.tables, local: local.tables});
    }
    if (local.wideTables !== page.wide.local) {
      entry.wide.push({local_path: page.local_path, cache: page.wide.local, local: local.wideTables});
    }
    const upstreamFile = path.join(upstreamDir(version), 'docs', page.local_path);
    if (fs.existsSync(upstreamFile)) {
      const upstream = fs.readFileSync(upstreamFile, 'utf8');
      if (sha256(upstream) !== page.md_sha256) entry.stale.push({local_path: page.local_path, reason: 'upstream md hash'});
      if (countMarkdownStructure(upstream).wideTables !== page.wide.md) {
        entry.wide.push({local_path: page.local_path, cache: page.wide.md, upstream: countMarkdownStructure(upstream).wideTables});
      }
    }
    // A quick table-shape check against the cached row/col counts.
    const tables = mdTables(upstreamFile && fs.existsSync(upstreamFile) ? fs.readFileSync(upstreamFile, 'utf8').split('\n') : []);
    for (const cached of cache.tables || []) {
      const table = tables[cached.index];
      if (!table) {
        entry.tableCount.push({local_path: page.local_path, table: cached.index, reason: 'table missing'});
        continue;
      }
      if (table.rows.length + 1 !== cached.rows) {
        entry.tableCount.push({local_path: page.local_path, table: cached.index, cache: cached.rows, md: table.rows.length + 1});
      }
    }
  }
  if (entry.stale.length) entry.warnings.push(`${entry.stale.length} stale page(s)`);
  if (entry.missingCache.length) entry.errors.push(`${entry.missingCache.length} missing cache file(s)`);
  report.versions[version] = entry;
  report.totals.errors += entry.errors.length;
  report.totals.warnings += entry.warnings.length;
  console.log(
    `${version}: pages=${entry.pages} stale=${entry.stale.length} missingCache=${entry.missingCache.length} tableCount=${entry.tableCount.length} wide=${entry.wide.length} errors=${entry.errors.length}`,
  );
  for (const error of entry.errors.slice(0, 5)) console.log(`  ERROR ${error}`);
  for (const warning of entry.warnings.slice(0, 5)) console.log(`  WARN ${warning}`);
}

writeJson(path.join(REPO, 'reports/structure-check.json'), report);
if (STRICT && (report.totals.errors || report.totals.warnings)) {
  console.error(`structure check failed: ${report.totals.errors} error(s), ${report.totals.warnings} warning(s)`);
  process.exitCode = 1;
} else {
  console.log(`structure check complete: ${report.totals.pages} pages, ${report.totals.errors} error(s), ${report.totals.warnings} warning(s)`);
}
