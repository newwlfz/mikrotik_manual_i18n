/**
 * Single source of truth for "which RouterOS versions does the mirror know".
 *
 * Everything version-shaped is derived here from three committed files:
 *
 *   config/upstream.yml                     how the official site serves a section
 *   data/manifests/current-version.json     which version lives in docs/
 *   versions.json                           which snapshots live in versioned_docs/
 *
 * A plan answers the questions every tool used to hard-code:
 *
 *   {version, isCurrent, sectionName, docsDir, upstreamDir, manifest,
 *    routeBase, docsPrefix, llmsUrl}
 *
 * Current versus archived matters because the official site serves them with
 * different URLs: the current tree is unversioned (`/docs/<route>`, inventoried
 * by `/llms.txt`) while an archived release keeps its prefix
 * (`/docs/<version>/<route>`, inventoried by `/docs/<version>/llms.txt`).
 *
 * This module must not import tools/translate/lib/paths.mjs: that file builds
 * its SECTIONS from this one.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

export const REPO = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const WORKSPACE = path.resolve(REPO, '..');
export const UPSTREAM_CONFIG_PATH = path.join(REPO, 'config/upstream.yml');
export const CURRENT_VERSION_PATH = path.join(REPO, 'data/manifests/current-version.json');
export const VERSIONS_PATH = path.join(REPO, 'versions.json');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

let configCache = null;
export function upstreamConfig() {
  if (!configCache) {
    configCache = YAML.parse(fs.readFileSync(UPSTREAM_CONFIG_PATH, 'utf8'));
  }
  return configCache;
}

/** Drop the cache after a tool rewrites config/upstream.yml in the same process. */
export function resetUpstreamConfig() {
  configCache = null;
}

export function currentVersion() {
  const file = readJson(CURRENT_VERSION_PATH, null);
  if (!file?.version) throw new Error(`missing version in ${CURRENT_VERSION_PATH}`);
  return String(file.version);
}

export function archivedVersions() {
  const list = readJson(VERSIONS_PATH, []);
  return list
    .map(String)
    .filter((version) => version && version !== currentVersion())
    .sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
}

/** Current first, then archives newest to oldest. */
export function allVersions() {
  return [currentVersion(), ...archivedVersions()];
}

export function isCurrent(version) {
  return version === currentVersion();
}

/** Is this version installed (`docs/`) or archived (`versioned_docs/`)? */
export function knownVersion(version) {
  return version === currentVersion() || archivedVersions().includes(version);
}

export const MIRROR_CONFIG_PATH = path.join(REPO, 'config/mirror.yml');

let mirrorCache = null;

/** `config/mirror.yml`, the single switchboard for the mirror policy. */
export function mirrorConfig() {
  if (!mirrorCache) {
    mirrorCache = fs.existsSync(MIRROR_CONFIG_PATH)
      ? YAML.parse(fs.readFileSync(MIRROR_CONFIG_PATH, 'utf8')) || {}
      : {};
  }
  return mirrorCache;
}

/** Drop the cache after a tool rewrites `config/mirror.yml` in the same process. */
export function resetMirrorConfig() {
  mirrorCache = null;
}

/** Route spelling -> the slug the config lists. */
function routeSlug(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.mdx?$/i, '')
    .replace(/\/index$/, '');
}

/**
 * Route slugs of the pages only the current release publishes
 * (`sync.current_only_pages`).
 *
 * A version snapshot drops them and the archive links to the current page
 * instead, exactly like the official site's "Version comparison" sidebar entry,
 * so every consumer reads the same list: `snapshot-version` removes the files,
 * `materialize` refuses to write them back into an archive, and the link
 * rewriter pins their route to the current release.
 */
export function currentOnlyPages() {
  const raw = mirrorConfig()?.sync?.current_only_pages || [];
  return raw.map(routeSlug).filter(Boolean);
}

/** Is this route (any spelling) a current-only page? */
export function isCurrentOnlyPage(slug) {
  const clean = routeSlug(slug);
  return Boolean(clean) && currentOnlyPages().includes(clean);
}

