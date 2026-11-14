#!/usr/bin/env node
/**
 * Install a fetched upstream release as the current `docs/` tree.
 *
 *   node tools/sync/install-version.mjs --version 7.26 --source upstream/7.26/docs
 *
 * Steps, in this order (each one is guarded, so a failure cannot leave `docs/`
 * half-replaced):
 *
 *   1. copy the new tree into `docs.new/` and validate it;
 *   2. swap `docs/` -> `docs.new/` atomically (the old tree moves aside);
 *   3. carry mirror-owned pages that the official source does not publish;
 *   4. rewrite any `/docs/<version>/` link the export still contains;
 *   5. move the translation overlay and the translation state of the outgoing
 *      version to its archive directory, so wording is never re-derived;
 *   6. record the new version in `data/manifests/current-version.json`.
 *
 * `versions.json` and `versioned_docs/version-<old>/` are created by
 * `snapshot-version.mjs`, which must run first.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {rewriteDocsLinks} from './lib/rewrite-links.mjs';
import {currentVersion, upstreamConfig} from './lib/versions.mjs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const current = currentVersion();
const version = arg('version');
const source = arg('source');
const force = process.argv.includes('--force');
const BASE = 'https://manual.mikrotik.com';

if (!version) throw new Error('usage: node tools/sync/install-version.mjs --version 7.26 --source <dir>');
if (!source || !fs.existsSync(source)) throw new Error(`missing source directory ${source}`);
if (version === current && !force) throw new Error(`version ${version} is already current`);

// The routing rule for a *newly installed* release is the current rule; the
// version is not in versions.json yet, so versionPlan() cannot describe it.
const upstream = upstreamConfig();
const routeBase = String(upstream.sections?.docs?.routes?.current ?? '').replace(/\/+$/, '');

const config = YAML.parse(fs.readFileSync('config/mirror.yml', 'utf8'));
const preserve = new Set(config.sync?.preserve_pages || []);
const docsDir = path.resolve('docs');
const staging = path.resolve('docs.new');
if (path.basename(docsDir) !== 'docs') throw new Error(`refusing to replace ${docsDir}`);

function walk(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) files.push(file);
  }
  return files;
}

/** Relative paths of every page, which is what the guards and diffs use. */
function pageSet(dir) {
  return new Set(walk(dir).map((file) => path.relative(dir, file).split(path.sep).join('/')));
}

// 1. Stage the new tree and prove it is a documentation tree before touching
//    the installed one.
const stagingSet = (() => {
  fs.rmSync(staging, {recursive: true, force: true});
  fs.cpSync(source, staging, {recursive: true});
  const pages = pageSet(staging);
  if (!pages.size) throw new Error(`${source} contains no markdown pages`);
  if (!pages.has('introduction.md') && !pages.has('index.md')) {
    throw new Error(`${source} has neither introduction.md nor index.md; is it a docs tree?`);
  }
  return pages;
})();
console.log(`staged ${stagingSet.size} pages from ${source}`);

// 2. Swap. The retired tree is kept under .work/ until the swap succeeded so a
//    crash in the middle never loses it.
const retired = path.resolve('.work/install', `docs-retired-${Date.now()}`);
fs.mkdirSync(path.dirname(retired), {recursive: true});
fs.renameSync(docsDir, retired);
fs.renameSync(staging, docsDir);
console.log(`installed ${source} -> docs/ (previous tree kept at ${path.relative(process.cwd(), retired)})`);

// 3. Mirror-owned pages: local content wins, and a page the official export
//    does not publish is carried over instead of disappearing.
const currentSet = pageSet(docsDir);
let carried = 0;
let kept = 0;
for (const page of preserve) {
  const rel = page.replace(/\.md$/, '').replace(/^\/+|\/+$/g, '');
  const candidates = [`${rel}.md`, `${rel}/index.md`];
  for (const candidate of candidates) {
    const local = path.join(retired, candidate);
    if (!fs.existsSync(local)) continue;
    const target = path.join(docsDir, candidate);
    if (!currentSet.has(candidate)) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(local, target);
      currentSet.add(candidate);
      carried++;
      console.log(`carried mirror-owned page ${candidate}`);
    } else {
      // The official release now publishes this page; the mirror version wins
      // because it may need mirror-local components.
      fs.copyFileSync(local, target);
      kept++;
      console.log(`kept mirror-owned page ${candidate} over the official copy`);
    }
  }
}

// 4. A versioned export (older releases) still points at its own prefix; the
//    installed tree must be unversioned.
let rewritten = 0;
for (const file of walk(docsDir)) {
  const text = fs.readFileSync(file, 'utf8');
  const next = rewriteDocsLinks(text, `/docs/${version}/`, '/docs/', {source: true});
  if (next !== text) {
    fs.writeFileSync(file, next);
    rewritten++;
  }
}
console.log(`rewrote /docs/${version}/ -> /docs/ in ${rewritten} files`);

