#!/usr/bin/env node
'use strict';

/**
 * The language registry (`locales.json`), and the only place that knows how a
 * locale maps to a deployment.
 *
 * `locales.json` is the single source of truth for:
 *
 *   - which locales exist, their display labels and their `htmlLang`;
 *   - which GitHub repository builds each locale (`repo`, `owner/name`);
 *   - the site `baseUrl` each locale is deployed under, and its absolute `site`
 *     address (site = origin + baseUrl).
 *
 * Everything else derives from it: `docusaurus.config.ts` builds `i18n.locales`
 * and `localeConfigs` from this file, `tools/lib/site-config.mjs` uses it to
 * resolve `siteUrl`/`baseUrl` for the build and verification tools, and
 * `tools/content/publish.mjs` uses it to push content to the language
 * repositories.
 *
 * This module is CommonJS *on purpose*: `docusaurus.config.ts` is loaded as
 * CommonJS and `require()`s it, while the ESM tools under `tools/` import it
 * through the default export. Keeping one implementation avoids the config and
 * the scripts disagreeing about a locale's address.
 *
 * Environment overrides (still supported, and still documented in README.md):
 *
 *   SITE_LOCALE            which locale this build produces
 *   SITE_URL / BASE_URL    this build's origin / path prefix
 *   LOCALE_<X>_URL         per-locale origin, `<X>` is the primary subtag
 *   LOCALE_<X>_BASE_URL    per-locale path prefix (`zh-Hans` -> `ZH`)
 *
 * The declared `locales.json` values are the defaults; the environment wins
 * when it is set, so local previews and forks keep working without editing the
 * registry.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Repository root (this file lives in `tools/content/`). */
const REPO = path.resolve(__dirname, '../..');
const FILE_NAME = 'locales.json';

/** `owner/name`; both segments are non-empty and contain no slashes. */
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** BCP 47-ish subset that Docusaurus accepts as a locale key. */
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/**
 * Read and parse `locales.json`.
 *
 * @param {string} [file] absolute path (defaults to `<repo>/locales.json`)
 * @returns {{default: string, locales: Record<string, object>}}
 */
function readRegistry(file = path.join(REPO, FILE_NAME)) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(
      `cannot read the locale registry ${path.relative(REPO, file) || file}: ${error.message}. ` +
        'Every site reads it (docusaurus.config.ts, tools/lib/site-config.mjs, ' +
        'tools/content/publish.mjs); restore the file from git.',
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`locales.json is not valid JSON: ${error.message}`);
  }
  return parsed;
}

/** Non-empty baseUrl with a leading and a trailing slash. */
function normalizeBaseUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === '/') return '/';
  const leading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return leading.endsWith('/') ? leading : `${leading}/`;
}

/** Absolute site address without a trailing slash. */
function normalizeSiteUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error('site URL is empty');
  return trimmed.replace(/\/+$/, '');
}

/** `https://host/base/` -> `https://host` (Docusaurus `url` + `baseUrl`). */
function siteOrigin(entry) {
  try {
    return new URL(normalizeSiteUrl(entry.site)).origin;
  } catch {
    throw new Error(`locales.json: "${entry.site}" is not an absolute http(s) URL`);
  }
}

/**
 * Prefix of the per-locale environment overrides: the primary subtag,
 * upper-cased. `en` -> `EN`, `zh-Hans` -> `ZH` (the historical names, so the
 * existing workflows and READMEs keep working), `pt-BR` -> `PT`.
 */
