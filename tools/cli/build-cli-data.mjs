import fs from 'node:fs';
import path from 'node:path';

const VERSION = JSON.parse(fs.readFileSync('data/manifests/current-version.json', 'utf8')).version;
const ROOT = 'docs';
const CLI_ROOT = path.join(ROOT, 'cli-reference');
const OUT = `data/cli/${VERSION}/en.json`;

function text(value) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function attrs(source) {
  const out = {};
  for (const m of source.matchAll(/([a-zA-Z0-9_-]+)="([^"]*)"/g)) {
    out[m[1]] = m[2];
  }
  return out;
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

const commands = {};
for (const file of walk(CLI_ROOT)) {
  const source = fs.readFileSync(file, 'utf8');
  const rel = path.relative(CLI_ROOT, file).replace(/\.(md|mdx)$/, '');
  if (rel === 'compare-versions') continue;
  const route = '/cli-reference/' + (rel === 'index' ? '' : rel.replace(/\/index$/, ''));
  const commandPath = '/' + route.replace(/^\/cli-reference\/?/, '');
  const title = source.match(/^title:\s*"?([^"\n]+)"?/m)?.[1]?.trim() || rel.split('/').at(-1);
  const args = [];
  const flags = [];
  const readOnly = [];
  for (const table of source.matchAll(/<ArgTable\b([^>]*)>([\s\S]*?)<\/ArgTable>/g)) {
    const t = attrs(table[1]);
    const kind = (t.c1 || 'Argument').toLowerCase();
    const bucket = kind.includes('flag') ? flags : kind.includes('read') ? readOnly : args;
    for (const row of table[2].matchAll(/<ArgTableRow\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ArgTableRow>)/g)) {
      const a = attrs(row[1]);
      if (!a.arg) continue;
      bucket.push({
        name: a.arg,
        type: a.typ || '',
        mandatory: a.mandatory === '1' || a.mandatory === 'true',
        description: text(row[2] || ''),
      });
    }
  }
  commands[commandPath] = {
    path: commandPath,
    title,
    url: '/docs/7.24/cli-reference/' + rel.replace(/\/index$/, ''),
    arguments: args,
    flags,
    readOnlyArguments: readOnly,
  };
}

const payload = {
  version: VERSION,
  generatedFrom: 'versioned_docs/version-7.24/cli-reference',
  commandCount: Object.keys(commands).length,
  commands,
};
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify(payload) + '\n');
console.log('commands', payload.commandCount, 'bytes', fs.statSync(OUT).size);
