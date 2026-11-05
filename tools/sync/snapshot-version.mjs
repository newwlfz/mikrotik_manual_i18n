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
const version = arg('version', current);
const source = arg('docs', 'docs');
const target = `versioned_docs/version-${version}`;
const BASE = 'https://manual.mikrotik.com';

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

// The comparison page is a current-version page. Official historical versions
// do not publish it, so a snapshot must not inherit it.
const compare = path.join(target, 'cli-reference', 'compare-versions.md');
if (fs.existsSync(compare)) {
  fs.rmSync(compare);
  console.log('removed current-only cli-reference/compare-versions.md from snapshot');
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
for (const file of walk(target)) {
  const text = fs.readFileSync(file, 'utf8');
  const next = rewriteDocsLinks(text, '/docs/', `/docs/${version}/`, {source: true});
  if (next !== text) {
    fs.writeFileSync(file, next);
    rewritten++;
  }
}
console.log(`rewrote /docs/ -> /docs/${version}/ in ${rewritten} files`);

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

const userGuides = path.join(target, 'user-guides', 'index.md');
if (!fs.existsSync(userGuides)) {
  const parsed = parseGenerated(await userGuidesPage());
  const body = parsed.body.replace(
    /\]\(\.\/routing-and-networking-protocols\/index\.md\)/g,
    `](/docs/${version}/user-guides/routing-and-networking-protocols/)`,
  );
  fs.mkdirSync(path.dirname(userGuides), {recursive: true});
  fs.writeFileSync(
    userGuides,
    `---\ntitle: ${JSON.stringify(parsed.title)}\nsidebar_label: ${JSON.stringify(
      parsed.title,
    )}\ndescription: ${JSON.stringify(parsed.description)}\nsource: ${BASE}/docs/${version}/user-guides\n---\n\n${body}`,
  );
  console.log('added user-guides/index.md from the official page');
}

// A versioned sidebar is a native Docusaurus JSON sidebar. It is the current
// 7.24 tree minus pages that only exist in the current version.
const sidebarSource = fs.readFileSync('sidebars.ts', 'utf8');
const sidebarMatch = sidebarSource.match(
  /const sidebars: SidebarsConfig = ([\s\S]*?);\n\nexport default/,
);
if (!sidebarMatch) throw new Error('cannot parse sidebars.ts');
const tree = JSON.parse(sidebarMatch[1]);
const currentOnly = new Set(['cli-reference/compare-versions']);
function prune(items) {
  return items
    .filter((item) => !(item.type === 'doc' && currentOnly.has(item.id)))
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
