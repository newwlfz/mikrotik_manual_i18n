#!/usr/bin/env node
/**
 * node tools/sync/report-update.mjs --from=7.25 --to=7.26 [--sidebar]
 *
 * Print (and write) the human-decision list of an upgrade: which routes the new
 * release adds and drops, and — once the new sidebar has been crawled — which
 * documents entered or left the navigation.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, currentVersion} from './lib/versions.mjs';
import {routePlan, sidebarPlan, writeRouteReport} from './lib/update.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

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
