#!/usr/bin/env node
/**
 * Fold the captured page metadata into the upstream manifest.
 *
 * The official `.md` export carries no front matter: title, description, tags
 * and CLI cross-links exist only on the rendered page. `extract-doc-metadata`
 * records them; this step writes them into `upstream/<version>/manifest.json`,
 * because `materialize` renders every page from that manifest. Files are never
 * edited here — `materialize --write` is the only writer of `docs/`.
 *
 *   node tools/sync/apply-doc-metadata.mjs --version 7.26
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, currentVersion, versionPlan} from './lib/versions.mjs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const VERSION = arg('version', currentVersion());
const plan = versionPlan(VERSION);
const META = arg('meta', `data/manifests/docs-${VERSION}-metadata.json`);
const CLI_LINKS = arg('cli-links', `data/manifests/cli-links-${VERSION}.json`);
const MANIFEST = arg('manifest', plan.manifest);
const VERSION_KEY = plan.isCurrent ? 'current' : VERSION;

if (!fs.existsSync(META)) throw new Error(`missing ${META}`);
if (!fs.existsSync(MANIFEST)) throw new Error(`missing ${MANIFEST}; run upstream:fetch first`);
const metadata = JSON.parse(fs.readFileSync(META, 'utf8')).docs || {};
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

function localHref(href) {
  const own = plan.isCurrent ? null : `/docs/${plan.version}/`;
  if (own && href.startsWith(own)) return href;
  if (own && href.startsWith('/docs/')) return `/docs/${plan.version}/${href.slice('/docs/'.length)}`;
  return href;
}

const cliLinks = {};
let described = 0;
let tagged = 0;

for (const page of manifest.pages || []) {
  if (page.origin !== 'official') continue;
  const id = page.local_path.replace(/\.mdx?$/i, '');
  const entry = metadata[id];
  if (!entry) continue;
  page.frontmatter = page.frontmatter || {};
  page.frontmatter.official = page.frontmatter.official || {};
  page.frontmatter.mirror = page.frontmatter.mirror || {};

  if (entry.description && !page.frontmatter.official.description) {
    page.frontmatter.official.description = entry.description;
    described++;
  }
  if (entry.tags?.length && !page.frontmatter.mirror.tags) {
    page.frontmatter.mirror.tags = entry.tags;
    tagged++;
  }
  if (entry.cliLinks?.length) cliLinks[id] = entry.cliLinks.map((link) => ({...link, href: localHref(link.href)}));
}

fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(CLI_LINKS, `${JSON.stringify(cliLinks, null, 2)}\n`);
console.log(
  `[${VERSION}] manifest metadata: descriptions=${described} tags=${tagged} ` +
    `cli-links=${Object.keys(cliLinks).length} (${path.relative(REPO, MANIFEST)})`,
);
