#!/usr/bin/env node
/**
 * The hub -> language-repository fan-out contract (single source of truth).
 *
 * Both `publish.mjs` (the writer) and `fanout-check.mjs` (the assertion) import
 * this module. Keeping the list here is what stops the publisher and the
 * checker from drifting apart: there is exactly one copy of the eleven content
 * roots, one copy of the registry file name and one expected sync list.
 *
 * `CONTENT_ROOTS` was historically declared inside `publish.mjs`; it now lives
 * here so the assertion can use the very same contract the publisher uses.
 * `EXPECTED_SYNC_LIST` is the complete set the hub promises to push: the eleven
 * content roots plus `locales.json` (12 entries).
 *
 * Identity scope: only `BYTE_IDENTICAL_ENTRIES` are asserted byte-for-byte
 * across the three checkouts. The remaining roots are received from the hub
 * and then rewritten in place by each locale's translate job, so their bytes
 * legitimately differ; the assertion checks their presence instead.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import localeRegistry from './locales.js';

/** Directories are replaced wholesale; single files are overwritten in place. */
export const CONTENT_ROOTS = Object.freeze([
  'docs',
  // Hub-owned repository documentation (English README + guides). It has no
  // site route; the locale repos translate it into an overlay only. Replacing
  // this directory wholesale is what gives the translate workflow its source.
  'hub-docs',
  'versioned_docs',
  'hardware',
  'blog',
  'changelog',
  'data',
  'sidebars.ts',
  'sidebars-hardware.ts',
  'versioned_sidebars',
  'versions.json',
]);

/** Locale registry: content-neutral, pushed byte for byte. */
export const REGISTRY_FILE = 'locales.json';

/** The complete expected sync set, in publisher order. */
export const EXPECTED_SYNC_LIST = Object.freeze([...CONTENT_ROOTS, REGISTRY_FILE]);

/**
 * Entries whose bytes must be identical in all three repositories.
 *
 * `locales.json` is the registry itself (a flipped `available` that reached
 * only one repo is the drift that caused problem 1); `sidebars-hardware.ts`
 * carries the Quick Guides structure (problem 2); `hub-docs/` is the English
 * README/guides source that the locale translate workflow reads (translations
 * go into `i18n/<locale>/docusaurus-plugin-content-hub-docs/`, never into the
 * published tree). None of them is rewritten in place, so a sha mismatch is
 * unambiguous evidence of a missed fan-out.
 */
export const BYTE_IDENTICAL_ENTRIES = Object.freeze([
  REGISTRY_FILE,
  'sidebars-hardware.ts',
  'hub-docs',
]);

/** Built-site meta that must agree with each repository's own locales.json. */
export const BUILD_META_FILE = 'build/index.html';
export const BUILD_META_TAG = 'docusaurus-available-locales';

/** sha256 of one regular file (throws when unreadable). */
export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Content identity of one sync entry: a single file uses its own sha256; a
 * directory uses a sorted manifest of `<relative path>\t<sha256>` lines.
 * Returns null when the entry does not exist.
 */
export function sha256Entry(entryPath) {
  if (!fs.existsSync(entryPath)) return null;
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) return sha256File(entryPath);
  if (!stat.isDirectory()) return null;
  const files = [];
  const walk = (dir, rel) => {
    for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
      const absolute = path.join(dir, item.name);
      const relative = rel ? `${rel}/${item.name}` : item.name;
      if (item.isDirectory()) walk(absolute, relative);
      else if (item.isFile()) files.push(`${relative}\t${sha256File(absolute)}`);
    }
  };
  walk(entryPath, '');
  files.sort();
  return crypto.createHash('sha256').update(files.join('\n')).digest('hex');
}

/**
 * Local checkouts of every locale declared in the hub registry.
 *
 * The registry's `repo` field (`owner/name`) is the only address we need: the
 * three checkouts are siblings of the hub in this workspace. `--repos-root`
 * lets a caller point the assertion at a different layout.
 */
export function resolveRepositories(registry, reposRoot) {
  return Object.entries(registry.locales || {}).map(([locale, entry]) => ({
    locale,
    repo: entry.repo,
    isDefault: locale === registry.default,
    path: path.join(reposRoot, path.basename(String(entry.repo || ''))),
  }));
}

/** Available locales derived from a registry object (shared derivation logic). */
export function availableFrom(registry) {
  return localeRegistry.availableLocales(registry);
}

/** Read the built site's `docusaurus-available-locales` meta, if it exists. */
export function readBuildMeta(repoPath) {
  const file = path.join(repoPath, BUILD_META_FILE);
  if (!fs.existsSync(file)) return {found: false, file, available: null};
  const html = fs.readFileSync(file, 'utf8');
  const tag = new RegExp(
    `<meta[^>]+name=["']${BUILD_META_TAG}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    'i',
  ).exec(html);
  const withContentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${BUILD_META_TAG}["'][^>]*>`,
    'i',
  ).exec(html);
  const raw = (tag || withContentFirst || [])[1];
  if (raw === undefined) return {found: true, file, available: null};
  let available;
  try {
    available = JSON.parse(raw.replace(/&quot;/gi, '"').replace(/&amp;/gi, '&'));
  } catch {
    available = null;
  }
  return {
    found: true,
    file,
    available: Array.isArray(available) ? available : null,
    raw,
  };
}

/**
 * Scan the three checkouts and produce a deterministic fan-out report.
 *
 * Read-only: no clone, no commit, no push, no environment/token access. The
 * same report feeds `fanout-check.mjs` and the local simulation in
 * `publish.mjs`, so the printed "needs rebuild" list cannot disagree with the
 * assertion.
 */
