#!/usr/bin/env node
/**
 * Give every page the sidebar label the official navigation uses.
 *
 * The crawler records the official sidebar (`docs-<v>-sidebar.json`) and the
 * label of every route (`docs-<v>-nav.json`), but nothing wrote those back into
 * the page manifest: pages imported after the initial bootstrap (7.26) had no
 * `title` / `sidebar_label` / `sidebar_key`, so the materialised Markdown carried
 * no label, the translated overlay had none either, and Docusaurus fell back to
 * the English sidebar text — which is what made the Previous/Next cards English
 * on 7.26 only.
 *
 * A sidebar label is not a page title. The official tree shortens it
 * ("Diagnostics and Monitoring" for "Diagnostics, Monitoring and
 * Troubleshooting", "Logs" for "Log"), so writing the label into `title` renamed
 * 13 pages per release and left the materialised `title` disagreeing with the
 * page's own H1 — and the H1 is what a reader, and the SEO metadata, see. The
 * title therefore comes from the captured Markdown; the label is only ever
 * `sidebar_label`.
 *
 *   node tools/sync/apply-navigation-labels.mjs --version=7.26
 *   node tools/sync/apply-navigation-labels.mjs --all
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, currentVersion, archivedVersions} from './lib/versions.mjs';

/** First H1 of the captured Markdown: the page's own title. */
function pageTitle(version, localPath) {
  const file = path.join(REPO, 'upstream', version, 'docs', localPath);
  if (!fs.existsSync(file)) return null;
  const body = fs.readFileSync(file, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const match = /^#\s+(.+)$/m.exec(body);
  return match ? match[1].trim() : null;
}

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const ALL = process.argv.includes('--all');
const versions = ALL ? [...archivedVersions(), currentVersion()] : [arg('version', currentVersion())];

const idOf = (localPath) => localPath.replace(/\.md$/, '').replace(/\/index$/, '');

/** sidebar item order per id, so a page keeps its position on the official tree. */
function positions(tree) {
  const out = new Map();
  const walk = (items) => {
    items.forEach((item, index) => {
      if (item.id) out.set(idOf(item.id), index + 1);
      if (item.items) walk(item.items);
    });
  };
  walk(tree);
  return out;
}

let changed = 0;
for (const version of versions) {
  const manifestFile = path.join(REPO, `upstream/${version}/manifest.json`);
  const navFile = path.join(REPO, `data/manifests/docs-${version}-nav.json`);
  const sidebarFile = path.join(REPO, `data/manifests/docs-${version}-sidebar.json`);
  if (!fs.existsSync(manifestFile) || !fs.existsSync(navFile) || !fs.existsSync(sidebarFile)) {
    console.log(`skip ${version}: missing manifest/nav/sidebar`);
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const labels = JSON.parse(fs.readFileSync(navFile, 'utf8')).labels || {};
  const tree = JSON.parse(fs.readFileSync(sidebarFile, 'utf8'));
  const order = positions(tree.docs || []);
  let touched = 0;

  for (const page of manifest.pages || []) {
    if (page.origin !== 'official') continue;
    const route = page.local_path.replace(/\.md$/, '');
    const id = idOf(page.local_path);
    // The crawler keys labels by the local path with `/index` kept.
    const label = labels[route] || labels[id] || null;
    page.frontmatter = page.frontmatter || {};
    page.frontmatter.official = page.frontmatter.official || {};
    page.frontmatter.mirror = page.frontmatter.mirror || {};
    const official = page.frontmatter.official;
    const mirror = page.frontmatter.mirror;
    let dirty = false;
    // `title` keeps the page's own H1; only a page that has none inherits the
    // label, so the materialised front matter is never title-less.
    const title = pageTitle(version, page.local_path);
    if (title && official.title !== title) {
      official.title = title;
      dirty = true;
    }
    if (label && official.sidebar_label !== label) {
      official.sidebar_label = label;
      dirty = true;
    }
    if (!mirror.sidebar_key) {
      mirror.sidebar_key = id;
      dirty = true;
    }
    const position = order.get(id);
    if (position && mirror.sidebar_position !== position) {
      mirror.sidebar_position = position;
      dirty = true;
    }
    if (dirty) {
      touched++;
      changed++;
    }
  }
  if (touched) fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`${version}: pages=${(manifest.pages || []).length} updated=${touched}`);
}
console.log(JSON.stringify({updated: changed}));
