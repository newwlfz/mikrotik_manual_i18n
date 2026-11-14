#!/usr/bin/env node
/**
 * Refresh one mirrored documentation version from the official site.
 *
 * Fetches `<route>.md` for every route in the version manifest, parses the
 * generated header (title, summary, body), and compares the body with the local
 * file. Front matter is preserved: only title/description/source are refreshed.
 *
 *   node tools/sync/refresh-docs.mjs --version=7.24            # report only
 *   node tools/sync/refresh-docs.mjs --version=7.24 --apply    # write changes
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';
import {rewriteDocsLinks} from './lib/rewrite-links.mjs';
import {parseOfficial} from './lib/official-md.mjs';
import {splitBlocks, normalize} from '../translate/lib/blocks.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const BASE = 'https://manual.mikrotik.com';
const VERSION = arg('version', '7.24');
const APPLY = process.argv.includes('--apply');
const LIMIT = Number(arg('limit', '0'));
const CONCURRENCY = Number(arg('concurrency', '6'));

const LOCAL = VERSION === '7.24' ? 'versioned_docs/version-7.24' : 'docs';
const MANIFEST = `data/manifests/docs-${VERSION}-routes-from-source.json`;
const routes = JSON.parse(fs.readFileSync(path.join(REPO, MANIFEST), 'utf8'));

function localPath(route) {
  const clean = route.replace(/\/+$/, '');
  // Directory pages are stored as <route>/index.md by the import; keep that
  // layout when the file already exists, and fall back to <route>.md otherwise.
  const asIndex = path.join(REPO, LOCAL, `${clean}/index.md`);
  if (fs.existsSync(asIndex)) return asIndex;
  return path.join(REPO, LOCAL, `${clean}.md`);
}

function splitLocal(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {frontMatter: '', body: text};
  return {frontMatter: match[0], body: text.slice(match[0].length).trimStart()};
}

function setField(frontMatter, key, value) {
  const line = `${key}: ${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (pattern.test(frontMatter)) return frontMatter.replace(pattern, line);
  return frontMatter.replace(/^---\n/, `---\n${line}\n`);
}

/**
 * Official pages link to their neighbours relatively (`./radius.md`). The mirror
 * stores site-absolute links, one version per tree, so resolve them here.
 */
function resolveLinks(body, route, version) {
  const page = route.replace(/\/+$/, '');
  return body.replace(/\]\(([^)\s]+)\)/g, (whole, target) => {
    // Same-site absolute documentation links become site-absolute paths.
    if (target.startsWith('https://manual.mikrotik.com/docs/')) {
      const hash = target.includes('#') ? `#${target.split('#')[1]}` : '';
      let rest = target.slice('https://manual.mikrotik.com'.length).split('#')[0].split('?')[0];
      const isIndex = /\/index\.md$/i.test(rest);
      rest = rest.replace(/\.md$/i, '').replace(/\/index$/, '');
      if (isIndex && !rest.endsWith('/')) rest += '/';
      return `](${rest}${hash})`;
    }
    if (/^(https?:|mailto:|tel:|#|\/)/.test(target)) return whole;
    const [pathPart, hash] = target.split('#');
    if (!/\.md$/i.test(pathPart)) return whole;
    const isIndex = /(^|\/)index\.md$/i.test(pathPart);
    const base = path.posix.dirname(page || '.');
    let resolved = path.posix.normalize(path.posix.join(base, pathPart));
    resolved = resolved.replace(/\.md$/i, '');
    if (resolved === 'index') resolved = '';
    else if (resolved.endsWith('/index')) resolved = resolved.slice(0, -'index'.length);
    let absolute = `/docs/${version}/${resolved}`.replace(/\/+$/, '');
    // A directory page keeps its trailing slash, like the rest of the mirror.
    if (isIndex && absolute !== `/docs/${version}`) absolute += '/';
    return `](${absolute}${hash ? `#${hash}` : ''})`;
  });
}

// Compare content, not link spelling: the mirror and the official site disagree
// on absolute vs site-absolute links, and that difference is not an edit.
/**
 * Keep the local spelling of every block whose text did not change, and take the
 * official text for blocks that are new or edited. Local files are a transformed
 * form of the official page (front matter, heading rules), so overwriting the
 * whole body would churn every page; that is only a formatting difference.
 */
