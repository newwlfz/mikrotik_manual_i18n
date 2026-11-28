#!/usr/bin/env node
/**
 * `npm run verify:anchor-fidelity` — hub-only table-cell anchor gate.
 *
 * A table cell restored from the official rendered HTML carries links with a
 * relative `.md#anchor` target. `tools/sync/lib/table-structure.mjs` used to
 * resolve those with `new URL(href, base).pathname`, which threw the fragment
 * away: the cell still pointed at the right page but at its top, not at the
 * heading. This check compares the fragment of every link in the upstream
 * table-cell cache (`upstream/<v>/structure/pages/*.md.json`) with the
 * same-text link in the materialised page (`docs/` or
 * `versioned_docs/version-<v>/`):
 *
 *   - upstream carries a fragment, the mirror link has none -> `lostAnchor`
 *     (a real regression; the command exits 1);
 *   - upstream carries a fragment and the mirror kept one -> `withAnchor`
 *     (the spelling may legitimately change, e.g. `#802-3ad` -> `#8023ad`);
 *   - the upstream link had no fragment -> `upstreamMissing`, mirroring the
 *     cry-wolf guard in `verify:anchors.mjs`: a fragment that was never in the
 *     upstream cell is not evidence that the mirror dropped one.
 *
 * Only the hub owns the upstream structure cache, so this verifier is
 * hub-only. It is deliberately read-only and does not change any threshold in
 * `verify:anchors` / `verify:links` / `verify:tables:check`.
 */

import fs from 'node:fs';
import path from 'node:path';

import {REPO, versionPlans} from '../sync/lib/versions.mjs';

/** Per-kind sample count; a full list is one env var away. */
const SAMPLE_LIMIT = Number(process.env.VERIFY_ANCHOR_FIDELITY_SAMPLES || 5);

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#124': '|',
  '#123': '{',
  '#125': '}',
};

function decodeEntity(code) {
  if (ENTITIES[code]) return ENTITIES[code];
  if (/^#x[0-9a-f]+$/i.test(code)) return String.fromCodePoint(parseInt(code.slice(2), 16));
  if (/^#\d+$/.test(code)) return String.fromCodePoint(Number(code.slice(1)));
  return code;
}

/** Visible link text, with inline markup and MDX entities folded away. */
function textOf(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code) => decodeEntity(code))
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Both Markdown and inline-HTML links, as `{text, href}` pairs. */
function linksOf(chunk) {
  const out = [];
  const text = String(chunk ?? '');
  for (const match of text.matchAll(/<a\b[^>]*?href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    out.push({text: textOf(match[2]), href: match[1]});
  }
  for (const match of text.matchAll(/\[([^\]\n]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) {
    out.push({text: textOf(match[1]), href: match[2]});
  }
  return out;
}

function fragmentOf(href) {
  const value = String(href ?? '');
  const index = value.indexOf('#');
  if (index === -1) return '';
  try {
    return decodeURIComponent(value.slice(index + 1));
  } catch {
    return value.slice(index + 1);
  }
}

function indexByText(links) {
  const map = new Map();
  for (const link of links) {
    if (!link.text) continue;
    const key = link.text.toLocaleLowerCase();
    const list = map.get(key) || [];
    list.push(link);
    map.set(key, list);
  }
  return map;
}

/** Table rows only: non-table prose is not in scope for this gate. */
function tableLinksOf(file) {
  const links = [];
  if (!fs.existsSync(file)) return links;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    links.push(...linksOf(line));
  }
  return links;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md.json')) out.push(full);
  }
  return out;
}

const failures = [];
const totals = {files: 0, cells: 0, withAnchor: 0, lostAnchor: 0, upstreamMissing: 0};

for (const plan of versionPlans()) {
  const structureDir = path.join(REPO, plan.upstreamDir, 'structure', 'pages');
  const caches = walk(structureDir).sort();
  const counts = {
    files: 0,
    cells: 0,
    withAnchor: 0,
    lostAnchor: 0,
    upstreamMissing: 0,
  };
  const samples = [];
  const note = (where, text, fragment) => {
    if (samples.length < SAMPLE_LIMIT) samples.push(`${where} -> "${text}" #${fragment}`);
  };

  for (const cacheFile of caches) {
    const rel = path.relative(structureDir, cacheFile).replace(/\.md\.json$/, '.md');
    const finalFile = path.join(REPO, plan.docsDir, rel);
    if (!fs.existsSync(finalFile)) continue;
    counts.files++;
    const finalIndex = indexByText(tableLinksOf(finalFile));

    let cache;
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch {
      continue;
    }
    const where = `${plan.version}/${rel}`;
    for (const table of cache.tables || []) {
      for (const cell of table.cells || []) {
        const upstreamLinks = linksOf(cell.html);
        if (!upstreamLinks.length) continue;
        counts.cells++;
        for (const upstream of upstreamLinks) {
          const fragment = fragmentOf(upstream.href);
          const peers = finalIndex.get(upstream.text.toLocaleLowerCase()) || [];
          if (!fragment) {
            // The upstream cell never had an anchor: not a fidelity regression.
            if (peers.some((peer) => fragmentOf(peer.href))) counts.upstreamMissing++;
            continue;
          }
          if (!peers.length) continue;
          if (peers.some((peer) => fragmentOf(peer.href))) {
            counts.withAnchor++;
          } else {
            counts.lostAnchor++;
            note(`${where}:${table.index}:${cell.row}:${cell.col}`, upstream.text, fragment);
          }
        }
      }
    }
  }

  for (const [key, value] of Object.entries(counts)) totals[key] += value;
  for (const sample of samples) console.log(`  lost-anchor: ${sample}`);
  console.log(`  ${counts.lostAnchor ? 'FAIL' : 'ok  '} ${plan.version}: ${JSON.stringify(counts)}`);
  if (counts.lostAnchor) {
    failures.push(`${plan.version}: ${counts.lostAnchor} table-cell anchor(s) lost`);
  }
}

console.log(`TOTAL ${JSON.stringify(totals)}`);
if (failures.length) {
  for (const line of failures) console.log(`FAIL ${line}`);
  process.exitCode = 1;
}
