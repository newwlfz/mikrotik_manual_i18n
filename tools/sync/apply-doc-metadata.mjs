import fs from 'node:fs';
import path from 'node:path';

const VERSION = JSON.parse(fs.readFileSync('data/manifests/current-version.json', 'utf8')).version;
const META = `data/manifests/docs-${VERSION}-metadata.json`;
const LABELS = `data/manifests/docs-${VERSION}-sidebar.routes.json`;
const CLI_LINKS = 'data/manifests/cli-links.json';
const DOCS = 'docs';

if (!fs.existsSync(META)) throw new Error(`missing ${META}`);
const metadata = JSON.parse(fs.readFileSync(META, 'utf8')).docs;
const labels = Object.fromEntries(
  JSON.parse(fs.readFileSync(LABELS, 'utf8')).map((row) => [row.id, row.label]),
);

function yamlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function replaceField(source, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (pattern.test(source)) return source.replace(pattern, line);
  return source.replace(/^(title:.*)$/m, `$1\n${line}`);
}

const cliLinks = {};
for (const [id, entry] of Object.entries(metadata)) {
  if (entry.cliLinks?.length) {
    cliLinks[id] = entry.cliLinks.map((link) => ({
      ...link,
      href: link.href.replace(`/docs/${VERSION}/`, '/docs/'),
    }));
  }
}
fs.writeFileSync(CLI_LINKS, JSON.stringify(cliLinks, null, 2) + '\n');
let changed = 0;
for (const [id, entry] of Object.entries(metadata)) {
  const file = path.join(DOCS, id + '.md');
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, 'utf8');
  const original = source;
  if (entry.description) {
    source = replaceField(source, 'description', yamlString(entry.description));
  }
  if (labels[id] && !/^sidebar_label:/m.test(source)) {
    source = replaceField(source, 'sidebar_label', yamlString(labels[id]));
  }
  if (entry.tags?.length) {
    const block = `tags:\n${entry.tags.map((tag) => `  - ${yamlString(tag)}`).join('\n')}`;
    if (/^tags:\n(?:  - .*\n?)*/m.test(source)) {
      source = source.replace(/^tags:\n(?:  - .*\n?)*/m, block + '\n');
    } else {
      source = source.replace(/^description:.*$/m, (line) => `${line}\n${block}`);
    }
  }
  if (source !== original) {
    fs.writeFileSync(file, source);
    changed++;
  }
}
console.log(`updated ${changed} docs`);