function mergeBody(officialBody, localBody) {
  const official = splitBlocks(officialBody);
  const local = splitBlocks(localBody);
  const pool = new Map();
  for (const block of local) {
    const key = normalize(block);
    if (!pool.has(key)) pool.set(key, []);
    pool.get(key).push(block);
  }
  // CLI pages in the mirror start with a horizontal rule, the official page
  // does not; it is page chrome, not content.
  const leadingRule = local.length && /^-{3,}$/.test(local[0].trim()) && !/^-{3,}$/.test(official[0].trim())
    ? [local[0]]
    : [];
  const merged = official.map((block) => {
    const key = normalize(block);
    const bucket = pool.get(key);
    if (bucket && bucket.length) return bucket.shift();
    return block;
  });
  return [...leadingRule, ...merged].join('\n\n');
}

function normalise(text) {
  return text
    .replace(/\]\([^)\s]*\)/g, '](LINK)')
    .replace(/\s+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Keep the local image file names; only the prose is being refreshed. */
function keepLocalImages(nextBody, localBody) {
  const localImages = [...localBody.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  const nextImages = [...nextBody.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  if (localImages.length !== nextImages.length) return nextBody;
  let index = 0;
  return nextBody.replace(/(!\[[^\]]*\]\()([^)\s]+)(\))/g, (whole, open, _url, close) => {
    const replacement = localImages[index++];
    return `${open}${replacement}${close}`;
  });
}

async function fetchRetry(url, attempts = 3) {
  let last;
  for (let index = 0; index < attempts; index++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': 'mikrotik-manual-mirror/1.0'},
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (index + 1)));
    }
  }
  throw last;
}

const report = {version: VERSION, total: routes.length, unchanged: 0, changed: [], added: [], removed: [], failed: []};
let cursor = 0;

async function worker() {
  for (;;) {
    const index = cursor++;
    if (index >= routes.length || (LIMIT && index >= LIMIT)) return;
    const route = routes[index];
    const url = `${BASE}/docs/${VERSION}/${route.replace(/\/+$/, '')}.md`;
    const file = localPath(route);
    try {
      const raw = await fetchRetry(url);
      const parsed = parseOfficial(raw);
      let body = parsed.body;
      // Versioned snapshots keep every internal link inside their own version.
      if (VERSION !== '7.25') body = rewriteDocsLinks(body, '/docs/', `/docs/${VERSION}/`);
      body = resolveLinks(body, route, VERSION);
      const local = splitLocal(file);
      if (local) body = mergeBody(body, local.body);
      if (!local) {
        report.added.push({route, title: parsed.title});
        if (APPLY) {
          fs.mkdirSync(path.dirname(file), {recursive: true});
          const fm = `---\ntitle: ${JSON.stringify(parsed.title || 'Untitled')}\nsidebar_label: ${JSON.stringify(parsed.title || 'Untitled')}\n---\n\n`;
          fs.writeFileSync(file, `${fm}${body.trim()}\n`);
        }
        continue;
      }
      if (normalise(local.body) === normalise(body)) {
        report.unchanged++;
        continue;
      }
      const localLines = normalise(local.body).split('\n');
      const nextLines = normalise(body).split('\n');
      let first = 0;
      while (first < localLines.length && first < nextLines.length && localLines[first] === nextLines[first]) first++;
      report.changed.push({
        route,
        added: Math.max(0, nextLines.length - localLines.length),
        removed: Math.max(0, localLines.length - nextLines.length),
        sample: (nextLines[first] || '').slice(0, 100),
      });
      if (APPLY) {
        let fm = local.frontMatter;
        if (parsed.title) fm = setField(fm, 'title', parsed.title);
        if (parsed.summary) fm = setField(fm, 'description', parsed.summary);
        fs.writeFileSync(file, `${fm}${keepLocalImages(body, local.body).trim()}\n`);
      }
    } catch (error) {
      report.failed.push({route, url, error: error.message});
    }
  }
}

await Promise.all(Array.from({length: CONCURRENCY}, worker));

// Routes that disappeared from the manifest but still exist locally.
const known = new Set(routes.map(localPath));
for (const file of walk(path.join(REPO, LOCAL))) {
  if (!known.has(file)) report.removed.push(path.relative(REPO, file));
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

fs.mkdirSync(path.join(REPO, 'data/manifests'), {recursive: true});
fs.writeFileSync(
  path.join(REPO, `data/manifests/refresh-${VERSION}.json`),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      version: VERSION,
      apply: APPLY,
      total: report.total,
      unchanged: report.unchanged,
      changed: report.changed.length,
      added: report.added.length,
      removed: report.removed.length,
      failed: report.failed.length,
    },
    null,
    1,
  ),
);
for (const entry of report.changed.slice(0, 10)) {
  console.log(`changed ${entry.route} (+${entry.added}/-${entry.removed}) ${entry.sample}`);
}
