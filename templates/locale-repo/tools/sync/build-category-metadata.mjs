import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const current = JSON.parse(
  fs.readFileSync('data/manifests/current-version.json', 'utf8'),
).version;
const VERSION = arg('version', current);
const OUT = arg('out', `data/manifests/docs-${VERSION}-categories.json`);
const SIDEBAR = arg(
  'sidebar',
  VERSION === current
    ? 'sidebars.ts'
    : `versioned_sidebars/version-${VERSION}-sidebars.json`,
);

let tree;
if (SIDEBAR.endsWith('.ts')) {
  const source = fs.readFileSync(SIDEBAR, 'utf8');
  const match = source.match(/const sidebars: SidebarsConfig = ([\s\S]*?);\n\nexport default/);
  if (!match) throw new Error(`cannot parse ${SIDEBAR}`);
  tree = JSON.parse(match[1]).docs;
} else {
  tree = JSON.parse(fs.readFileSync(SIDEBAR, 'utf8')).docs;
}

const categories = {};
function walk(items, parent = '') {
  for (const item of items) {
    if (item.type !== 'category') continue;
    const key = parent ? `${parent}/${item.label}` : item.label;
    categories[key] = {
      label: item.label,
      parent,
      link: item.link ?? null,
      items: item.items?.length ?? 0,
      order: Object.keys(categories).length + 1,
    };
    walk(item.items ?? [], key);
  }
}
walk(tree);
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(
  OUT,
  JSON.stringify({version: VERSION, categories}, null, 2) + '\n',
);
console.log(
  `[${VERSION}] wrote ${OUT} categories=${Object.keys(categories).length} sidebar=${SIDEBAR}`,
);
