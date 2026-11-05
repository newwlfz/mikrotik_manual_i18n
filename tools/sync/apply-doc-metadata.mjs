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
const DOCS = arg(
  'docs',
  VERSION === current ? 'docs' : `versioned_docs/version-${VERSION}`,
);
const META = arg('meta', `data/manifests/docs-${VERSION}-metadata.json`);
const LABELS = arg('labels', `data/manifests/docs-${VERSION}-sidebar.routes.json`);
const CLI_LINKS = arg('cli-links', `data/manifests/cli-links-${VERSION}.json`);
const VERSION_KEY = VERSION === current ? 'current' : VERSION;

if (!fs.existsSync(META)) throw new Error(`missing ${META}`);
const metadata = JSON.parse(fs.readFileSync(META, 'utf8')).docs;
const labels = fs.existsSync(LABELS)
  ? Object.fromEntries(
      JSON.parse(fs.readFileSync(LABELS, 'utf8')).map((row) => [row.id, row.label]),
    )
  : {};

function yamlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function replaceField(source, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (pattern.test(source)) return source.replace(pattern, line);
  return source.replace(/^(title:.*)$/m, `$1\n${line}`);
}

function insertTags(source, block) {
  if (/^tags:\n(?:  - .*\n?)*/m.test(source)) {
    return source.replace(/^tags:\n(?:  - .*\n?)*/m, block + '\n');
  }
  if (/^description:.*$/m.test(source)) {
    return source.replace(/^description:.*$/m, (line) => `${line}\n${block}`);
  }
  if (/^sidebar_label:.*$/m.test(source)) {
    return source.replace(/^sidebar_label:.*$/m, (line) => `${line}\n${block}`);
  }
  return source.replace(/^(title:.*)$/m, `$1\n${block}`);
}

function localHref(href) {
  const officialPrefix = `/docs/${VERSION}/`;
  if (href.startsWith(officialPrefix)) {
    return VERSION === current
      ? `/docs/${href.slice(officialPrefix.length)}`
      : href;
  }
  if (href.startsWith('/docs/')) {
    return VERSION === current
      ? href
      : `/docs/${VERSION}/${href.slice('/docs/'.length)}`;
  }
  return href;
}

const cliLinks = {};
for (const [id, entry] of Object.entries(metadata)) {
  if (!entry.cliLinks?.length) continue;
  cliLinks[id] = entry.cliLinks.map((link) => ({
    ...link,
    href: localHref(link.href),
  }));
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
    source = insertTags(source, block);
  }
  if (source !== original) {
    fs.writeFileSync(file, source);
    changed++;
  }
}
console.log(
  `[${VERSION}] updated ${changed} docs; cli-links ${VERSION_KEY}=${Object.keys(cliLinks).length}`,
);
