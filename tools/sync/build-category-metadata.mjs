import fs from 'node:fs';
import path from 'node:path';

const VERSION = JSON.parse(fs.readFileSync('data/manifests/current-version.json', 'utf8')).version;
const OUT = `data/manifests/docs-${VERSION}-categories.json`;
const source = fs.readFileSync('sidebars.ts', 'utf8');
const match = source.match(/const sidebars: SidebarsConfig = ([\s\S]*?);\n\nexport default/);
if (!match) throw new Error('cannot parse sidebars.ts');
const tree = JSON.parse(match[1]).docs;
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
fs.writeFileSync(OUT, JSON.stringify({version: VERSION, categories}, null, 2) + '\n');
console.log(`wrote ${OUT} categories=${Object.keys(categories).length}`);
