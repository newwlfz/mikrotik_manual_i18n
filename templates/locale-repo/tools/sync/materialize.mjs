#!/usr/bin/env node
/**
 * Materialise `docs/` from upstream + corrections + structure cache.
 *
 * Default is a shadow run: writes to .work/materialize and never touches docs.
 *
 *   node tools/sync/materialize.mjs --all --shadow
 *   node tools/sync/materialize.mjs --all --check
 *   node tools/sync/materialize.mjs --version=7.25 --page=introduction --shadow
 *
 * `--write` exists for P1-C and is deliberately not used by P1-B.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {REPO} from '../translate/lib/paths.mjs';
import {
  docsDir,
  loadConfig,
  loadManifest,
  readJson,
  sha256,
  splitFrontMatter,
  upstreamDir,
  writeJson,
  writeText,
} from './lib/upstream.mjs';
import {allVersions, currentVersion, isCurrent, isCurrentOnlyPage, sectionNameFor} from './lib/versions.mjs';
import {parseOfficial} from './lib/official-md.mjs';
import {normaliseMdxAnchors} from './lib/mdx-normalise.mjs';
import {applyTableCache} from './lib/table-apply.mjs';
import {applyInlineColors as colorizeInlineCodes, loadInlineColors} from './lib/inline-colors.mjs';
import {buildManifestIndex, rewriteLinks} from './lib/link-resolver.mjs';
import {mdTables} from './lib/table-structure.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const ALL = process.argv.includes('--all');
const CHECK = process.argv.includes('--check');
const WRITE = process.argv.includes('--write');
const REQUESTED = arg('version', '');
const PAGE = arg('page', '');
const SKIP = new Set((arg('skip', '') || '').split(',').map((value) => value.trim()).filter(Boolean));
const OUT = path.resolve(REPO, arg('out', '.work/materialize'));
const JSON_REPORT = path.resolve(REPO, arg('json', 'reports/materialize-diff.json'));
const MD_REPORT = path.resolve(REPO, arg('md', 'reports/materialize-diff.md'));
const config = loadConfig();
const versions = REQUESTED ? [REQUESTED] : ALL ? allVersions() : [currentVersion()];

const double = (value) => JSON.stringify(String(value));
const single = (value) => `'${String(value).replace(/'/g, "''")}'`;

function renderFrontmatter(page, pagination) {
  const official = page.frontmatter?.official || {};
  const mirror = page.frontmatter?.mirror || {};
  const lines = ['---'];
  if (mirror.sidebar_key) lines.push(`sidebar_key: ${double(mirror.sidebar_key)}`);
  if (mirror.sidebar_position !== undefined) lines.push(`sidebar_position: ${Number(mirror.sidebar_position)}`);
  lines.push(`title: ${double(official.title || page.official_title || 'Untitled')}`);
  if (official.sidebar_label !== undefined) lines.push(`sidebar_label: ${single(official.sidebar_label)}`);
  if (official.description !== undefined) lines.push(`description: ${single(official.description)}`);
  if (Array.isArray(mirror.tags) && mirror.tags.length) {
    lines.push('tags:');
    for (const tag of mirror.tags) lines.push(`  - ${single(tag)}`);
  }
  if (official.slug !== undefined) lines.push(`slug: ${String(official.slug)}`);
  const source = mirror.source || (page.source_url ? page.source_url.replace(/\.md$/i, '') : null);
  if (source) lines.push(`source: ${source}`);
  if (mirror.captured_at) lines.push(`captured_at: ${single(mirror.captured_at)}`);
  // The official site decides the previous/next edges itself (a category link
  // page can have no Previous at all, and a doc can point past its neighbour).
  // These overrides reproduce that instead of trusting a reconstructed tree.
  if (pagination) {
    if (pagination.previous !== undefined) {
      lines.push(`pagination_prev: ${pagination.previous === null ? 'null' : double(pagination.previous)}`);
    }
    if (pagination.next !== undefined) {
      lines.push(`pagination_next: ${pagination.next === null ? 'null' : double(pagination.next)}`);
    }
  }
  lines.push('---', '', '');
  return `${lines.join('\n')}`;
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Escape pipes/braces in Markdown table rows without touching cell separators.
 *
 * A `<` only opens an HTML run when it spells a real tag (`<code>`, `</li>`,
 * `<br/>`). Escaped brackets (`\<keyfile>`) and placeholder text such as
 * `<mac address>` are literal content: treating them as tags used to raise the
 * HTML depth for the rest of the row, which escaped every remaining cell
 * separator and collapsed the row into one cell.
 */
