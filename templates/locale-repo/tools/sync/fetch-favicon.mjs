#!/usr/bin/env node
/**
 * `fetch-favicon` — mirror the official MikroTik favicon into the static tree.
 *
 * `docusaurus.config.ts` deliberately does *not* declare `favicon:` (that would
 * make the default icon tag locale-prefixed and 404 on zh/slim builds). The
 * icon is injected by `headTags[0]` as
 * `${sharedAssetBaseUrl}img/favicon.svg`, so the bytes at
 * `static/img/favicon.svg` are the whole contract. Until now those bytes were a
 * hand-written 246 B placeholder that no sync stage ever refreshed.
 *
 * This stage derives the source from `config/mirror.yml#source.base_url` (never
 * a hard-coded official URL): it fetches the homepage, reads the
 * `<link rel="icon" href="…">` the official site actually publishes, fetches
 * that URL and writes the bytes plus a provenance manifest.
 *
 *   node tools/sync/fetch-favicon.mjs           # fetch + write (default)
 *   node tools/sync/fetch-favicon.mjs --write   # same, explicit
 *   node tools/sync/fetch-favicon.mjs --check   # read-only local/manifest check
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG = YAML.parse(fs.readFileSync(path.join(REPO, 'config/mirror.yml'), 'utf8'));
const SOURCE_URL = String(CONFIG?.source?.base_url || '').replace(/\/+$/, '');
const HOME_URL = `${SOURCE_URL}/`;
const FAVICON = path.join(REPO, 'static/img/favicon.svg');
const MANIFEST = path.join(REPO, 'data/manifests/favicon.json');
const CHECK = process.argv.includes('--check');
const TIMEOUT_MS = 30000;
const USER_AGENT = String(CONFIG?.sync?.user_agent || 'mikrotik-manual-mirror/1.0');

const rel = (file) => path.relative(REPO, file).split(path.sep).join('/');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** True only for an SVG payload; content-type alone is not authority. */
function isSvg(bytes) {
  const head = bytes.subarray(0, 512).toString('utf8').trimStart();
  return /^(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg\b/i.test(head);
}

/**
 * The official HTML uses boolean/unquoted attributes (`<link data-rh=true
 * rel=icon href=/img/favicon.svg />`), so parse the tag as text rather than
 * assume a specific attribute order or quoting style.
 */
function iconHrefFromHtml(html, base) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const candidates = [];
  for (const tag of tags) {
    const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const value = relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3] ?? '';
    if (!/(?:^|\s)icon(?:\s|$)/i.test(value)) continue;
    const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    if (href) candidates.push(new URL(href, base).href);
  }
  if (!candidates.length) throw new Error(`no <link rel="icon"> found in ${base}`);
  // Prefer the SVG icon when the site publishes more than one flavour.
  const svg = candidates.find((url) => /\.svg(?:$|[?#])/i.test(new URL(url).pathname));
  const url = svg || candidates[0];
  if (!/\.svg$/i.test(new URL(url).pathname)) {
    throw new Error(`official favicon is not an SVG: ${url}`);
  }
  return url;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {'user-agent': USER_AGENT},
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchSvg(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {'user-agent': USER_AGENT},
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const type = response.headers.get('content-type') || '';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`empty favicon from ${url}`);
  if (type && !/image\/svg\+xml|image\/svg\b/i.test(type)) {
    throw new Error(`favicon content-type is ${type}, expected image/svg+xml`);
  }
  if (!isSvg(bytes)) throw new Error(`favicon bytes from ${url} are not an SVG payload`);
  return bytes;
}

function validateManifest(manifest) {
  const problems = [];
  if (manifest.schema !== 1) problems.push(`schema ${manifest.schema} != 1`);
  if (!manifest.generated_at || Number.isNaN(new Date(manifest.generated_at).getTime())) {
    problems.push('no usable generated_at');
  }
  if (manifest.source_url !== SOURCE_URL) {
    problems.push(`source_url ${manifest.source_url} != configured ${SOURCE_URL}`);
  }
  if (typeof manifest.url !== 'string' || !/^https?:\/\//i.test(manifest.url)) {
    problems.push(`bad url ${String(manifest.url)}`);
  } else if (!manifest.url.startsWith(`${SOURCE_URL}/`)) {
    problems.push(`url ${manifest.url} is not under ${SOURCE_URL}`);
  }
  if (typeof manifest.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(manifest.sha256)) {
    problems.push(`bad sha256 ${String(manifest.sha256)}`);
  }
  if (!Number.isInteger(manifest.bytes) || manifest.bytes <= 0) {
    problems.push(`bad bytes ${String(manifest.bytes)}`);
  }
  return problems;
}

function check() {
  const problems = [];
  const manifest = readJson(MANIFEST);
  if (!manifest) {
    problems.push(`missing ${rel(MANIFEST)}; run \`node tools/sync/fetch-favicon.mjs\``);
  } else {
    problems.push(...validateManifest(manifest).map((p) => `${rel(MANIFEST)}: ${p}`));
  }
  let local = null;
  if (!fs.existsSync(FAVICON)) {
    problems.push(`missing ${rel(FAVICON)}; run \`node tools/sync/fetch-favicon.mjs\``);
  } else {
    local = fs.readFileSync(FAVICON);
    if (!isSvg(local)) problems.push(`${rel(FAVICON)}: bytes are not an SVG payload`);
  }
  if (manifest && local) {
    const actual = sha256(local);
    if (actual !== manifest.sha256) {
      problems.push(`${rel(FAVICON)} sha256 ${actual} != manifest ${manifest.sha256}`);
    }
    if (local.length !== manifest.bytes) {
      problems.push(`${rel(FAVICON)} ${local.length} B != manifest ${manifest.bytes} B`);
    }
    console.log(`fetch-favicon --check: ${rel(FAVICON)} ${local.length} B sha256=${actual}`);
    console.log(`fetch-favicon --check: ${rel(MANIFEST)} ${manifest.bytes} B sha256=${manifest.sha256}`);
  }
  if (problems.length) {
    for (const problem of problems) console.error(`fetch-favicon --check: FAIL ${problem}`);
    console.error(`fetch-favicon --check: ${problems.length} problem(s)`);
    process.exitCode = 1;
    return;
  }
  console.log('fetch-favicon --check: PASS');
}

async function write() {
  if (!/^https?:\/\//i.test(SOURCE_URL)) {
    throw new Error(`config/mirror.yml source.base_url is not an http(s) URL: ${SOURCE_URL}`);
  }
  const url = iconHrefFromHtml(await fetchText(HOME_URL), HOME_URL);
  const bytes = await fetchSvg(url);
  const digest = sha256(bytes);
  const manifest = {
    schema: 1,
    generated_at: new Date().toISOString(),
    source_url: SOURCE_URL,
    url,
    sha256: digest,
    bytes: bytes.length,
  };
  fs.mkdirSync(path.dirname(FAVICON), {recursive: true});
  fs.writeFileSync(FAVICON, bytes);
  fs.mkdirSync(path.dirname(MANIFEST), {recursive: true});
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`fetch-favicon: ${rel(FAVICON)} ${bytes.length} B sha256=${digest}`);
  console.log(`fetch-favicon: ${rel(MANIFEST)} url=${url}`);
}

if (CHECK) {
  check();
} else {
  await write().catch((error) => {
    console.error(`fetch-favicon: FAIL ${error.message}`);
    process.exitCode = 1;
  });
}
