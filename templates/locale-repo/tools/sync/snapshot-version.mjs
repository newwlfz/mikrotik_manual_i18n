#!/usr/bin/env node
/**
 * Freeze the current `docs/` tree as a Docusaurus archive.
 *
 *   node tools/sync/snapshot-version.mjs --version 7.25
 *   node tools/sync/snapshot-version.mjs --version 7.25 --source docs
 *
 * The snapshot is the *outgoing* current version, taken right before the new
 * release is installed. Pages that only exist in the current release are
 * removed, every route and `source:` URL is rewritten to the archive prefix, a
 * native Docusaurus sidebar is written, and `versions.json` is extended.
 *
 * The sidebar written here is a stopgap derived from `sidebars.ts`; the
 * orchestrator rebuilds it from the official crawl immediately afterwards.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {rewriteDocsLinks} from './lib/rewrite-links.mjs';
import {currentVersion} from './lib/versions.mjs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const current = currentVersion();
const version = arg('version', current);
const source = arg('source', 'docs');
const target = `versioned_docs/version-${version}`;
const config = YAML.parse(fs.readFileSync('config/mirror.yml', 'utf8'));
const currentOnly = (config.sync?.current_only_pages || []).map((page) =>
  page.replace(/\.md$/, '').replace(/^\/+|\/+$/g, ''),
);

if (version !== current) {
  throw new Error(`snapshot version ${version} does not match current ${current}`);
}
if (!fs.existsSync(source)) throw new Error(`missing source docs dir ${source}`);
if (fs.existsSync(target)) {
  throw new Error(`${target} already exists; refusing to overwrite a version snapshot`);
}

fs.mkdirSync(path.dirname(target), {recursive: true});
fs.cpSync(source, target, {recursive: true});
console.log(`copied ${source} -> ${target}`);

for (const page of currentOnly) {
  for (const candidate of [`${page}.md`, `${page}/index.md`]) {
    const file = path.join(target, candidate);
    if (!fs.existsSync(file)) continue;
    fs.rmSync(file);
    console.log(`removed current-only page ${candidate} from snapshot`);
  }
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) files.push(file);
  }
  return files;
}

// The snapshot is an archive: its links must keep pointing at the official
// version they were written for, not at whatever is current later.
let rewritten = 0;
for (const file of walk(target)) {
  const text = fs.readFileSync(file, 'utf8');
  const next = rewriteDocsLinks(text, '/docs/', `/docs/${version}/`, {source: true});
  if (next !== text) {
    fs.writeFileSync(file, next);
    rewritten++;
  }
}
console.log(`rewrote /docs/ -> /docs/${version}/ in ${rewritten} files`);

const userGuides = path.join(target, 'user-guides', 'index.md');
if (!fs.existsSync(userGuides)) {
  console.warn('warning: the snapshot has no user-guides/index.md');
}

// A versioned sidebar is a native Docusaurus JSON sidebar: the current tree
// minus the current-only pages. sync-sidebars replaces it from the crawl.
const sidebarSource = fs.readFileSync('sidebars.ts', 'utf8');
const sidebarMatch = sidebarSource.match(
  /const sidebars: SidebarsConfig = ([\s\S]*?);\n\nexport default/,
);
if (!sidebarMatch) throw new Error('cannot parse sidebars.ts');
const tree = JSON.parse(sidebarMatch[1]);
const currentOnlyIds = new Set(currentOnly);
function prune(items) {
  return items
    .filter((item) => !(item.type === 'doc' && currentOnlyIds.has(item.id)))
    .map((item) => (item.items ? {...item, items: prune(item.items)} : item));
}
tree.docs = prune(tree.docs);
fs.mkdirSync('versioned_sidebars', {recursive: true});
fs.writeFileSync(
  `versioned_sidebars/version-${version}-sidebars.json`,
  JSON.stringify(tree, null, 2) + '\n',
);
console.log(`wrote versioned_sidebars/version-${version}-sidebars.json`);

const versionsFile = 'versions.json';
const versions = fs.existsSync(versionsFile)
  ? JSON.parse(fs.readFileSync(versionsFile, 'utf8'))
  : [];
if (!versions.includes(version)) versions.push(version);
versions.sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
fs.writeFileSync(versionsFile, JSON.stringify(versions, null, 2) + '\n');
console.log(`wrote ${versionsFile} ${JSON.stringify(versions)}`);
