import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';

const CONFIG = YAML.parse(fs.readFileSync('config/mirror.yml', 'utf8'));
const STATE_FILE = CONFIG.sync.state_file;
const BACKUP = '../incoming/legacy/site';
const SECTIONS = {
  docs: 'versioned_docs/version-7.24',
  hardware: 'hardware',
  blog: 'blog',
  changelog: 'changelog',
};

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) files.push(file);
  }
  return files;
}

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = text.slice(3, end);
  const out = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function sourceFor(section, rel, fm) {
  if (fm.source) return fm.source;
  const route = rel.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '');
  if (section === 'docs') return `https://manual.mikrotik.com/docs/7.24/${route}`;
  return `https://manual.mikrotik.com/${section}/${route}`;
}

function scan() {
  const entries = {};
  for (const [section, dir] of Object.entries(SECTIONS)) {
    for (const file of walk(dir)) {
      const rel = path.relative(dir, file);
      const fm = frontmatter(file);
      const key = `${section}:${rel}`;
      entries[key] = {
        section,
        local_path: file,
        source_url: sourceFor(section, rel, fm),
        sha256: hash(file),
        bytes: fs.statSync(file).size,
        synced_at: new Date().toISOString(),
      };
    }
  }
  return entries;
}

function writeState(entries) {
  fs.mkdirSync(path.dirname(STATE_FILE), {recursive: true});
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({schema: 1, source: CONFIG.source.base_url, version: '7.24', entries: sorted}, null, 2) + '\n',
  );
}

const args = process.argv.slice(2);
const mode = args.find((a) => a.startsWith('--')) || '--check';

if (mode === '--bootstrap') {
  const entries = scan();
  writeState(entries);
  console.log(`bootstrapped ${Object.keys(entries).length} entries`);
  process.exit(0);
}

if (!fs.existsSync(STATE_FILE)) {
  console.error(`missing ${STATE_FILE}; run --bootstrap first`);
  process.exit(2);
}

const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
if (mode === '--check') {
  const missing = [];
  const changed = [];
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!fs.existsSync(entry.local_path)) missing.push(key);
    else if (hash(entry.local_path) !== entry.sha256) changed.push(key);
  }
  console.log(`entries=${Object.keys(state.entries).length} missing=${missing.length} changed=${changed.length}`);
  for (const key of missing.slice(0, 20)) console.log('MISSING', key);
  for (const key of changed.slice(0, 20)) console.log('CHANGED', key);
  process.exit(missing.length || changed.length ? 1 : 0);
}

if (mode === '--repair') {
  let repaired = 0;
  const failed = [];
  for (const [key, entry] of Object.entries(state.entries)) {
    if (fs.existsSync(entry.local_path) && hash(entry.local_path) === entry.sha256) continue;
    const rel = key.slice(key.indexOf(':') + 1);
    const candidates = [
      path.join(BACKUP, entry.section, rel),
      path.join(BACKUP, SECTIONS[entry.section], rel),
    ];
    const backup = candidates.find((candidate) => fs.existsSync(candidate));
    if (!backup) {
      failed.push(key);
      continue;
    }
    fs.mkdirSync(path.dirname(entry.local_path), {recursive: true});
    fs.copyFileSync(backup, entry.local_path);
    entry.sha256 = hash(entry.local_path);
    entry.bytes = fs.statSync(entry.local_path).size;
    entry.synced_at = new Date().toISOString();
    repaired++;
    console.log('REPAIRED', key);
  }
  writeState(state.entries);
  console.log(`repaired=${repaired} failed=${failed.length}`);
  if (failed.length) console.log(failed);
  process.exit(failed.length ? 1 : 0);
}

if (mode === '--update') {
  console.error('Full update is not enabled yet. Use tools/sync/fetch-docs.mjs for docs bootstrap or --repair for missing files.');
  process.exit(2);
}

console.error('usage: node tools/sync/index.mjs --bootstrap|--check|--repair|--update');
process.exit(2);
