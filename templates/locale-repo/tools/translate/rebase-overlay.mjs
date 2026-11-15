#!/usr/bin/env node
/**
 * Point one version overlay at that version's own content.
 *
 * A translated overlay is written while its version is `current`, so it links
 * with unversioned `/docs/<route>` URLs and points its images into `docs/`.
 * When the release becomes an archive, the same overlay must link to
 * `/docs/<version>/<route>` and load images from `versioned_docs/version-<v>/`,
 * otherwise the archived Chinese page silently shows the *current* page's
 * picture and navigates the reader to another release.
 *
 * Only references that exist in the archive are rewritten; anything else is
 * left alone (a dead versioned link is worse than a current one).
 *
 *   node tools/translate/rebase-overlay.mjs --section=docs-7.25
 *   node tools/translate/rebase-overlay.mjs --section=docs-7.25 --write
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {versionForSection, versionPlan} from '../sync/lib/versions.mjs';
import {buildRouteIndex} from '../sync/lib/routes.mjs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline ? inline.split('=').slice(1).join('=') : fallback;
};

const name = arg('section', '');
const write = process.argv.includes('--write');
if (!name) {
  console.error('usage: node tools/translate/rebase-overlay.mjs --section=docs-<version> [--write]');
  process.exit(2);
}
const section = SECTIONS.find((entry) => entry.name === name);
if (!section) {
  console.error(`unknown section: ${name}`);
  process.exit(2);
}
const version = versionForSection(name);
const plan = versionPlan(version);
if (plan.isCurrent) {
  console.error(`${name} is the current version; nothing to rebase`);
  process.exit(0);
}

const {index} = buildRouteIndex();
const ownPrefix = `/docs/${version}`;
const sourceRoot = path.join(REPO, section.source);
const docsRoot = path.join(REPO, 'docs');

const exists = (route) => index.has(route) || index.has(`${route}/`);
const IMAGE_EXT = /\.(?:png|jpe?g|webp|gif|svg|avif|ico)$/i;
/** A thumbnail inside a table links to the image file itself. */
const isImageTarget = (url) => IMAGE_EXT.test(url.split('#')[0].split('?')[0]);

function rewriteLink(url) {
  if (!url.startsWith('/docs/')) return url;
  const hashAt = url.indexOf('#');
  const target = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  const clean = target.replace(/\/+$/, '');
  if (clean === ownPrefix || clean.startsWith(`${ownPrefix}/`)) return url;
  const versioned = /^\/docs\/\d+(?:\.\d+)*(\/.*)?$/.exec(clean);
  const route = versioned ? versioned[1] || '' : clean.slice('/docs'.length);
  const candidate = `${ownPrefix}${route}`;
  if (!exists(candidate)) return url;
  return `${candidate}${hash}`;
}

function rewriteImage(url, file, overlayRoot) {
  const hashAt = url.indexOf('#');
  const target = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  if (/^(?:data|mailto|tel):/i.test(target) || /^https?:\/\//i.test(target)) return url;
  // Content-addressed images live in `static/img/<hash>` and are shared by every
  // release; rebasing one into the version tree would fork the blob.
  if (target.startsWith('/img/')) return url;
  const absolute = target.startsWith('/')
    ? path.join(REPO, target)
    : path.resolve(path.dirname(file), target);
  let mirrored = null;
  if (absolute.startsWith(`${docsRoot}${path.sep}`)) {
    mirrored = path.join(sourceRoot, path.relative(docsRoot, absolute));
  } else {
    // `![](img/x.png)` (thumbnail links, table cells) is relative to the page:
    // resolve it against the mirrored page's own directory instead.
    const mirroredDir = path.join(sourceRoot, path.relative(overlayRoot, path.dirname(file)));
    const candidate = path.resolve(mirroredDir, target);
    if (candidate.startsWith(`${sourceRoot}${path.sep}`)) mirrored = candidate;
  }
  if (!mirrored || !fs.existsSync(mirrored)) return url;
  const rel = path.relative(path.dirname(file), mirrored).split(path.sep).join('/');
  return `${rel.startsWith('.') ? rel : `./${rel}`}${hash}`;
}

const stats = {files: 0, links: 0, images: 0, changed: 0};
const overlayRoot = path.join(REPO, section.overlay);
for (const file of walkMarkdown(overlayRoot)) {
  const original = fs.readFileSync(file, 'utf8');
  let next = original.replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (whole, open, url, close) => {
    const image = open.startsWith('![') || isImageTarget(url);
    const replaced = image ? rewriteImage(url, file, overlayRoot) : rewriteLink(url);
    if (replaced === url) return whole;
    if (image) stats.images++;
    else stats.links++;
    return `${open}${replaced}${close}`;
  });
  next = next.replace(/(\b(?:href|src)=")([^"]+)(")/g, (whole, open, url, close) => {
    const image = open.endsWith('src="') || isImageTarget(url);
    const replaced = image ? rewriteImage(url, file, overlayRoot) : rewriteLink(url);
    if (replaced === url) return whole;
    if (image) stats.images++;
    else stats.links++;
    return `${open}${replaced}${close}`;
  });
  stats.files++;
  if (next === original) continue;
  stats.changed++;
  if (write) fs.writeFileSync(file, next);
}

console.log(
  `${name}: files=${stats.files} changed=${stats.changed} links=${stats.links} images=${stats.images} ` +
    `apply=${write} target=${relative(REPO, overlayRoot)}`,
);
