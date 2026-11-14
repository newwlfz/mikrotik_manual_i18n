import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://manual.mikrotik.com';
const ROUTES = JSON.parse(
  fs.readFileSync('data/manifests/docs-7.24-routes-from-source.json', 'utf8'),
);
const OUT = 'versioned_docs/version-7.24';
const RAW = '../.work/official-md-7.24';
const CONCURRENCY = Number(process.env.SYNC_CONCURRENCY || 6);
const LIMIT = process.env.SYNC_LIMIT ? Number(process.env.SYNC_LIMIT) : 0;

fs.mkdirSync(RAW, {recursive: true});

function target(route) {
  const clean = route.replace(/\/+$/, '');
  return route.endsWith('/') ? `${clean}/index.md` : `${clean}.md`;
}

function splitGenerated(raw) {
  let text = raw.replace(/\r\n/g, '\n').trimStart();
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) text = text.slice(end + 4).trimStart();
  }
  let title = null;
  let summary = null;
  let m = text.match(/^#\s+(.+)\n/);
  if (m) {
    title = m[1].trim();
    text = text.slice(m[0].length).trimStart();
  }
  m = text.match(/^>\s*(.+)\n/);
  if (m) {
    summary = m[1].trim();
    text = text.slice(m[0].length).trimStart();
  }
  text = text.replace(/^-{3,}\s*\n+/, '');
  // Some CLI pages repeat the title as the first H1 after the generated block.
  text = text.replace(/^#\s+(.+)\n+/, (whole, h1) => {
    if (!title) title = h1.trim();
    return '';
  });
  return {title, summary, body: text.trimStart()};
}

function frontmatter(oldTitle, title, position) {
  const safe = JSON.stringify(title || oldTitle || 'Untitled');
  return `---\ntitle: ${safe}\nsidebar_label: ${safe}\nsidebar_position: ${position}\n---\n\n`;
}

function oldFrontmatter(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const raw = text.slice(3, end);
  const title = raw.match(/^title:\s*["']?(.*?)["']?\s*$/m)?.[1];
  const position = Number(raw.match(/^sidebar_position:\s*(\d+)/m)?.[1] || 999);
  return {title, position};
}

async function fetchRetry(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': 'mikrotik-manual-mirror/1.0'},
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw last;
}

let cursor = 0;
let ok = 0;
const failures = [];

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= ROUTES.length || (LIMIT && index >= LIMIT)) return;
    const route = ROUTES[index];
    const url = `${BASE}/docs/7.24/${route.replace(/\/+$/, '')}.md`;
    try {
      const raw = await fetchRetry(url);
      const parsed = splitGenerated(raw);
      const file = path.join(OUT, target(route));
      const old = oldFrontmatter(file);
      const title = parsed.title || old?.title || route.split('/').filter(Boolean).at(-1) || 'Untitled';
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, frontmatter(old?.title, title, old?.position ?? 999) + parsed.body, 'utf8');
      const rawFile = path.join(RAW, target(route));
      fs.mkdirSync(path.dirname(rawFile), {recursive: true});
      fs.writeFileSync(rawFile, raw, 'utf8');
      ok++;
      if (ok % 50 === 0) console.log(`fetched ${ok}/${ROUTES.length}`);
    } catch (error) {
      failures.push({route, url, error: error.message});
      console.error('FAIL', route, error.message);
    }
  }
}

await Promise.all(Array.from({length: CONCURRENCY}, worker));
fs.writeFileSync(
  'data/manifests/docs-7.24-fetch-result.json',
  JSON.stringify({total: ROUTES.length, ok, failures}, null, 2) + '\n',
);
console.log(`done ok=${ok} failures=${failures.length}`);
