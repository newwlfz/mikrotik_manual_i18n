import fs from 'node:fs';
import path from 'node:path';
import {rewriteDocsLinks} from './lib/rewrite-links.mjs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const current = JSON.parse(
  fs.readFileSync('data/manifests/current-version.json', 'utf8'),
).version;
const version = arg('version');
const source = arg('source');
const force = process.argv.includes('--force');
const BASE = 'https://manual.mikrotik.com';

if (!version) throw new Error('usage: node tools/sync/install-version.mjs --version 7.25 --source <dir>');
if (!source || !fs.existsSync(source)) throw new Error(`missing source directory ${source}`);
if (version === current && !force) throw new Error(`version ${version} is already current`);

const docsDir = path.resolve('docs');
if (path.basename(docsDir) !== 'docs') throw new Error(`refusing to replace ${docsDir}`);

const comparePage = path.join(docsDir, 'cli-reference', 'compare-versions.md');
const compareSource = fs.existsSync(comparePage)
  ? fs.readFileSync(comparePage)
  : null;

fs.rmSync(docsDir, {recursive: true, force: true});
fs.cpSync(source, docsDir, {recursive: true});
console.log(`installed ${source} -> docs/`);

// Official 7.25 nests routing under user-guides; the legacy capture kept the
// files at the top level and carried the public path in `slug`.
const routing = path.join(docsDir, 'routing-and-networking-protocols');
const userGuides = path.join(docsDir, 'user-guides');
if (fs.existsSync(routing)) {
  fs.mkdirSync(userGuides, {recursive: true});
  fs.renameSync(routing, path.join(userGuides, 'routing-and-networking-protocols'));
  console.log('moved routing-and-networking-protocols under user-guides/');
}
const routingCategory = path.join(
  userGuides,
  'routing-and-networking-protocols',
  '_category_.json',
);
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
  const response = await fetch(`${BASE}/docs/${version}/user-guides.md`, {
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
    )}\ndescription: ${JSON.stringify(parsed.description)}\nsource: ${BASE}/docs/${version}/user-guides\n---\n\n${body}`,
  );
  console.log('added user-guides/index.md from the official page');
}

// The comparison page belongs to the current version. It is not in the
// historical source tree, so carry the 7.24 page forward.
if (compareSource) {
  const target = path.join(docsDir, 'cli-reference', 'compare-versions.md');
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, compareSource);
  console.log('kept cli-reference/compare-versions.md as a current-version page');
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

let rewritten = 0;
for (const file of walk(docsDir)) {
  const text = fs.readFileSync(file, 'utf8');
  const next = rewriteDocsLinks(text, `/docs/${version}/`, '/docs/');
  if (next !== text) {
    fs.writeFileSync(file, next);
    rewritten++;
  }
}
console.log(`rewrote /docs/${version}/ -> /docs/ in ${rewritten} files`);

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

const md = walk(docsDir).length;
console.log(`docs markdown files: ${md}`);
