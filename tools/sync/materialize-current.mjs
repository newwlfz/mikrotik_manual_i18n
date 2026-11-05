import fs from 'node:fs';
import path from 'node:path';

const VERSIONED = 'versioned_docs';
const OUT = '.generated/current-docs';
const SIDEBAR = '.generated/current-sidebars.json';

function versionKey(name) {
  return name
    .replace(/^version-/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

const versions = fs
  .readdirSync(VERSIONED, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('version-'))
  .map((entry) => entry.name)
  .sort((a, b) => {
    const aa = versionKey(a);
    const bb = versionKey(b);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
      if ((aa[i] ?? 0) !== (bb[i] ?? 0)) return (aa[i] ?? 0) - (bb[i] ?? 0);
    }
    return a.localeCompare(b);
  });

if (!versions.length) throw new Error('no versioned_docs/version-* directories found');
const latest = versions.at(-1);
const latestName = latest.replace(/^version-/, '');

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.cpSync(path.join(VERSIONED, latest), OUT, {recursive: true});

const versionPrefix = `/docs/${latestName}/`;
const rewrite = (dir) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewrite(file);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      const source = fs.readFileSync(file, 'utf8');
      const next = source
        .replaceAll(versionPrefix, '/docs/')
        .replaceAll(`pathname://${versionPrefix}`, 'pathname:///docs/');
      if (next !== source) fs.writeFileSync(file, next);
    }
  }
};
rewrite(OUT);

const sidebar = path.join('versioned_sidebars', `version-${latestName}-sidebars.json`);
fs.mkdirSync(path.dirname(SIDEBAR), {recursive: true});
fs.copyFileSync(sidebar, SIDEBAR);
console.log(`current=${latestName} docs=${OUT} sidebar=${SIDEBAR}`);