// Official 7.25 nests routing under user-guides; older captures kept it at the
// top level and carried the public path in `slug`.
const routing = path.join(docsDir, 'routing-and-networking-protocols');
const userGuides = path.join(docsDir, 'user-guides');
if (fs.existsSync(routing)) {
  fs.mkdirSync(userGuides, {recursive: true});
  fs.renameSync(routing, path.join(userGuides, 'routing-and-networking-protocols'));
  console.log('moved routing-and-networking-protocols under user-guides/');
}
const routingCategory = path.join(userGuides, 'routing-and-networking-protocols', '_category_.json');
if (fs.existsSync(routingCategory)) {
  const category = JSON.parse(fs.readFileSync(routingCategory, 'utf8'));
  if (category.key === 'routing-and-networking-protocols') {
    category.key = 'user-guides/routing-and-networking-protocols';
  }
  if (category.link?.id === 'routing-and-networking-protocols/index') {
    category.link.id = 'user-guides/routing-and-networking-protocols/index';
  }
  fs.writeFileSync(routingCategory, JSON.stringify(category, null, 2) + '\n');
}

async function userGuidesPage() {
  const response = await fetch(`${BASE}${routeBase}/user-guides.md`, {
    headers: {'user-agent': 'mikrotik-manual-mirror/1.0'},
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseGenerated(raw) {
  let text = raw.replace(/\r\n/g, '\n').trimStart();
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) text = text.slice(end + 4).trimStart();
  }
  const title = text.match(/^#\s+(.+)\n/)?.[1]?.trim() || 'User Guides';
  text = text.replace(/^#\s+.+\n+/, '');
  const description = text.match(/^>\s*(.+)\n/)?.[1]?.trim() || '';
  text = text.replace(/^>\s*.+\n+/, '');
  text = text.replace(/^#\s+.+\n+/, '');
  return {title, description, body: text.trimStart()};
}

const userGuidesIndex = path.join(userGuides, 'index.md');
if (!fs.existsSync(userGuidesIndex)) {
  const parsed = parseGenerated(await userGuidesPage());
  const body = parsed.body.replace(
    /\]\(\.\/routing-and-networking-protocols\/index\.md\)/g,
    '](/docs/user-guides/routing-and-networking-protocols/)',
  );
  fs.mkdirSync(userGuides, {recursive: true});
  fs.writeFileSync(
    userGuidesIndex,
    `---\ntitle: ${JSON.stringify(parsed.title)}\nsidebar_label: ${JSON.stringify(
      parsed.title,
    )}\ndescription: ${JSON.stringify(parsed.description)}\nsource: ${BASE}${routeBase}/user-guides\n---\n\n${body}`,
  );
  console.log('added user-guides/index.md from the official page');
}

// 5. Carry the outgoing translation forward before the version pointer moves:
//    the overlay of `current/` describes the version that just became an
//    archive, and nothing in the translation pipeline may rewrite it.
const overlayRoot = path.resolve('i18n/zh-Hans/docusaurus-plugin-content-docs');
const fromOverlay = path.join(overlayRoot, 'current');
const toOverlay = path.join(overlayRoot, `version-${current}`);
if (version !== current && fs.existsSync(fromOverlay) && !fs.existsSync(toOverlay)) {
  fs.renameSync(fromOverlay, toOverlay);
  console.log(`moved translation overlay current/ -> version-${current}/`);
}
const fromUi = path.join(overlayRoot, 'current.json');
const toUi = path.join(overlayRoot, `version-${current}.json`);
if (version !== current && fs.existsSync(fromUi) && !fs.existsSync(toUi)) {
  fs.renameSync(fromUi, toUi);
  console.log(`moved sidebar catalogue current.json -> version-${current}.json`);
}

// The translation state keys are section-prefixed; move the outgoing version's
// entries to the archive so a later `apply` does not think they are current.
const stateFile = path.resolve('state/translation-state.json');
if (version !== current && fs.existsSync(stateFile)) {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const oldPrefix = 'docs/';
  const newPrefix = `versioned_docs/version-${current}/`;
  const files = {};
  let moved = 0;
  for (const [key, entry] of Object.entries(state.files || {})) {
    if (key.startsWith(oldPrefix)) {
      const nextKey = `${newPrefix}${key.slice(oldPrefix.length)}`;
      files[nextKey] = {
        ...entry,
        section: `docs-${current}`,
        source: nextKey,
        overlay: String(entry.overlay || '').replace(
          'docusaurus-plugin-content-docs/current',
          `docusaurus-plugin-content-docs/version-${current}`,
        ),
      };
      moved++;
    } else {
      files[key] = entry;
    }
  }
  state.files = files;
  if (state.sections?.docs) {
    state.sections[`docs-${current}`] = state.sections.docs;
    delete state.sections.docs;
  }
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 1)}\n`);
  console.log(`moved ${moved} translation-state entries to version-${current}`);
}

// 6. Record the new current version.
fs.writeFileSync(
  'data/manifests/current-version.json',
  JSON.stringify(
    {
      version,
      rule: 'The external content workflow writes the current version here; Docusaurus serves docs/ at /docs and snapshots at /docs/<version>.',
    },
    null,
    2,
  ) + '\n',
);
console.log(`current-version.json -> ${version}`);

console.log(
  `docs markdown files: ${walk(docsDir).length} (mirror-owned carried: ${carried}, local wins: ${kept})`,
);
