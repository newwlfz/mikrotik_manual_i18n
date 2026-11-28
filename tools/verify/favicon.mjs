#!/usr/bin/env node
/**
 * `npm run verify:favicon` — hub-only offline favicon provenance gate.
 *
 * `docusaurus.config.ts` serves the icon from `static/img/favicon.svg` through
 * `headTags`; there is no `favicon:` field to check. This verifier proves that
 * the committed bytes and `data/manifests/favicon.json` still agree (sha256 and
 * length), so a placeholder or a partially written file fails closed before
 * build. It never edits anything. If the manifest is absent the check is SKIP
 * (a cold repository has not run `fetch-favicon` yet).
 *
 *   node tools/verify/favicon.mjs            # offline, always safe in CI
 *   node tools/verify/favicon.mjs --online   # + compare live official bytes
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FAVICON = path.join(REPO, 'static/img/favicon.svg');
const MANIFEST = path.join(REPO, 'data/manifests/favicon.json');
const ONLINE = process.argv.includes('--online');
const rel = (file) => path.relative(REPO, file).split(path.sep).join('/');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function isSvg(bytes) {
  const head = bytes.subarray(0, 512).toString('utf8').trimStart();
  return /^(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg\b/i.test(head);
}

function iconHrefFromHtml(html, base) {
  const candidates = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const relValue = relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3] ?? '';
    if (!/(?:^|\s)icon(?:\s|$)/i.test(relValue)) continue;
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const value = href?.[1] ?? href?.[2] ?? href?.[3];
    if (value) candidates.push(new URL(value, base).href);
  }
  if (!candidates.length) throw new Error(`no <link rel="icon"> in ${base}`);
  return candidates.find((url) => /\.svg(?:$|[?#])/i.test(new URL(url).pathname)) || candidates[0];
}

let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch {
  console.log(`verify:favicon: SKIP ${rel(MANIFEST)} absent (fetch-favicon has not run)`);
  process.exit(0);
}

console.log('verify:favicon  static/img/favicon.svg <-> data/manifests/favicon.json');
check('manifest schema is 1', manifest.schema === 1, `got ${String(manifest.schema)}`);
check(
  'manifest has a usable generated_at',
  Boolean(manifest.generated_at) && !Number.isNaN(new Date(manifest.generated_at).getTime()),
  `got ${String(manifest.generated_at)}`,
);
check('manifest has an absolute url', /^https?:\/\//i.test(String(manifest.url || '')), `got ${String(manifest.url)}`);
check(
  'manifest sha256 is 64 hex chars',
  /^[0-9a-f]{64}$/i.test(String(manifest.sha256 || '')),
  `got ${String(manifest.sha256)}`,
);
check('manifest bytes is a positive integer', Number.isInteger(manifest.bytes) && manifest.bytes > 0, `got ${String(manifest.bytes)}`);

check(`${rel(FAVICON)} exists`, fs.existsSync(FAVICON));
if (!fs.existsSync(FAVICON)) {
  console.log(`verify:favicon: ${passed} assertion(s) passed`);
  for (const failure of failures) console.error(`verify:favicon: FAILED ${failure}`);
  console.error(`verify:favicon: FAIL (${failures.length} assertion(s) failed)`);
  process.exit(1);
}
const bytes = fs.readFileSync(FAVICON);
const digest = sha256(bytes);
console.log(`verify:favicon: local   ${bytes.length} B sha256=${digest}`);
console.log(`verify:favicon: manifest ${manifest.bytes} B sha256=${manifest.sha256}`);
check('local favicon is an SVG payload', isSvg(bytes));
check(`local sha256 ${digest} matches manifest`, digest === manifest.sha256);
check(`local bytes ${bytes.length} matches manifest ${manifest.bytes}`, bytes.length === manifest.bytes);

if (ONLINE) {
  const source = /^https?:\/\//i.test(String(manifest.source_url || ''))
    ? String(manifest.source_url).replace(/\/+$/, '')
    : null;
  check('manifest source_url is absolute', Boolean(source), `got ${String(manifest.source_url)}`);
  if (source) {
    try {
      const home = `${source}/`;
      const response = await fetch(home, {redirect: 'follow', signal: AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${home}`);
      const url = iconHrefFromHtml(await response.text(), home);
      check('manifest url matches the official <link rel=icon>', url === manifest.url, `official=${url} manifest=${manifest.url}`);
      const iconResponse = await fetch(url, {redirect: 'follow', signal: AbortSignal.timeout(30000)});
      if (!iconResponse.ok) throw new Error(`HTTP ${iconResponse.status} for ${url}`);
      const official = Buffer.from(await iconResponse.arrayBuffer());
      const officialDigest = sha256(official);
      console.log(`verify:favicon: official ${official.length} B sha256=${officialDigest}`);
      check('official bytes are an SVG payload', isSvg(official));
      check(`official sha256 ${officialDigest} matches manifest`, officialDigest === manifest.sha256);
      check(`official bytes ${official.length} matches manifest ${manifest.bytes}`, official.length === manifest.bytes);
    } catch (error) {
      check('online official comparison succeeded', false, error.message);
    }
  }
}

console.log(`verify:favicon: ${passed} assertion(s) passed`);
if (failures.length) {
  for (const failure of failures) console.error(`verify:favicon: FAILED ${failure}`);
  console.error(`verify:favicon: FAIL (${failures.length} assertion(s) failed)`);
  process.exit(1);
}
console.log('verify:favicon: PASS');