function localeEnvPrefix(locale) {
  return String(locale)
    .split('-')[0]
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

/**
 * Validate the registry. Returns the list of problems; empty means valid.
 *
 * The checks are the ones `npm run locales:check` promises: every `baseUrl`
 * starts and ends with `/`, every `repo` looks like `owner/name`, and the
 * default locale is `en` (the hub is the English site; a fork that wants a
 * different default must change this assertion deliberately).
 */
function validateRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['locales.json must contain a JSON object'];
  }
  if (typeof registry.default !== 'string' || registry.default.trim() === '') {
    errors.push('"default" must be a non-empty locale string');
  } else if (registry.default !== 'en') {
    errors.push(`"default" must be "en" (the hub builds English); got "${registry.default}"`);
  }
  const locales = registry.locales;
  if (!locales || typeof locales !== 'object' || Array.isArray(locales)) {
    errors.push('"locales" must be an object keyed by locale');
    return errors;
  }
  const keys = Object.keys(locales);
  if (keys.length === 0) errors.push('"locales" must declare at least one locale');
  if (typeof registry.default === 'string' && !keys.includes(registry.default)) {
    errors.push(`"default" locale "${registry.default}" is not declared under "locales"`);
  }
  const seenRepos = new Map();
  for (const [locale, entry] of Object.entries(locales)) {
    const where = `locales.${locale}`;
    if (!LOCALE_PATTERN.test(locale)) {
      errors.push(`${where}: locale tag "${locale}" is not a valid language tag`);
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    if (typeof entry.label !== 'string' || entry.label.trim() === '') {
      errors.push(`${where}.label must be a non-empty string`);
    }
    if (typeof entry.repo !== 'string' || !REPO_PATTERN.test(entry.repo)) {
      errors.push(`${where}.repo must look like "owner/name"; got ${JSON.stringify(entry.repo)}`);
    } else {
      const owner = entry.repo.split('/')[0];
      if (seenRepos.has(entry.repo)) {
        errors.push(
          `${where}.repo "${entry.repo}" is already used by "${seenRepos.get(entry.repo)}"; ` +
            'each locale needs its own repository',
        );
      } else {
        seenRepos.set(entry.repo, locale);
      }
      if (owner.startsWith('.') || entry.repo.includes('..')) {
        errors.push(`${where}.repo "${entry.repo}" is not a normal owner/name pair`);
      }
    }
    if (typeof entry.baseUrl !== 'string') {
      errors.push(`${where}.baseUrl must be a string`);
    } else {
      const base = entry.baseUrl;
      if (!base.startsWith('/')) errors.push(`${where}.baseUrl must start with "/" (got "${base}")`);
      if (!base.endsWith('/')) errors.push(`${where}.baseUrl must end with "/" (got "${base}")`);
    }
    if (typeof entry.site !== 'string') {
      errors.push(`${where}.site must be a string`);
    } else {
      let site = null;
      try {
        site = new URL(entry.site);
      } catch {
        errors.push(`${where}.site must be an absolute URL; got "${entry.site}"`);
      }
      if (site) {
        if (site.protocol !== 'https:' && site.protocol !== 'http:') {
          errors.push(`${where}.site must be an http(s) URL; got "${entry.site}"`);
        }
        if (typeof entry.baseUrl === 'string' && entry.baseUrl.startsWith('/')) {
          const sitePath = site.pathname.endsWith('/') ? site.pathname : `${site.pathname}/`;
          const base = normalizeBaseUrl(entry.baseUrl);
          if (!sitePath.endsWith(base)) {
            errors.push(
              `${where}.site ("${entry.site}") must end with ${where}.baseUrl ("${base}")`,
            );
          }
        }
      }
    }
    if (entry.direction !== undefined && entry.direction !== 'ltr' && entry.direction !== 'rtl') {
      errors.push(`${where}.direction must be "ltr" or "rtl" when set`);
    }
    if (entry.htmlLang !== undefined && typeof entry.htmlLang !== 'string') {
      errors.push(`${where}.htmlLang must be a string when set`);
    }
  }
  return errors;
}

/**
 * Resolve every locale's deployment for one build.
 *
 * @param {ReturnType<typeof readRegistry>} registry
 * @param {{siteLocale?: string, env?: Record<string, string | undefined>}} [options]
 * @returns {{
 *   defaultLocale: string,
 *   siteLocale: string,
 *   siteUrl: string,
 *   baseUrl: string,
 *   localeConfigs: Record<string, object>,
 *   homes: Record<string, string>,
 *   zhHome: string | null,
 *   defaultHome: string,
 * }}
 */
function resolveSites(registry, options = {}) {
  const env = options.env || {};
  const declared = registry.locales || {};
  const defaultLocale = registry.default;
  const siteLocale =
    String(options.siteLocale ?? env.SITE_LOCALE ?? '').trim() || defaultLocale;

  if (!Object.prototype.hasOwnProperty.call(declared, siteLocale)) {
    throw new Error(
      `SITE_LOCALE "${siteLocale}" is not declared in locales.json ` +
        `(${Object.keys(declared).join(', ') || 'no locales'}); add it to the registry first.`,
    );
  }

  const current = declared[siteLocale];
  const siteUrl = normalizeSiteUrl(env.SITE_URL || siteOrigin(current));
  const baseUrl = normalizeBaseUrl(env.BASE_URL || current.baseUrl);

  const localeConfigs = {};
  const homes = {};
  for (const [locale, entry] of Object.entries(declared)) {
    const prefix = localeEnvPrefix(locale);
    const isCurrent = locale === siteLocale;
    // The build's own address may be previewed with SITE_URL/BASE_URL; the
    // other locales keep their declared deployment unless LOCALE_<X>_* says
    // otherwise.
    const url = normalizeSiteUrl(
      env[`LOCALE_${prefix}_URL`] || (isCurrent ? siteUrl : siteOrigin(entry)),
    );
    const localeBaseUrl = normalizeBaseUrl(
      env[`LOCALE_${prefix}_BASE_URL`] || (isCurrent ? baseUrl : entry.baseUrl),
    );
    localeConfigs[locale] = {
      label: entry.label,
      url,
      baseUrl: localeBaseUrl,
      direction: entry.direction || 'ltr',
      // `<html lang>`; Docusaurus defaults to the locale key, so this only
      // matters when the registry wants an explicit tag.
      htmlLang: entry.htmlLang || locale,
      // Docusaurus 3 only translates the build whose locale matches; the
      // English hub must not read the language repositories' overlays.
      translate: isCurrent,
    };
    homes[locale] = `${url}${localeBaseUrl}`.replace(/\/+$/, '');
  }

  // The first Chinese locale is the target of the head-script redirect. It is
  // `zh-Hans` today; deriving it keeps the redirect working if the tag gains a
  // script or region subtag.
  const zhLocale = Object.keys(declared).find((locale) => locale.toLowerCase().startsWith('zh'));

  return {
    defaultLocale,
    siteLocale,
    siteUrl,
    baseUrl,
    localeConfigs,
    homes,
    zhHome: zhLocale ? homes[zhLocale] : null,
    defaultHome: homes[defaultLocale],
  };
}

module.exports = {
  REPO,
  FILE_NAME,
  readRegistry,
  validateRegistry,
  normalizeBaseUrl,
  normalizeSiteUrl,
  siteOrigin,
  localeEnvPrefix,
  resolveSites,
};