const INLINE_TAG = /^<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s[^<>]*)?\/?>$/;
const VOID_TAG = /^<(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i;

/** A character is escaped only behind an odd number of backslashes. */
function isEscaped(line, index) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && line[i] === '\\'; i--) slashes++;
  return slashes % 2 === 1;
}

function escapeTableLine(line) {
  let out = '';
  let depth = 0;
  let code = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '`') {
      let run = 1;
      while (line[i + run] === '`') run++;
      if (code === 0) code = run;
      else if (code === run) code = 0;
      out += line.slice(i, i + run);
      i += run - 1;
      continue;
    }
    if (char === '<' && !isEscaped(line, i) && code === 0) {
      const end = line.indexOf('>', i);
      const tag = end === -1 ? '' : line.slice(i, end + 1);
      if (tag && (INLINE_TAG.test(tag) || /^<!--[\s\S]*-->$/.test(tag))) {
        if (/^<\//.test(tag)) depth = Math.max(0, depth - 1);
        else if (!/\/>$/.test(tag) && !VOID_TAG.test(tag)) depth++;
        out += tag;
        i = end;
        continue;
      }
    }
    const needsEscape = code === 0 && (char === '{' || char === '}') ||
      char === '|' && (code > 0 || depth > 0);
    out += needsEscape && !isEscaped(line, i) ? `\\${char}` : char;
  }
  return out;
}

/**
 * Keep a working image when the official Markdown name has no local file yet.
 *
 * The canonical reference (`./img/index-01.webp`) is preferred, but an older
 * local copy (`./img/image-341670d0.webp`) is better than a broken image until
 * `sync:assets` downloads the canonical one.
 */
function rescueImages(body, currentBody, dir) {
  if (!currentBody) return body;
  const pattern = /(!\[[^\]]*\]\()([^)\s]+)(\))|(<img[^>]*\ssrc=")([^"]+)(")/g;
  const refs = [];
  const currentRefs = [];
  for (const match of body.matchAll(pattern)) refs.push(match[2] || match[5]);
  for (const match of currentBody.matchAll(pattern)) currentRefs.push(match[2] || match[5]);
  if (!refs.length || refs.length !== currentRefs.length) return body;
  const exists = (target) => {
    const [pathPart] = target.split('#');
    if (!pathPart || /^(?:[a-z]+:)?\/\//i.test(pathPart)) return true;
    // A site-absolute image is served from `static/`, not from the page's own
    // directory: `/img/<hash>` means `static/img/<hash>` and it does exist.
    if (pathPart.startsWith('/')) return fs.existsSync(path.join(REPO, 'static', pathPart));
    return fs.existsSync(path.resolve(dir, pathPart));
  };
  let index = 0;
  let rescued = 0;
  return body.replace(pattern, (whole, mdOpen, mdTarget, mdClose, htmlOpen, htmlTarget, htmlClose) => {
    const target = mdTarget || htmlTarget;
    const replacement = mdTarget ? currentRefs[index] : currentRefs[index];
    index++;
    if (exists(target) || !exists(replacement)) return whole;
    const fragment = target.includes('#') ? target.slice(target.indexOf('#')) : '';
    const base = replacement.split('#')[0];
    rescued++;
    return mdTarget ? `${mdOpen}${base}${fragment}${mdClose}` : `${htmlOpen}${base}${fragment}${htmlClose}`;
  }) || body;
}

/**
 * A relative `<img src="./img/x.webp">` inside MDX is *not* rewritten by
 * Docusaurus (only Markdown images are), so it resolves against the page URL and
 * 404s. Turn those tags back into Markdown images, which the bundler does handle.
 */
function markdownImages(body) {
  return body.replace(/<img\b([^>]*?)\/?>/g, (whole, attrs) => {
    const src = /\ssrc="([^"]+)"/.exec(attrs)?.[1];
    if (!src || /^(?:[a-z]+:)?\/\//i.test(src) || src.startsWith('/') || src.startsWith('data:')) return whole;
    const alt = (/\salt="([^"]*)"/.exec(attrs)?.[1] || '').replace(/[[\]]/g, '');
    return `![${alt}](./${src.replace(/^\.\//, '')})`;
  });
}

