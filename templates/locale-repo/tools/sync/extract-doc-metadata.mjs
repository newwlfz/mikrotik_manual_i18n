import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

import {currentVersion, versionPlan} from './lib/versions.mjs';

const BASE = 'https://manual.mikrotik.com';
const VERSION = arg('version', currentVersion());
const plan = versionPlan(VERSION);
const DOCS = arg('docs', plan.docsDir);
const OUT = arg('out', `data/manifests/docs-${VERSION}-metadata.json`);
const CACHE = arg('cache', `../.work/doc-metadata-cache-${VERSION}`);
const HTML_CACHE = arg('html-cache', `../.work/doc-html-${VERSION}`);
const CONCURRENCY = Number(arg('concurrency', '24'));
const RETRIES = 1;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file));
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) out.push(file);
  }
  return out;
}

function idFor(file) {
  return path.relative(DOCS, file).replace(/\.(md|mdx)$/, '');
}

function routeFor(id) {
  return id.replace(/\/index$/, '').replace(/^index$/, '');
}

function decode(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/<[^>]+>/g, '');
}

function metaDescription(html) {
  const patterns = [
    /<meta[^>]*name=["']?description["']?[^>]*content="([^"]*)"/i,
    /<meta[^>]*content="([^"]*)"[^>]*name=["']?description["']?/i,
    /<meta[^>]*property=["']?og:description["']?[^>]*content="([^"]*)"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decode(match[1]).replace(/\s+/g, ' ').trim();
  }
  return '';
}

function tags(html) {
  const found = [];
  const pattern = new RegExp(
    `href=["']?${plan.docsPrefix}/tags/([^"'\\s>#]+)["']?[^>]*>([\\s\\S]*?)<\\/a>`,
    'gi',
  );
  for (const match of html.matchAll(pattern)) {
    const tag = decode(match[2]).replace(/\s+/g, ' ').trim();
    if (tag && !found.includes(tag)) found.push(tag);
  }
  return found;
}

function cliLinks(html) {
  const block = html.match(/<p class=["']?cli-reference-links["']?[^>]*>([\s\S]*?)<\/p>/i);
  if (!block) return [];
  const links = [];
  const pattern = /<a href=["']?([^"'\s>]+)["']?[^>]*>\s*<code>([\s\S]*?)<\/code>\s*<\/a>/gi;
  for (const match of block[1].matchAll(pattern)) {
    links.push({href: match[1], command: decode(match[2]).trim()});
  }
  return links;
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': 'MikroTik manual mirror metadata pipeline'},
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

const files = walk(DOCS);
const docs = {};
let done = 0;
const queue = files.slice();

async function worker() {
  while (queue.length) {
    const file = queue.shift();
    const id = idFor(file);
    const route = routeFor(id);
    const url = `${BASE}${plan.docsPrefix}/${route}`;
    const cacheFile = path.join(CACHE, id.replaceAll('/', '__') + '.json');
    if (fs.existsSync(cacheFile)) {
      docs[id] = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      done++;
      continue;
    }
    try {
      const html = await fetchPage(url);
      fs.mkdirSync(HTML_CACHE, {recursive: true});
      fs.writeFileSync(path.join(HTML_CACHE, id.replaceAll('/', '__') + '.html'), html);
      docs[id] = {
        id,
        route,
        description: metaDescription(html),
        tags: tags(html),
        cliLinks: cliLinks(html),
      };
    } catch (error) {
      docs[id] = {id, route, description: '', tags: [], cliLinks: [], error: String(error)};
    }
    fs.mkdirSync(CACHE, {recursive: true});
    fs.writeFileSync(cacheFile, JSON.stringify(docs[id]));
    if (done % 50 === 0) {
      fs.writeFileSync(
        OUT,
        JSON.stringify(
          {version: VERSION, generatedAt: new Date().toISOString(), docs},
          null,
          2,
        ) + '\n',
      );
    }
    done++;
    if (done % 100 === 0) console.log(`[${VERSION}] fetched ${done}/${files.length}`);
  }
}

await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {version: VERSION, generatedAt: new Date().toISOString(), docs},
    null,
    2,
  ) + '\n',
);
const errors = Object.values(docs).filter((doc) => doc.error).length;
console.log(
  `[${VERSION}] wrote ${OUT} docs=${Object.keys(docs).length} errors=${errors} cache=${CACHE}`,
);
