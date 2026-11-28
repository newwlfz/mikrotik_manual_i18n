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
const LOG = arg('log');
const BASE = 'https://manual.mikrotik.com';
const CONCURRENCY = Number(arg('concurrency', '8'));

if (!LOG || !fs.existsSync(LOG)) throw new Error(`missing build log ${LOG}`);

const text = fs.readFileSync(LOG, 'utf8');
const pages = [
  ...new Set(
    [...text.matchAll(/source page path = (\/docs\/[^:\s]+)/g)].map(
      (match) => match[1],
    ),
  ),
];

function resolveFile(page) {
  const clean = page.replace(/^\/docs\//, '').replace(/\/+$/, '');
  const candidates = [
    path.join(DOCS, `${clean}.md`),
    path.join(DOCS, clean, 'index.md'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function routeFor(file) {
  return path
    .relative(DOCS, file)
    .replace(/\.md$/, '')
    .replace(/\/index$/, '');
}

function splitGenerated(raw) {
  let body = raw.replace(/\r\n/g, '\n').trimStart();
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) body = body.slice(end + 4).trimStart();
  }
  body = body.replace(/^#\s+.+\n+/, '');
  body = body.replace(/^>\s*.+\n+/, '');
  body = body.replace(/^#\s+.+\n+/, '');
  return body.trimStart();
}

function replaceBody(source, body) {
  if (!source.startsWith('---')) return body;
  const end = source.indexOf('\n---', 3);
  if (end === -1) return body;
  return source.slice(0, end + 4) + '\n' + body;
}

function rewriteAbsolute(body) {
  if (VERSION === current) {
    return body.replaceAll(`/docs/${VERSION}/`, '/docs/');
  }
  return body;
}

async function fetchPage(route) {
  const url = `${BASE}/docs/${VERSION}/${route}.md`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': 'mikrotik-manual-mirror/1.0'},
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

const queue = pages.slice();
let repaired = 0;
const failures = [];

async function worker() {
  while (queue.length) {
    const page = queue.shift();
    const file = resolveFile(page);
    if (!file) {
      failures.push({page, error: 'local file not found'});
      continue;
    }
    const route = routeFor(file);
    try {
      const raw = await fetchPage(route);
      const body = rewriteAbsolute(splitGenerated(raw));
      const source = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, replaceBody(source, body));
      repaired++;
      console.log(`repaired ${route}`);
    } catch (error) {
      failures.push({page, route, error: String(error)});
      console.error('FAIL', route, String(error));
    }
  }
}

await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
console.log(`pages=${pages.length} repaired=${repaired} failures=${failures.length}`);
if (failures.length) console.log(JSON.stringify(failures, null, 2));