function mdxCleanup(body) {
  let out = body
    .split('\n')
    .map((line) => (/^\s*\|/.test(line) ? escapeTableLine(stripComments(line)) : line))
    .join('\n');
  return out;
}

function imagesOf(body) {
  const pattern = /!\[[^\]]*\]\(([^)\s]+)\)|<img[^>]*\ssrc=["']([^"']+)["']/g;
  const out = [];
  let match;
  while ((match = pattern.exec(body)) !== null) out.push(match[1] || match[2]);
  return out;
}

/**
 * Keep the local image file names. The official Markdown names and the files
 * downloaded by the earlier asset pass do not always match; the page-level
 * order is stable, so align by position when the counts are equal.
 */
function alignImages(body, currentBody) {
  const local = imagesOf(currentBody);
  const next = imagesOf(body);
  if (!local.length || local.length !== next.length) return {body, aligned: false, local: local.length, next: next.length};
  let index = 0;
  const out = body.replace(/(!\[[^\]]*\]\()([^)\s]+)(\))|(<img[^>]*\ssrc=["'])([^"']+)(["'])/g, (whole, mdOpen, mdTarget, mdClose, htmlOpen, htmlTarget, htmlClose) => {
    if (mdOpen) return `${mdOpen}${local[index++]}${mdClose}`;
    return `${htmlOpen}${local[index++]}${htmlClose}`;
  });
  return {body: out, aligned: true, local: local.length, next: next.length};
}

function applyCorrections(version, page, body) {
  const file = path.join(REPO, 'corrections/pages/docs', version, page.local_path.replace(/\.md$/i, '.yml'));
  if (!fs.existsSync(file)) return {body, impact: false, applied: 0};
  const correction = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  if (correction.source_sha256 !== page.sha256) {
    throw new Error(`correction hash mismatch for ${page.local_path}; upstream changed`);
  }
  let next = body;
  let applied = 0;
  for (const operation of correction.operations || []) {
    if (operation.type !== 'replace') throw new Error(`unsupported correction type ${operation.type}`);
    if (!next.includes(operation.find)) throw new Error(`correction find text missing for ${page.local_path}`);
    next = next.replace(operation.find, operation.replace);
    applied++;
  }
  return {body: next, impact: Boolean(correction.translation_impact), applied};
}

function loadStructure(version, page) {
  const file = path.join(upstreamDir(version), 'structure/pages', `${page.local_path}.json`);
  return readJson(file);
}

function normalizeLinks(body) {
  return body
    .replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, '$1LINK$3')
    .replace(/(\b(?:href|src)=")([^"]+)(")/g, '$1LINK$3');
}

function firstDiff(current, shadow) {
  const a = current.split('\n');
  const b = shadow.split('\n');
  let index = 0;
  while (index < Math.min(a.length, b.length) && a[index] === b[index]) index++;
  return {
    line: index + 1,
    current: a[index] ?? '',
    shadow: b[index] ?? '',
    added: Math.max(0, b.length - a.length),
    removed: Math.max(0, a.length - b.length),
  };
}

/**
 * The official `.md` export drops HTML inside diagram labels, so a label like
 * `**Host 1**<br />____<br />**Address**` arrives on one line and reflows into
 * an overflowing box. `capture-mermaid.mjs` records the sources from the
 * rendered pages; put them back when the fence count matches.
 */
const mermaidCache = new Map();
function mermaidSources(version) {
  if (!mermaidCache.has(version)) {
    const file = path.join(REPO, `data/manifests/docs-${version}-mermaid.json`);
    mermaidCache.set(version, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).pages || {} : {});
  }
  return mermaidCache.get(version);
}

