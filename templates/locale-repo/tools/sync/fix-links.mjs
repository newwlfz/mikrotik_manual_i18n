#!/usr/bin/env node
/**
 * Rewrite links to the mirror.
 *
 * Rules:
 *  - no internal link may point at https://manual.mikrotik.com;
 *  - a link is resolved against the local route index, so stale official paths
 *    (a page that moved) are repaired at the same time;
 *  - if the exact route is gone, a unique basename match in the same section is
 *    used; anything still unresolved is reported, never guessed.
 *
 *   node tools/sync/fix-links.mjs            # report only
 *   node tools/sync/fix-links.mjs --apply    # write
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';
import {buildRouteIndex} from './lib/routes.mjs';

const APPLY = process.argv.includes('--apply');
const OFFICIAL = 'https://manual.mikrotik.com';
const {index, byName, byFile} = buildRouteIndex();

const SECTION_OF_FILE = [
  {prefix: 'versioned_docs/version-7.24/', section: 'docs-7.24'},
  {prefix: 'docs/', section: 'docs'},
  {prefix: 'hardware/', section: 'hardware'},
  {prefix: 'blog/', section: 'blog'},
  {prefix: 'changelog/', section: 'changelog'},
  {prefix: 'i18n/zh-Hans/docusaurus-plugin-content-docs/version-7.24/', section: 'docs-7.24'},
  {prefix: 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/', section: 'docs'},
  {prefix: 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware/current/', section: 'hardware'},
  {prefix: 'i18n/zh-Hans/docusaurus-plugin-content-blog/current/', section: 'blog'},
  {prefix: 'i18n/zh-Hans/docusaurus-plugin-content-blog-changelog/current/', section: 'changelog'},
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

function sectionOfFile(file) {
  const rel = path.relative(REPO, file).replace(/\\/g, '/');
  for (const entry of SECTION_OF_FILE) if (rel.startsWith(entry.prefix)) return entry.section;
  return null;
}

const BASE = {
  docs: '/docs',
  'docs-7.24': '/docs/7.24',
  hardware: '/hardware',
  blog: '/blog',
  changelog: '/changelog',
};

function branchOf(route, base) {
  const rest = route.slice(base.length).replace(/^\/+/, '');
  return rest.split('/')[0] || '';
}

function bestMatch(section, rest, sourceFile) {
  const base = BASE[section];
  const clean = rest.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.md$/i, '').replace(/\/index$/, '');
  const exact = index.get(`${base}/${clean}`) || index.get(`${base}/${clean}/`);
  if (exact) return exact;

  const sourceParts = (() => {
    const rel = path.relative(REPO, sourceFile).replace(/\\/g, '/').split('/');
    if (rel[0] === 'docs') return rel.slice(1);
    if (rel[0] === 'versioned_docs') return rel.slice(2);
    return rel;
  })();
  const sourceBranch = sourceParts[0] || '';

  const requested = new Set(clean.split('/').filter(Boolean));
  const leaf = [...requested].at(-1) || '';
  const candidates = [];
  for (const candidate of byName.get(section) || []) {
    const route = candidate.route.replace(/\/+$/, '');
    if (!leaf || !(route.endsWith(`/${leaf}`) || route === `${base}/${leaf}`)) continue;
    const segments = new Set(route.slice(base.length).split('/').filter(Boolean));
    let score = 0;
    for (const segment of requested) if (segments.has(segment)) score++;
    if (branchOf(route, base) && branchOf(route, base) === sourceBranch) score += 3;
    for (const segment of sourceParts) {
      if (segment !== 'index' && segment !== sourceBranch && segments.has(segment)) score += 2;
    }
    candidates.push({entry: candidate, score});
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
  return candidates[0].entry;
}

function localHref(entry) {
  return entry.isIndex ? `${entry.route}/` : entry.route;
}

const ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|pdf|txt|rsc|ovpn|conf|json|js|css|html?|zip|gz|xlsx?|docx?|csv|pcap|bin|img|iso|npk|mp4|webm)$/i;

function sectionRootOfSource(file) {
  const rel = path.relative(REPO, file).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts[0] === 'docs') return parts.length > 2 ? parts[1] : '';
  if (parts[0] === 'versioned_docs') return parts.length > 3 ? parts[2] : '';
  return '';
}

function resolve(target, sourceSection, sourceFile) {
  let url = target;
  let anchor = '';
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    anchor = url.slice(hashIndex);
    url = url.slice(0, hashIndex);
  }
  if (!url) return null;
  if (url.startsWith(OFFICIAL)) url = url.slice(OFFICIAL.length);
  // Relative links are resolved against the page's own route.
  if (/^\.\.?\//.test(url)) {
    const source = byFile.get(sourceFile);
    if (source) {
      const dirname = source.isIndex
        ? source.route.replace(/\/+$/, '')
        : source.route.slice(0, source.route.lastIndexOf('/'));
      url = path.posix.normalize(`${dirname}/${url}`).replace(/\.md$/i, '').replace(/\/index$/, '');
      if (!url.startsWith('/')) url = `/${url}`;
    }
  }

  // A link to a file is served from static/, not from a page route.
  if (ASSET_EXT.test(url)) {
    if (url.startsWith('/assets/')) return {href: url, dead: !fs.existsSync(path.join(REPO, 'static', url))};
    return {skip: true};
  }

  let section = null;
  let rest = null;
  const bases = Object.entries(BASE).sort((a, b) => b[1].length - a[1].length);
  for (const [name, base] of bases) {
    if (url === base || url.startsWith(`${base}/`)) {
      section = name;
      rest = url.slice(base.length + 1);
      break;
    }
  }
  if (!section) {
    if (url.startsWith('/assets/')) return null;
    return null;
  }
  // A versionless /docs/ link inside the versioned tree means that version.
  if (section === 'docs' && sourceSection === 'docs-7.24' && !url.startsWith('/docs/7.24')) {
    section = 'docs-7.24';
    rest = url.slice(BASE['docs'].length + 1);
  }
  // `/docs/index#x` in a page means "the index of my own section".
  if ((rest === '' || rest === 'index') && (section === 'docs' || section === 'docs-7.24')) {
    const root = sectionRootOfSource(sourceFile);
    if (root) {
      const rootEntry = index.get(`${BASE[section]}/${root}/`) || index.get(`${BASE[section]}/${root}`);
      if (rootEntry) return {href: `${localHref(rootEntry)}${anchor}`, exact: true};
    }
    if (section === 'docs') {
      const intro = index.get('/docs/introduction');
      if (intro) return {href: `/docs/introduction${anchor}`, exact: true};
    }
  }
  if (section === 'blog' || section === 'changelog') {
    if (rest === '' || rest === 'index') return {href: `${BASE[section]}/${anchor}`, exact: true};
  }

  let entry = bestMatch(section, rest, sourceFile);
  // The official menu links often repeat the leaf: `ip/pool/pool`.
  if (!entry) {
    const parts = rest.replace(/\/+$/, '').split('/');
    if (parts.length > 1 && parts.at(-1) === parts.at(-2)) {
      entry = bestMatch(section, parts.slice(0, -1).join('/'), sourceFile);
    }
  }
  if (!entry) {
    // The page moved to another top-level branch; accept a unique leaf match.
    const leaf = rest.replace(/\/+$/, '').split('/').at(-1);
    const candidates = [];
    const version = section === 'docs-7.24' ? 'old' : section === 'docs' ? 'current' : 'shared';
    for (const [name, routes] of byName) {
      const other = name === 'docs-7.24' ? 'old' : name === 'docs' ? 'current' : 'shared';
      if (version !== 'shared' && other !== 'shared' && other !== version) continue;
      for (const candidate of routes) {
        const route = candidate.route.replace(/\/+$/, '');
        if (route.endsWith(`/${leaf}`)) candidates.push(candidate);
      }
    }
    if (candidates.length === 1) entry = candidates[0];
  }
  if (!entry) {
    // The page is gone locally and on the official site; keep the path but make
    // it local so no internal link leaves the mirror. Reported as dead.
    const fallback = `${BASE[section]}/${rest.replace(/^\/+/, '')}`.replace(/\/+$/, '');
    return {href: `${fallback}${anchor}`, dead: true};
  }
  return {href: `${localHref(entry)}${anchor}`, exact: true};
}

const stats = {files: 0, links: 0, rewritten: 0, unresolved: 0, dead: 0};
const unresolved = [];

for (const file of [
  ...walk(path.join(REPO, 'docs')),
  ...walk(path.join(REPO, 'versioned_docs')),
  ...walk(path.join(REPO, 'hardware')),
  ...walk(path.join(REPO, 'blog')),
  ...walk(path.join(REPO, 'changelog')),
  ...walk(path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-docs')),
  ...walk(path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware')),
  ...walk(path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-blog')),
  ...walk(path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-blog-changelog')),
]) {
  const section = sectionOfFile(file);
  if (!section) continue;
  const before = fs.readFileSync(file, 'utf8');
  let changed = false;
  // Images that still point at the official origin become local files.
  const imageFixed = before.replace(
    /(!\[[^\]]*\]\()(https:\/\/manual\.mikrotik\.com[^)\s]+)(\))/g,
    (whole, open, target, close) => {
      const url = target.slice(OFFICIAL.length);
      if (url.startsWith('/assets/')) return `${open}${url}${close}`;
      const match = url.match(/\/img\/([^/]+)$/);
      if (match) return `${open}./img/${match[1]}${close}`;
      return whole;
    },
  );
  const after = imageFixed.replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (whole, open, target, close) => {
    if (open.startsWith('![')) return whole;
    if (!/^(https?:\/\/manual\.mikrotik\.com|\/(docs|hardware|blog|changelog)(\/|$))/.test(target)) return whole;
    stats.links++;
    const resolved = resolve(target, section, file);
    if (resolved && resolved.skip) {
      stats.links--;
      return whole;
    }
    if (resolved && resolved.dead) stats.dead++;
    if (!resolved || resolved.miss) {
      stats.unresolved++;
      unresolved.push({file: path.relative(REPO, file), target});
      return whole;
    }
    changed = true;
    stats.rewritten++;
    return `${open}${resolved.href}${close}`;
  });
  if (after !== before) changed = true;
  if (changed) {
    stats.files++;
    if (APPLY) fs.writeFileSync(file, after);
  }
}

console.log(JSON.stringify({...stats, apply: APPLY}, null, 1));
for (const entry of unresolved.slice(0, 25)) console.log('UNRESOLVED', entry.file, entry.target);
fs.mkdirSync(path.join(REPO, 'reports'), {recursive: true});
fs.writeFileSync(
  path.join(REPO, 'reports/link-resolution.json'),
  `${JSON.stringify({stats, unresolved}, null, 1)}\n`,
);
