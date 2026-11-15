#!/usr/bin/env node
/**
 * Remove local pages that the official site no longer publishes.
 *
 * The inventory is the official `llms.txt` for each RouterOS version (it lists
 * every page, including CLI entries) plus the blog/changelog manifest. Pages the
 * mirror generates itself are listed in config/mirror.yml as preserve_pages and
 * are never removed.
 *
 *   node tools/sync/prune-orphans.mjs            # report only
 *   node tools/sync/prune-orphans.mjs --apply    # delete orphans and overlays
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {SECTIONS, REPO, WORKSPACE, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {routeFromOfficialUrl} from './lib/upstream.mjs';
import {versionForSection, versionPlan} from './lib/versions.mjs';

const APPLY = process.argv.includes('--apply');
const config = YAML.parse(fs.readFileSync(path.join(REPO, 'config/mirror.yml'), 'utf8'));
const preserve = new Set(config.sync?.preserve_pages || []);

/**
 * The inventory is the official `llms.txt` for the version. It is cached under
 * `.work/`, and fetched on demand: relying on a hand-created file made the
 * cleanup silently skip in CI, where nothing had ever written it.
 */
async function inventoryFromLlms(plan) {
  const version = plan.version;
  const file = path.join(WORKSPACE, '.work', `llms-${version.replace(/\./g, '')}.txt`);
  if (!fs.existsSync(file)) {
    const url = plan.llmsUrl;
    try {
      const response = await fetch(url, {headers: {'user-agent': 'mikrotik-manual-i18n/2.0'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, text);
      console.log(`fetched ${url}`);
    } catch (error) {
      console.warn(`cannot fetch ${url}: ${error.message}`);
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

async function expectedDocPaths(plan) {
  const routes = await inventoryFromLlms(plan);
  if (!routes) return null;
  // Official links and local files differ only in whether a directory page is
  // written as "x" or "x/index"; compare normalised ids.
  return new Set([...routes].map(idOf));
}

let removed = 0;
const report = {sections: {}};

function remove(file) {
  removed++;
  console.log(APPLY ? 'REMOVE' : 'WOULD-REMOVE', relative(REPO, file));
  if (APPLY) fs.rmSync(file);
}

function pruneSection(section, expected) {
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

for (const section of SECTIONS) {
  const version = versionForSection(section.name);
  if (version) {
    const plan = versionPlan(version);
    const expected = await expectedDocPaths(plan);
    if (!expected) {
      console.log(`SKIP ${section.name}: cannot read ${plan.llmsUrl}`);
      continue;
    }
    pruneSection(section, expected);
  } else if (section.name === 'blog' || section.name === 'changelog') {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'data/manifests/blog-changelog.json'), 'utf8'));
    const urls = manifest[section.name] || [];
    const expected = new Set(
      urls
        .filter((url) => !url.includes('/page/'))
        .map((url) => url.replace(/\/+$/, '').split('/').at(-1)),
    );
    if (!expected.size) {
      console.log(`SKIP ${section.name}: empty manifest`);
      continue;
    }
    pruneSection(section, expected);
  } else {
    // Hardware has no page-level manifest; only overlays without a source are pruned.
    pruneSection(section, null);
  }
}

console.log(JSON.stringify({removed, apply: APPLY, sections: report.sections}, null, 1));
if (removed && !APPLY) console.log('dry run only; re-run with --apply to delete');
