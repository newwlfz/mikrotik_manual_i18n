/**
 * Route index for every mirrored page.
 *
 * The official Markdown links to pages by route (`/docs/<path>`), by absolute
 * URL (`https://manual.mikrotik.com/docs/...`) and sometimes to a stale path.
 * Resolving a link means: turn it into a route, look the route up in this index,
 * and rewrite it to the route the mirror actually serves.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../../translate/lib/frontmatter.mjs';
import {versionPlans} from './versions.mjs';

const SECTIONS = [
  ...versionPlans().map((plan) => ({
    name: plan.sectionName,
    dir: plan.docsDir,
    // The current tree is served unversioned; an archive keeps its prefix.
    base: plan.isCurrent ? '/docs' : `/docs/${plan.version}`,
  })),
  {name: 'hardware', dir: 'hardware', base: '/hardware'},
  {name: 'blog', dir: 'blog', base: '/blog'},
  {name: 'changelog', dir: 'changelog', base: '/changelog'},
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

export function buildRouteIndex() {
  const index = new Map();
  const byName = new Map();
  const byFile = new Map();
  for (const section of SECTIONS) {
    const abs = path.join(REPO, section.dir);
    const routes = [];
    for (const file of walk(abs)) {
      const rel = path.relative(abs, file).replace(/\\/g, '/');
      const {frontMatter} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
      const slug = readField(frontMatter, 'slug');
      let id;
      if (slug) id = slug.replace(/^\/+/, '').replace(/\/+$/, '');
      else {
        id = rel.replace(/\.(md|mdx)$/, '');
        id = id.replace(/\/index$/, '');
      }
      if (id === 'index') id = '';
      const route = `${section.base}/${id}`.replace(/\/+$/, '') || section.base;
      const isIndex = rel.endsWith('/index.md') || rel === 'index.md' || Boolean(slug && slug.endsWith('/'));
      const entry = {section: section.name, file, rel, route, isIndex};
      routes.push(entry);
      index.set(route, entry);
      index.set(`${route}/`, entry);
      byFile.set(file, entry);
    }
    byName.set(section.name, routes);
  }
  return {index, byName, byFile, sections: SECTIONS};
}
