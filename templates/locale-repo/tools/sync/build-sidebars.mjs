import fs from 'node:fs';
import path from 'node:path';
import {readField} from '../translate/lib/frontmatter.mjs';

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
  const flat = (candidate) =>
    fs.existsSync(`${docsDir}/${candidate}.md`) || fs.existsSync(`${docsDir}/${candidate}.mdx`);
  const asIndex = (candidate) =>
    fs.existsSync(`${docsDir}/${candidate}/index.md`) || fs.existsSync(`${docsDir}/${candidate}/index.mdx`);
  if (flat(id)) return id;
  if (asIndex(id)) return `${id}/index`;
  // The crawl turns every href ending in `/` into `<route>/index`, but the
  // official Markdown export addresses that page as `<route>.md` and the
  // mirror installs it flat. Accept either spelling of the same page.
  if (id.endsWith('/index') && flat(id.slice(0, -'/index'.length))) {
    return id.slice(0, -'/index'.length);
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

// The compare page is a mirror-local page that only exists in the current
// version. The official site lists it last in CLI Reference for every version,
// so a versioned build links to the current page instead of inventing an id.
const comparePage = `${docsDir}/cli-reference/compare-versions.md`;
{
  const cli = findCategory(tree.docs, 'CLI Reference');
  if (!cli) throw new Error('CLI Reference category not found');
  const rest = cli.items.filter(
    (item) => item.id !== 'cli-reference/compare-versions' && item.label !== 'Version comparison',
  );
  const entry = fs.existsSync(comparePage)
    ? {type: 'doc', id: 'cli-reference/compare-versions', label: 'Version comparison', key: 'cli-reference/compare-versions'}
    : {type: 'link', label: 'Version comparison', href: '/docs/cli-reference/compare-versions', key: 'version-comparison'};
  cli.items = [...rest, entry];
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

// Every item gets an explicit translation key: the sidebar contains repeated
// labels ("User Guides", "interface", "port"), and Docusaurus refuses to write
// or read a translation catalogue whose keys collide by label.
function slug(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function assignKeys(items, parentPath = '') {
  for (const item of items) {
    if (item.type === 'doc') {
      if (!item.key) item.key = item.id;
      continue;
    }
    const dir = item.link?.id ? item.link.id.replace(/\/index$/, '') : null;
    const key = dir ?? (parentPath ? `${parentPath}/${slug(item.label)}` : slug(item.label));
    if (!item.key) item.key = key;
    if (item.items) assignKeys(item.items, item.key);
  }
}
assignKeys(tree.docs);

/**
 * Guards for the label-path based crawl. A silent merge here is invisible in the
 * UI until someone compares a whole section by hand, so fail the build instead:
 * every doc must be unique, every category must have children, and every
 * category translation key must be unique.
 */
function checkTree(items, where) {
  const docIds = new Map();
  const catKeys = new Map();
  const walk = (list, trail) => {
    for (const item of list) {
      if (item.type === 'doc' || item.type === 'ref') {
        docIds.set(item.id, [...(docIds.get(item.id) || []), trail.join('/')]);
        continue;
      }
      if (item.type !== 'category') continue;
      const path = [...trail, item.label].join('/');
      catKeys.set(item.key ?? item.label, [...(catKeys.get(item.key ?? item.label) || []), path]);
      if (!item.items?.length) throw new Error(`${where}: category '${path}' has no items`);
      walk(item.items, [...trail, item.label]);
    }
  };
  walk(items, []);
  for (const [id, places] of docIds) {
    if (places.length > 1) {
      throw new Error(`${where}: doc '${id}' appears ${places.length} times (${places.join(' | ')})`);
    }
  }
  for (const [key, paths] of catKeys) {
    if (paths.length > 1) {
      throw new Error(`${where}: category key '${key}' used by ${paths.join(' | ')}`);
    }
  }
}
checkTree(tree.docs, `sidebar ${version}`);

// ---------------------------------------------------------------------------
// Merge pages the crawl could not reach.
//
// A category page that 404s on the official site (several `*/install/` branches
// do) takes its whole subtree with it, even though every page still carries its
// own `sidebar_key` and `sidebar_position`. Those pages are merged back from
// their front matter, inserted at the position their own metadata declares, so
// an existing order is never rewritten.
// ---------------------------------------------------------------------------

function readDocMeta(dir, prefix = '', out = new Map()) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      readDocMeta(full, rel, out);
      continue;
    }
    if (!/\.mdx?$/.test(entry.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!fm) continue;
    const field = (name) => readField(fm[1], name);
    out.set(rel.replace(/\.mdx?$/, ''), {
      key: field('sidebar_key'),
      position: Number(field('sidebar_position') ?? Number.MAX_SAFE_INTEGER),
      // `readField` unquotes YAML scalars; the previous inline regex kept the
      // single quotes, so `sidebar_label: 'IPv6 Addresses'` reached the sidebar
      // as `'IPv6 Addresses'`.
      label: field('sidebar_label') || field('title'),
    });
  }
  return out;
}

function mergeUnreachablePages(items, meta) {
  if (!meta.size) return {added: 0, orphans: []};
  const present = new Set();
  const categories = new Map();
  const stripIndex = (id) => String(id).replace(/\/index$/, '');
  const collect = (list) => {
    for (const item of list) {
      if (item.type === 'doc') {
        present.add(item.id);
        present.add(stripIndex(item.id));
        continue;
      }
      if (item.link?.id) {
        present.add(item.link.id);
        present.add(stripIndex(item.link.id));
        // A category whose landing page 404s can carry a child page as its link
        // id (`caps-man` -> `caps-man/aaa`). Register the path up to the label,
        // so pages under the category still find it.
        const segments = stripIndex(item.link.id).split('/');
        const label = String(item.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const at = segments.lastIndexOf(label);
        const categoryPath = at > 0 ? segments.slice(0, at + 1).join('/') : segments.slice(0, -1).join('/');
        if (categoryPath && !categories.has(categoryPath)) categories.set(categoryPath, item);
      }
      if (item.key && !categories.has(item.key)) categories.set(item.key, item);
      if (item.items) collect(item.items);
    }
  };
  collect(items);

  const positionOf = (item) => {
    if (item.type === 'doc') {
      return meta.get(item.id)?.position ?? Number.MAX_SAFE_INTEGER;
    }
    const positions = (item.items || []).map(positionOf);
    return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
  };

  const created = [];
  const parents = new Map();
  // A category whose landing page 404s is dropped from the crawl (no link, no
  // children). Recreate it from the page keys so its children have a home.
  const ensureCategory = (keyPath) => {
    if (categories.has(keyPath)) return categories.get(keyPath);
    const parts = keyPath.split('/');
    if (parts.length < 2) return null;
    const parent = ensureCategory(parts.slice(0, -1).join('/'));
    if (!parent) return null;
    const item = {type: 'category', label: parts[parts.length - 1], key: keyPath, items: []};
    parent.items = parent.items || [];
    parent.items.push(item);
    categories.set(keyPath, item);
    parents.set(keyPath, parent);
    created.push(item);
    return item;
  };

  const candidates = [];
  const orphans = [];
  for (const [id, info] of meta) {
    if (!info.key || present.has(id) || present.has(stripIndex(id))) continue;
    const parts = info.key.split('/');
    let parent = null;
    for (let n = parts.length - 1; n >= 1; n--) {
      parent = ensureCategory(parts.slice(0, n).join('/'));
      if (parent) break;
    }
    if (!parent) {
      orphans.push(id);
      continue;
    }
    candidates.push({
      parent,
      item: {type: 'doc', id, label: info.label || id, key: info.key},
      position: info.position,
    });
  }

  candidates.sort((a, b) => a.position - b.position);
  for (const candidate of candidates) {
    const list = candidate.parent.items;
    let index = list.findIndex((entry) => positionOf(entry) > candidate.position);
    if (index === -1) index = list.length;
    list.splice(index, 0, candidate.item);
  }

  return {added: candidates.length, orphans, created: created.length};
}

{
  // Every version merges its own pages: the missing branches differ per release.
  const {added, orphans, created} = mergeUnreachablePages(tree.docs, readDocMeta(docsDir));
  console.log(`merged ${added} page(s) and ${created} category/categories the crawl could not reach`);
  if (orphans.length) {
    console.warn(
      `warning: ${orphans.length} page(s) carry a sidebar_key without a matching category: ${orphans.slice(0, 5).join(', ')}`,
    );
  }
}

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
