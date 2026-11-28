#!/usr/bin/env node
/**
 * Mirror the static files the documentation links to.
 *
 * Pages reference `/assets/<name>` for configuration exports, PDFs, CSS/JS and
 * similar downloads. The official site serves them from the same path; this
 * tool copies every referenced file into `static/assets/` so the mirror never
 * depends on the official origin at runtime.
 *
 *   node tools/sync/fetch-static-assets.mjs            # report
 *   node tools/sync/fetch-static-assets.mjs --apply    # download
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, DEFAULT_TARGET_LOCALE, sectionsFor} from '../translate/lib/paths.mjs';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://manual.mikrotik.com';

// overlay 根只由本仓 paths.mjs 的 DEFAULT_TARGET_LOCALE 推导：locale:add 会把
// 这个值替换成新语种，四仓就能共用同一份代码，不再为每个语种改这里的字面量。
const OVERLAY_DIRS = [...new Set(sectionsFor(DEFAULT_TARGET_LOCALE).map((section) => section.overlay))];
const DIRS = [
  'docs',
  'versioned_docs',
  'hardware',
  'blog',
  'changelog',
  ...OVERLAY_DIRS,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(md|mdx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const refs = new Set();
for (const dir of DIRS) {
  for (const file of walk(path.join(REPO, dir))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\/assets\/[A-Za-z0-9_./%+@~-]+/g)) refs.add(match[0]);
  }
}

const stats = {referenced: refs.size, present: 0, missing: 0, downloaded: 0, failed: 0};
const failures = [];

for (const ref of [...refs].sort()) {
  const target = path.join(REPO, 'static', ref.replace(/^\//, ''));
  if (fs.existsSync(target)) {
    stats.present++;
    continue;
  }
  stats.missing++;
  if (!APPLY) {
    console.log('MISSING', ref);
    continue;
  }
  try {
    const response = await fetch(`${BASE}${ref}`, {redirect: 'follow'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
    stats.downloaded++;
    console.log('DOWNLOADED', ref, bytes.length);
  } catch (error) {
    stats.failed++;
    failures.push({ref, error: error.message});
    console.log('FAILED', ref, error.message);
  }
}

console.log(JSON.stringify({...stats, apply: APPLY, failures}, null, 1));