/** `7.25` -> `docs-7.25`; the current tree keeps the plain name `docs`. */
export function sectionNameFor(version) {
  return isCurrent(version) ? 'docs' : `docs-${version}`;
}

/** `docs-7.25` -> `7.25`; `docs` -> the current version; unknown -> null. */
export function versionForSection(name) {
  if (name === 'docs') return currentVersion();
  const match = /^docs-(.+)$/.exec(name || '');
  return match && allVersions().includes(match[1]) ? match[1] : null;
}

function expand(template, version) {
  return String(template ?? '').replaceAll('{version}', version);
}

/**
 * URL of one rendered page: the route base plus the page's own path. The
 * official docs always use a trailing slash.
 */
export function pageRouteUrl(plan, routePath) {
  const rel = String(routePath || '').replace(/\.mdx?$/i, '').replace(/(^|\/)index$/, '');
  return `https://manual.mikrotik.com${plan.docsPrefix}/${rel}${rel ? '/' : ''}`;
}

/**
 * Resolve the routing and paths of one version.
 *
 * `prospective` admits a release that is neither installed nor archived yet:
 * `sync --update` must fetch it *before* `versions.json` can list it. Such a
 * plan is treated as the future current tree.
 */
export function versionPlan(version, {prospective = false} = {}) {
  const config = upstreamConfig();
  const section = config?.sections?.docs;
  if (!section) throw new Error('config/upstream.yml has no sections.docs');
  const current = currentVersion();
  const known = knownVersion(version);
  if (!known && !prospective) {
    throw new Error(
      `unknown version ${version}: not the current version (${current}) and not in versions.json`,
    );
  }
  const isCurrentVersion = !known || version === current;
  const override = (section.overrides || {})[version] || {};

  const routeTemplate = isCurrentVersion
    ? (section.routes?.current ?? '')
    : (section.routes?.archived ?? '/docs/{version}');
  const routeBase = String(override.route_base ?? expand(routeTemplate, version)).replace(/\/+$/, '');

  const llmsTemplate = isCurrentVersion
    ? (section.llms?.current ?? '/llms.txt')
    : (section.llms?.archived ?? '/docs/{version}/llms.txt');
  const llmsPath = override.llms_url
    ? expand(override.llms_url, version)
    : expand(llmsTemplate, version);
  // The whole-corpus single file sits next to llms.txt: `/llms-full.txt` for
  // the current tree, `/docs/<version>/llms-full.txt` for an archive. It is
  // only used as an ETag probe; a release that does not publish it answers
  // 404 and is still fetched page by page (see tools/sync/fetch-upstream.mjs).
  const llmsFullPath = override.llms_full_url
    ? expand(override.llms_full_url, version)
    : llmsPath.replace(/llms\.txt$/i, 'llms-full.txt');
  const origin = String(section.base_url || 'https://manual.mikrotik.com').replace(/\/+$/, '');
  const absolute = (pathname) =>
    /^https?:/i.test(pathname) ? pathname : `${origin}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  const llmsUrl = absolute(llmsPath);
  const llmsFullUrl = absolute(llmsFullPath);

  return {
    version,
    isCurrent: isCurrentVersion,
    prospective: !known,
    sectionName: isCurrentVersion ? 'docs' : `docs-${version}`,
    docsDir: isCurrentVersion ? 'docs' : `versioned_docs/version-${version}`,
    upstreamDir: `upstream/${version}`,
    manifest: `upstream/${version}/manifest.json`,
    // Empty for the current tree: it is served at /docs/<route>.
    routeBase,
    // Prefix document routes in this section start with; used when parsing
    // crawled hrefs. The current tree is still unversioned, so it is /docs.
    docsPrefix: routeBase || '/docs',
    llmsUrl,
    llmsFullUrl,
    section,
  };
}

export function versionPlans() {
  return allVersions().map((version) => versionPlan(version));
}