export function collectFanout({hubPath, reposRoot = path.dirname(hubPath)}) {
  const hubRegistryFile = path.join(hubPath, REGISTRY_FILE);
  const registry = localeRegistry.readRegistry(hubRegistryFile);
  const registryErrors = localeRegistry.validateRegistry(registry);
  const repositories = resolveRepositories(registry, reposRoot).map((repo) => {
    const registryFile = path.join(repo.path, REGISTRY_FILE);
    let ownRegistry = null;
    let ownError = null;
    try {
      ownRegistry = localeRegistry.readRegistry(registryFile);
    } catch (error) {
      ownError = error.message;
    }
    const meta = readBuildMeta(repo.path);
    return {
      ...repo,
      exists: fs.existsSync(repo.path),
      registrySha: fs.existsSync(registryFile) ? sha256File(registryFile) : null,
      ownAvailable: ownRegistry ? availableFrom(ownRegistry) : null,
      ownRegistryError: ownError,
      buildMeta: meta,
    };
  });

  const hub = repositories.find((repo) => repo.isDefault) || null;
  const identity = BYTE_IDENTICAL_ENTRIES.map((entry) => {
    const shaByLocale = {};
    for (const repo of repositories) {
      shaByLocale[repo.locale] = repo.exists ? sha256Entry(path.join(repo.path, entry)) : null;
    }
    const hubSha = hub ? shaByLocale[hub.locale] : null;
    const diffs = repositories
      .filter((repo) => !repo.isDefault && shaByLocale[repo.locale] !== hubSha)
      .map((repo) => ({
        locale: repo.locale,
        repo: repo.repo,
        hubSha,
        sha256: shaByLocale[repo.locale],
      }));
    return {entry, hubSha, shaByLocale, equal: diffs.length === 0, diffs};
  });

  const presence = [];
  for (const repo of repositories) {
    for (const entry of EXPECTED_SYNC_LIST) {
      const exists = repo.exists && fs.existsSync(path.join(repo.path, entry));
      if (!exists) presence.push({locale: repo.locale, repo: repo.repo, entry});
    }
  }

  const buildMeta = [];
  for (const repo of repositories) {
    const expected = repo.ownAvailable;
    const actual = repo.buildMeta.available;
    const equal = Array.isArray(expected) && Array.isArray(actual) &&
      expected.length === actual.length && expected.every((locale, i) => locale === actual[i]);
    buildMeta.push({
      locale: repo.locale,
      repo: repo.repo,
      file: path.relative(hubPath, repo.buildMeta.file),
      found: repo.buildMeta.found,
      expected,
      actual,
      equal,
      registryError: repo.ownRegistryError,
    });
  }

  const rebuild = [];
  for (const repo of repositories) {
    const reasons = [];
    if (!repo.exists) reasons.push('本地仓不存在（需先 clone 再 fan-out）');
    if (repo.ownRegistryError) reasons.push(`locales.json 不可解析：${repo.ownRegistryError}`);
    for (const item of identity) {
      if (item.diffs.some((diff) => diff.locale === repo.locale)) {
        reasons.push(`${item.entry} 与 hub 不一致`);
      }
    }
    for (const item of presence) {
      if (item.locale === repo.locale) reasons.push(`缺少期望同步项 ${item.entry}`);
    }
    const meta = buildMeta.find((item) => item.locale === repo.locale);
    if (!meta.equal) {
      reasons.push(
        meta.found
          ? `build meta available-locales 陈旧（派生 ${JSON.stringify(meta.expected)} / 产物 ${JSON.stringify(meta.actual)}）`
          : 'build/index.html 不存在（尚未重建）',
      );
    }
    if (reasons.length) rebuild.push({locale: repo.locale, repo: repo.repo, reasons});
  }

  const ok =
    registryErrors.length === 0 &&
    identity.every((item) => item.equal) &&
    presence.length === 0 &&
    buildMeta.every((item) => item.equal) &&
    rebuild.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    hub: hub ? {locale: hub.locale, repo: hub.repo, path: hub.path} : null,
    reposRoot,
    contract: {
      contentRoots: [...CONTENT_ROOTS],
      registryFile: REGISTRY_FILE,
      expectedSyncList: [...EXPECTED_SYNC_LIST],
      byteIdentical: [...BYTE_IDENTICAL_ENTRIES],
      buildMetaTag: BUILD_META_TAG,
    },
    registry: {sha256: fs.existsSync(hubRegistryFile) ? sha256File(hubRegistryFile) : null, errors: registryErrors, available: availableFrom(registry)},
    repositories: repositories.map(({locale, repo, isDefault, path: repoPath, exists, registrySha, ownAvailable, buildMeta: meta}) => ({
      locale,
      repo,
      isDefault,
      path: repoPath,
      exists,
      registrySha,
      available: ownAvailable,
      buildMeta: {found: meta.found, available: meta.available},
    })),
    identity,
    presence,
    buildMeta,
    rebuild,
    ok,
    counts: {
      repositories: repositories.length,
      expectedSyncEntries: EXPECTED_SYNC_LIST.length,
      byteIdenticalEntries: BYTE_IDENTICAL_ENTRIES.length,
      identityMismatches: identity.reduce((n, item) => n + item.diffs.length, 0),
      presenceFailures: presence.length,
      buildMetaMismatches: buildMeta.filter((item) => !item.equal).length,
      rebuildTargets: rebuild.length,
    },
  };
}

export default {
  CONTENT_ROOTS,
  REGISTRY_FILE,
  EXPECTED_SYNC_LIST,
  BYTE_IDENTICAL_ENTRIES,
  BUILD_META_FILE,
  BUILD_META_TAG,
  sha256File,
  sha256Entry,
  resolveRepositories,
  availableFrom,
  readBuildMeta,
  collectFanout,
};
