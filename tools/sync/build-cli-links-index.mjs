#!/usr/bin/env node
/**
 * Rebuild `data/manifests/cli-links.json` from the per-version captures.
 *
 * The site component looks up links by the Docusaurus version name, so the
 * index must have exactly the keys `current` plus every archived version
 * (`versions.json`). A missing per-version capture used to be logged and
 * skipped: the site then silently shipped no CLI links on that version, and
 * `materialize --all` later erased the archive data with no stage failing.
 * This step is therefore fail-closed: any missing known version aborts with
 * the full list, and the produced index is checked before it is written.
 */
import fs from 'node:fs';
import path from 'node:path';
import {REPO, archivedVersions, currentVersion} from './lib/versions.mjs';

const manifest = (name) => path.join(REPO, 'data/manifests', name);
const current = currentVersion();
const versions = [current, ...archivedVersions()];
const missing = versions.filter(
  (version) => !fs.existsSync(manifest(`cli-links-${version}.json`)),
);
if (missing.length) {
  throw new Error(
    `[cli-links] missing cli-links-<v>.json for version(s): ${missing.join(', ')}; ` +
      'run the metadata-extract / metadata-apply stages for those versions',
  );
}

const byVersion = {current: JSON.parse(fs.readFileSync(manifest(`cli-links-${current}.json`), 'utf8'))};
for (const version of archivedVersions()) {
  byVersion[version] = JSON.parse(fs.readFileSync(manifest(`cli-links-${version}.json`), 'utf8'));
}

// Post-conditions, checked before the file is replaced: every known version
// has at least one documented page and the DNS canary page is present.
for (const [key, docs] of Object.entries(byVersion)) {
  if (!docs || typeof docs !== 'object' || !Object.keys(docs).length) {
    throw new Error(`[cli-links] ${key}: no documented pages`);
  }
  if (!(docs['network-management/dns'] || []).length) {
    throw new Error(`[cli-links] ${key}: network-management/dns has no CLI links`);
  }
}

fs.writeFileSync(
  manifest('cli-links.json'),
  JSON.stringify(byVersion, null, 2) + '\n',
);
console.log(
  `[cli-links] wrote data/manifests/cli-links.json keys=${Object.keys(byVersion).join(',')} ` +
    `pages=${Object.entries(byVersion).map(([key, docs]) => `${key}:${Object.keys(docs).length}`).join(' ')}`,
);