function repairMermaid(body, version, localPath) {
  const sources = mermaidSources(version)[localPath.replace(/\.md$/i, '')];
  if (!sources?.length) return {body, repaired: 0};
  const lines = body.split('\n');
  let index = 0;
  for (let line = 0; line < lines.length; line++) {
    const open = /^(\s*)```mermaid\s*$/.exec(lines[line]);
    if (!open) continue;
    let end = line + 1;
    while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end++;
    if (end >= lines.length) break;
    const source = sources[index++];
    if (source === undefined) break;
    const indent = open[1];
    const replacement = source.split('\n').map((text) => (text ? `${indent}${text}` : ''));
    lines.splice(line + 1, end - line - 1, ...replacement);
    line += replacement.length;
  }
  return {body: lines.join('\n'), repaired: Math.min(index, sources.length)};
}

function materialisePage(version, page, data, pagination) {
  const source = page.origin === 'official'
    ? path.join(upstreamDir(version), 'docs', page.local_path)
    : path.join(REPO, page.local_source);
  const raw = fs.readFileSync(source, 'utf8');
  let body = page.origin === 'official' ? parseOfficial(raw).body : splitFrontMatter(raw).body.replace(/^\n+/, '');
  const mermaidResult = repairMermaid(body, version, page.local_path);
  body = mermaidResult.body;
  body = normaliseMdxAnchors(body).body;
  const structure = loadStructure(version, page);
  const tableResult = structure ? applyTableCache(body, structure) : {body, applied: 0, skipped: []};
  body = tableResult.body;
  const correction = applyCorrections(version, page, body);
  body = correction.body;

  const linkStats = {links: 0, rewritten: 0, htmlLinks: 0, htmlImages: 0, dead: 0, unresolved: 0, deadTargets: []};
  body = rewriteLinks(body, sectionNameFor(version), page.local_path, data, linkStats);

  // CLI pages keep the horizontal rule that `refresh-docs` treats as page
  // chrome. It is not part of the generated body parser.
  const cliPage = page.origin === 'official' && page.local_path.startsWith('cli-reference/') && page.local_path !== 'cli-reference/index.md' && page.local_path !== 'cli-reference/compare-versions.md';
  if (cliPage && !body.startsWith('-----------')) {
    body = `-----------\n\n${body}`;
  }

  const currentFile = path.join(docsDir(version), page.local_path);
  const current = fs.existsSync(currentFile) ? fs.readFileSync(currentFile, 'utf8') : null;
  // Image references are resolved by name (with a content-hash fallback) in
  // `rewriteLinks`; the old positional alignment rewrote them from the current
  // file and silently dropped `#gh-light-mode-only` / `#gh-dark-mode-only`.
  const imageResult = {aligned: true, local: 0, next: 0};
  if (current) body = rescueImages(body, splitFrontMatter(current).body, path.dirname(currentFile));
  body = markdownImages(body);
  body = mdxCleanup(body);
  const colorResult = colorizeInlineCodes(
    body,
    loadInlineColors(version)[page.local_path.replace(/\.md$/i, '')],
  );
  body = colorResult.body;
  const document = `${renderFrontmatter(page, pagination)}${body.trimEnd()}\n`;
  return {document, tableResult, correction, linkStats, imageResult, mermaidResult, colorResult};
}

const report = {
  schema: 1,
  generated_at: new Date().toISOString(),
  mode: WRITE ? 'write' : CHECK ? 'check' : 'shadow',
  out: path.relative(REPO, OUT),
  versions: {},
  pages: [],
  totals: {pages: 0, same: 0, frontmatter: 0, 'frontmatter-source': 0, links: 0, table: 0, body: 0, missing: 0, errors: 0, translated_impact: 0},
};

for (const version of versions) {
  const manifest = loadManifest(version);
  if (!manifest) throw new Error(`missing manifest for ${version}`);
  const data = buildManifestIndex(manifest, version);
  const navFile = path.join(REPO, `data/manifests/docs-${version}-nav.json`);
  const nav = fs.existsSync(navFile) ? readJson(navFile) : null;
  const sidebarFile = path.join(REPO, `data/manifests/docs-${version}-sidebar.json`);
  const crawledSidebar = fs.existsSync(sidebarFile) ? readJson(sidebarFile) : null;
  const docId = (localPath) => localPath.replace(/\.mdx?$/, '').replace(/\/index$/, '') || 'index';
  // Document ids appear both with and without the trailing `/index` (a category
  // landing page is `foo/index` for Docusaurus but `foo` in the crawl).
  const stripIndex = (id) => id.replace(/\/index$/, '');
  const knownIds = new Set((manifest.pages || []).map((page) => docId(page.local_path)));
  const realId = new Map();
  for (const page of manifest.pages || []) {
    const real = page.local_path.replace(/\.mdx?$/, '');
    realId.set(stripIndex(real), real);
  }

  // Flatten the crawled sidebar the way Docusaurus does (a category link sits
  // before its children) so we only override edges that really differ.
  const flat = [];
  const flatten = (items) => {
    for (const item of items || []) {
      if (item.type === 'category') {
        if (item.link?.type === 'doc') flat.push(item.link.id);
        flatten(item.items);
      } else if (item.type === 'doc') {
        flat.push(item.id);
      }
    }
  };
  flatten(crawledSidebar?.docs);
  const expected = new Map();
  flat.forEach((id, index) => {
    expected.set(id, {previous: flat[index - 1] ?? null, next: flat[index + 1] ?? null});
  });

  const paginationFor = (localPath) => {
    const real = realId.get(docId(localPath));
    if (!real) return null;
    const crawled = nav?.pagination?.[stripIndex(real)];
    const ours = expected.get(real);
    if (!crawled || !ours) return null;
    const pick = (value) => {
      if (value === null) return null;
      const resolved = realId.get(stripIndex(value));
      return resolved && knownIds.has(resolved) ? resolved : undefined;
    };
    const previous = pick(crawled.previous);
    const next = pick(crawled.next);
    const result = {};
    if (previous !== undefined && previous !== ours.previous) result.previous = previous;
    if (next !== undefined && next !== ours.next) result.next = next;
    return result.previous === undefined && result.next === undefined ? null : result;
  };

  const isSkipped = (page) => SKIP.has(page.local_path) || SKIP.has(`${version}:${page.local_path}`);
  // A page the release does not publish: `current_only_pages` names the pages
  // that only exist in the current tree, so an archive must neither carry them
  // again nor keep a stale copy from an older snapshot. Deleting on `--write`
  // is what makes the archive match what `snapshot-version` produces.
  const isCurrentOnly = (page) => !isCurrent(version) && isCurrentOnlyPage(page.local_path);
  const currentOnly = [];
  if (!isCurrent(version)) {
    for (const page of manifest.pages || []) {
      if (!isCurrentOnly(page)) continue;
      currentOnly.push(page.local_path);
      const stale = path.join(docsDir(version), page.local_path);
      if (WRITE && fs.existsSync(stale)) {
        fs.rmSync(stale);
        console.log(`${version}: removed current-only page ${page.local_path} from the archive`);
      }
    }
  }
  const entries = (manifest.pages || []).filter(
    (page) => (!PAGE || page.local_path.includes(PAGE)) && !isSkipped(page) && !isCurrentOnly(page),
  );
  const skipped = (manifest.pages || []).filter((page) => isSkipped(page)).map((page) => page.local_path);
  const versionReport = {pages: 0, skipped, current_only: currentOnly, same: 0, frontmatter: 0, 'frontmatter-source': 0, links: 0, table: 0, body: 0, missing: 0, errors: 0, link_stats: {links: 0, rewritten: 0, htmlLinks: 0, dead: 0, unresolved: 0, dead_targets: []}, table_cells: 0, table_skipped: 0, image_mismatch: 0, translated_impact: 0};
  for (const page of entries) {
    report.totals.pages++;
    versionReport.pages++;
    try {
      const result = materialisePage(version, page, data, paginationFor(page.local_path));
      for (const [key, value] of Object.entries(result.linkStats)) {
        if (key === 'deadTargets') {
          versionReport.link_stats.dead_targets.push(...value);
        } else {
          versionReport.link_stats[key] += value;
        }
      }
      versionReport.table_cells += result.tableResult.applied;
      versionReport.table_skipped += result.tableResult.skipped.length;
      if (result.correction.impact) versionReport.translated_impact++;
      if (result.imageResult && !result.imageResult.aligned && result.imageResult.local !== result.imageResult.next) {
        versionReport.image_mismatch = (versionReport.image_mismatch || 0) + 1;
      }
      const shadowFile = path.join(OUT, version, page.local_path);
      if (WRITE) writeText(path.join(docsDir(version), page.local_path), result.document);
      writeText(shadowFile, result.document);

      const currentFile = path.join(docsDir(version), page.local_path);
      if (!fs.existsSync(currentFile)) {
        versionReport.missing++;
        report.totals.missing++;
        report.pages.push({version, local_path: page.local_path, category: 'missing'});
        continue;
      }
      const current = fs.readFileSync(currentFile, 'utf8');
      if (current === result.document) {
        versionReport.same++;
        report.totals.same++;
        continue;
      }
      const currentSplit = splitFrontMatter(current);
      const shadowSplit = splitFrontMatter(result.document);
      const currentBody = currentSplit.body.replace(/^\n+/, '');
      const shadowBody = shadowSplit.body.replace(/^\n+/, '');
      let category;
      if (currentBody === shadowBody) {
        const currentSource = currentSplit.data.source ?? null;
        const shadowSource = shadowSplit.data.source ?? null;
        category = currentSource !== shadowSource ? 'frontmatter-source' : 'frontmatter';
      } else if (normalizeLinks(currentBody) === normalizeLinks(shadowBody)) {
        category = 'links';
      } else {
        const currentTables = mdTables(currentSplit.body.split('\n')).length;
        const shadowTables = mdTables(shadowSplit.body.split('\n')).length;
        category = currentTables !== shadowTables || result.tableResult.applied ? 'table' : 'body';
      }
      versionReport[category]++;
      report.totals[category]++;
      report.pages.push({
        version,
        local_path: page.local_path,
        category,
        diff: firstDiff(current, result.document),
        link_stats: result.linkStats,
        table_cells: result.tableResult.applied,
        table_skipped: result.tableResult.skipped,
      });
    } catch (error) {
      versionReport.errors++;
      report.totals.errors++;
      report.pages.push({version, local_path: page.local_path, category: 'error', error: error.message});
    }
  }
  report.versions[version] = versionReport;
  console.log(`${version}: pages=${versionReport.pages} same=${versionReport.same} frontmatter=${versionReport.frontmatter} source=${versionReport['frontmatter-source']} links=${versionReport.links} table=${versionReport.table} body=${versionReport.body} errors=${versionReport.errors}`);
}

writeJson(JSON_REPORT, report);

const lines = [];
lines.push('# P1-B materialize diff', '');
lines.push(`Mode: \`${report.mode}\``, '');
lines.push('This is a shadow comparison against the current `docs/`. `docs/` and `i18n/` were not written.', '');
lines.push('## Summary', '');
lines.push('| Version | Pages | Skipped | Same | Frontmatter | Source added | Links | Table | Body | Errors |');
lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const [version, value] of Object.entries(report.versions)) {
  lines.push(`| ${version} | ${value.pages} | ${value.skipped.length} | ${value.same} | ${value.frontmatter} | ${value['frontmatter-source']} | ${value.links} | ${value.table} | ${value.body} | ${value.errors} |`);
}
const currentOnlyRows = Object.entries(report.versions).flatMap(([version, value]) =>
  (value.current_only || []).map((page) => `${version}/${page}`),
);
if (currentOnlyRows.length) {
  lines.push('', '## Current-only pages (dropped from archives)', '');
  for (const row of currentOnlyRows) lines.push(`- ${row}`);
}
if (SKIP.size) {
  lines.push('', '## Skipped pages', '');
  for (const [version, value] of Object.entries(report.versions)) {
    for (const page of value.skipped) lines.push(`- ${version}/${page}`);
  }
}
lines.push('', '## Link resolution', '');
lines.push('| Version | Markdown links seen | Rewritten | Inline HTML rewritten | Dead | Unresolved |');
lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const [version, value] of Object.entries(report.versions)) {
  const s = value.link_stats;
  lines.push(`| ${version} | ${s.links} | ${s.rewritten} | ${s.htmlLinks} | ${s.dead} | ${s.unresolved} |`);
}
lines.push('', '## Dead link targets', '');
const dead = [...new Set(Object.values(report.versions).flatMap((value) => value.link_stats.dead_targets || []))].sort();
if (!dead.length) lines.push('None.');
for (const target of dead) lines.push(`- \`${target}\``);
lines.push('', '## First differing pages', '');

for (const page of report.pages.filter((entry) => entry.category !== 'same').slice(0, 40)) {
  if (page.category === 'error') {
    lines.push(`- \`${page.version}/${page.local_path}\` — **error**: ${page.error}`);
    continue;
  }
  lines.push(`- \`${page.version}/${page.local_path}\` — **${page.category}**, first diff line ${page.diff?.line ?? '?'}`);
  if (page.diff?.current || page.diff?.shadow) {
    lines.push(`  - current: \`${(page.diff.current || '').slice(0, 180)}\``);
    lines.push(`  - shadow:  \`${(page.diff.shadow || '').slice(0, 180)}\``);
  }
}
writeText(MD_REPORT, `${lines.join('\n')}\n`);

if (CHECK && report.totals.errors) {
  console.error(`materialize check found ${report.totals.errors} error(s)`);
  process.exitCode = 1;
}
