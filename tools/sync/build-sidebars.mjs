import fs from 'node:fs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const current = JSON.parse(
  fs.readFileSync('data/manifests/current-version.json', 'utf8'),
).version;
const version = arg('version', current);
const sidebarFile = arg('sidebar', `data/manifests/docs-${version}-sidebar.json`);
const docsDir = arg('docs', 'docs');
const addCompare = process.argv.includes('--compare');
const applyOrder = !process.argv.includes('--no-order');

if (!fs.existsSync(sidebarFile)) throw new Error(`missing ${sidebarFile}`);
const crawled = JSON.parse(fs.readFileSync(sidebarFile, 'utf8'));
const tree = {docs: crawled.docs};

// The official sidebar links omit the trailing slash, so a category landing
// page can appear as `foo` while its file is `foo/index.md`. Resolve every id
// against the installed content instead of guessing from the href.
const unresolved = new Set();
function resolveId(id) {
  if (!id) return id;
  if (fs.existsSync(`${docsDir}/${id}.md`) || fs.existsSync(`${docsDir}/${id}.mdx`)) {
    return id;
  }
  if (
    fs.existsSync(`${docsDir}/${id}/index.md`) ||
    fs.existsSync(`${docsDir}/${id}/index.mdx`)
  ) {
    return `${id}/index`;
  }
  unresolved.add(id);
  return id;
}
function resolveTree(items) {
  for (const item of items) {
    if (item.type === 'doc') item.id = resolveId(item.id);
    else {
      if (item.link?.type === 'doc') item.link.id = resolveId(item.link.id);
      if (item.items) resolveTree(item.items);
    }
  }
}
resolveTree(tree.docs);

if (addCompare) {
  const cli = findCategory(tree.docs, 'CLI Reference');
  if (!cli) throw new Error('CLI Reference category not found');
  cli.items = [
    {
      type: 'doc',
      id: 'cli-reference/compare-versions',
      label: 'Version comparison',
    },
    ...cli.items.filter((item) => item.id !== 'cli-reference/compare-versions'),
  ];
}

function findCategory(items, label) {
  for (const item of items) {
    if (item.type === 'category' && item.label === label) return item;
    if (item.items) {
      const found = findCategory(item.items, label);
      if (found) return found;
    }
  }
  return null;
}

function applySpecialFirst(items) {
  const order = JSON.parse(
    fs.readFileSync('data/manifests/sidebar-order.json', 'utf8'),
  );
  const first = new Set(order.specialFirst ?? []);
  function walk(entries) {
    const special = entries.filter((item) => first.has(item.id));
    const rest = entries.filter((item) => !first.has(item.id));
    for (const item of rest) {
      if (item.items) item.items = walk(item.items);
    }
    return [...special, ...rest];
  }
  return walk(items);
}

if (applyOrder) tree.docs = applySpecialFirst(tree.docs);

if (version === current) {
  fs.writeFileSync(
    'sidebars.ts',
    "import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';\n\nconst sidebars: SidebarsConfig = " +
      JSON.stringify(tree, null, 2) +
      ";\n\nexport default sidebars;\n",
  );
  console.log(`wrote sidebars.ts for current ${version}`);
} else {
  fs.mkdirSync('versioned_sidebars', {recursive: true});
  fs.writeFileSync(
    `versioned_sidebars/version-${version}-sidebars.json`,
    JSON.stringify(tree, null, 2) + '\n',
  );
  console.log(`wrote versioned_sidebars/version-${version}-sidebars.json`);
}

function count(items) {
  let docs = 0;
  let categories = 0;
  for (const item of items) {
    if (item.type === 'doc') docs++;
    else {
      categories++;
      const nested = count(item.items ?? []);
      docs += nested.docs;
      categories += nested.categories;
    }
  }
  return {docs, categories};
}

console.log(JSON.stringify({version, ...count(tree.docs)}));
