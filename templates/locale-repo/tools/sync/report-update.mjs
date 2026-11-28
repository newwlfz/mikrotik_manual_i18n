#!/usr/bin/env node
/**
 * node tools/sync/report-update.mjs --from=7.25 --to=7.26 [--sidebar]
 * node tools/sync/report-update.mjs --zones [--llms=FILE --blog=FILE --changelog=FILE] [--write]
 *
 * Print (and write) the human-decision list of an upgrade: which routes the new
 * release adds and drops, and — once the new sidebar has been crawled — which
 * documents entered or left the navigation.
 *
 * `--zones` is the official-vs-local content diff the corpus ETag cannot see:
 * it reads only the three zone indexes (hardware / blog / changelog) and lists
 * added (official-only) and missing (local-only) slugs. Pass snapshot files for
 * an offline replay, or no files to read the live indexes. `--write` caches the
 * observation at data/manifests/official-zones.json for the offline freshness
 * assertion in verify:build-inputs. `--zones` never mutates content and always
 * exits 0 — it reports, it does not gate (the gate is sync --probe).
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, currentVersion} from './lib/versions.mjs';
import {routePlan, sidebarPlan, writeRouteReport} from './lib/update.mjs';
import {
  ZONES,
  BLOG_INDEX_URL,
  CHANGELOG_INDEX_URL,
  INVENTORY_URL,
  fetchOfficialInventory,
  fetchOfficialZoneIndexes,
  formatZoneProbe,
  localZoneSlugs,
  probeDecision,
} from './lib/official-zones.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

// ---------------------------------------------------------------------------
// --zones: official index slug set vs committed zone manifests (report only)
// ---------------------------------------------------------------------------
if (process.argv.includes('--zones')) {
  const files = {
    llms: arg('llms', ''),
    blog: arg('blog', ''),
    changelog: arg('changelog', ''),
  };
  const offline = Object.values(files).some(Boolean);
  const snapshotFetcher = async (url) => {
    if (url === BLOG_INDEX_URL && files.blog) return fs.readFileSync(path.resolve(files.blog), 'utf8');
    if (url === CHANGELOG_INDEX_URL && files.changelog) {
      return fs.readFileSync(path.resolve(files.changelog), 'utf8');
    }
    throw new Error(`no offline snapshot for ${url} (pass --blog=FILE / --changelog=FILE)`);
  };
  try {
    const inventoryText = files.llms
      ? fs.readFileSync(path.resolve(files.llms), 'utf8')
      : (await fetchOfficialInventory()).text;
    const indexes = await fetchOfficialZoneIndexes({
      inventoryText,
      fetcher: offline ? snapshotFetcher : undefined,
    });
    const local = Object.fromEntries(ZONES.map((zone) => [zone, localZoneSlugs(REPO, zone)]));
    const decision = {
      ...probeDecision(indexes.zones, local),
      version: indexes.version,
      pagesVisited: indexes.pagesVisited,
    };
    console.log(`official-zones: version=${decision.version || '(unknown)'} pages_visited=${decision.pagesVisited}`);
    for (const line of formatZoneProbe(decision)) console.log(line);
    if (process.argv.includes('--write')) {
      const cache = {
        schema: 1,
        captured_at: new Date().toISOString(),
        sources: {inventory: INVENTORY_URL, blog: BLOG_INDEX_URL, changelog: CHANGELOG_INDEX_URL},
        zones: Object.fromEntries(
          ZONES.map((zone) => [
            zone,
            {
              official_hash: decision.zones[zone]?.official_hash || null,
              official_count: decision.zones[zone]?.official_count ?? null,
              added: decision.zones[zone]?.added || [],
              missing: decision.zones[zone]?.missing || [],
            },
          ]),
        ),
        changelog: {latest_slug: decision.official_changelog_latest},
      };
      const target = path.join(REPO, 'data/manifests/official-zones.json');
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, `${JSON.stringify(cache, null, 2)}\n`);
      console.log(`wrote ${path.relative(REPO, target)}`);
    }
    console.log(
      `official-zones: status=${decision.changed ? 'changed' : 'unchanged'} ` +
        `zones=${ZONES.length} reasons=${decision.reasons.length}`,
    );
    process.exit(0);
  } catch (error) {
    console.error(`report-update --zones: ${error.message}`);
    process.exit(2);
  }
}

const from = arg('from', currentVersion());
const to = arg('to', '');
if (!to) {
  console.error('usage: node tools/sync/report-update.mjs --from=7.25 --to=7.26 [--sidebar]');
  process.exit(2);
}

const routes = routePlan({from, to});
if (!routes) {
  console.error(`missing upstream manifest for ${from} or ${to}; run upstream:fetch first`);
  process.exit(2);
}

const file = writeRouteReport(routes);
console.log(
  `${from} -> ${to}: pages ${routes.before} -> ${routes.after}, added ${routes.added.length}, removed ${routes.removed.length}`,
);
for (const route of routes.added.slice(0, 15)) console.log(`  + ${route}`);
if (routes.added.length > 15) console.log(`  + ... ${routes.added.length - 15} more`);
for (const route of routes.removed) console.log(`  - ${route}`);
console.log(`wrote ${path.relative(REPO, file)}`);

if (process.argv.includes('--sidebar')) {
  const sidebar = sidebarPlan({from, to});
  if (!sidebar) {
    console.log('sidebar diff skipped: a sidebar manifest is missing');
  } else {
    console.log(
      `sidebar ${from} -> ${to}: docs ${sidebar.before} -> ${sidebar.after}, ` +
        `entered ${sidebar.added.length}, left ${sidebar.removed.length}`,
    );
    for (const id of sidebar.added.slice(0, 15)) console.log(`  + ${id}`);
    for (const id of sidebar.removed.slice(0, 15)) console.log(`  - ${id}`);
    if (sidebar.removed.length) {
      console.log('documents that left the sidebar may be official removals; confirm before pruning.');
    }
    fs.writeFileSync(
      path.join(REPO, `reports/update-${to}-sidebar.json`),
      `${JSON.stringify(sidebar, null, 2)}\n`,
    );
  }
}
