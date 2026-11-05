import fs from 'node:fs';

const ORDER = JSON.parse(fs.readFileSync('data/manifests/sidebar-order.json', 'utf8'));
const first = new Set(ORDER.specialFirst ?? []);
const file = 'sidebars.ts';
const source = fs.readFileSync(file, 'utf8');
const match = source.match(/const sidebars: SidebarsConfig = ([\s\S]*?);\n\nexport default/);
if (!match) throw new Error('cannot parse sidebars.ts');
const tree = JSON.parse(match[1]);
function walk(items) {
  const special = items.filter((item) => first.has(item.id));
  const rest = items.filter((item) => !first.has(item.id));
  for (const item of rest) walk(item.items ?? []);
  return [...special, ...rest];
}
tree.docs = walk(tree.docs);
fs.writeFileSync(
  file,
  "import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';\n\nconst sidebars: SidebarsConfig = " +
    JSON.stringify(tree, null, 2) +
    ";\n\nexport default sidebars;\n",
);
console.log('sidebar order applied');
