import path from 'node:path';
import fs from 'node:fs';

import {
  REPO as REPO_ROOT,
  WORKSPACE as WORKSPACE_ROOT,
  archivedVersions,
  currentVersion,
  versionPlan,
} from '../../sync/lib/versions.mjs';
import {resolveLocales} from '../../lib/site-config.mjs';

export const REPO = REPO_ROOT;
export const WORKSPACE = WORKSPACE_ROOT;

/**
 * Translation target used when the caller does not ask for one.
 *
 * `zh-Hans` is the only translated locale today. Every tool accepts
 * `--locale=<tag>`; the tag must be enabled in `docusaurus.config.ts`
 * (`resolveLocales()`) before a write, while read-only runs may probe a locale
 * that is not enabled yet (see `assertTranslationLocale`).
 */
export const DEFAULT_TARGET_LOCALE = 'zh-Hans';

/**
 * Legacy corpus areas keyed by the RouterOS version they were captured from.
 * Anything newer than the newest captured release has no legacy corpus: its
 * wording comes from the model memory and the canonical archives instead.
 */
const LEGACY_AREA_BY_VERSION = {
  '7.24': 'v7.24',
  '7.25': 'v7.25',
};

/** Docusaurus plugin whose localisation tree holds each section's overlay. */
const SECTION_PLUGINS = {
  docs: 'docusaurus-plugin-content-docs',
  hardware: 'docusaurus-plugin-content-docs-hardware',
  blog: 'docusaurus-plugin-content-blog',
  changelog: 'docusaurus-plugin-content-blog-changelog',
};

function docsSection(version, derivedFrom) {
  const plan = versionPlan(version);
  const area = LEGACY_AREA_BY_VERSION[version] || null;
  return {
    name: plan.sectionName,
    source: plan.docsDir,
    plugin: SECTION_PLUGINS.docs,
    // Docusaurus resolves a docs plugin's localisation directory to
    // `i18n/<locale>/docusaurus-plugin-content-docs[/<version>]`, hence the
    // `current` / `version-<v>` slot below the plugin name.
    suffix: plan.isCurrent ? 'current' : `version-${version}`,
    legacy: area ? [area] : [],
    // Legacy Chinese links point at the version they were captured from; when
    // such a paragraph is reused, that prefix has to be stripped.
    stripVersion: area ? version : null,
    // Every section is derived from the next older one, so only the oldest
    // archive is canonical and no upgrade rewrites reviewed wording: a release
    // reuses each unchanged English block and translates only what changed.
    ...(derivedFrom ? {derivedFrom} : {}),
  };
}

/**
 * Every English section, with the Docusaurus plugin (`plugin`) and the slot
 * below it (`suffix`) that define its localisation tree.
 *
 * Docs are generated: `docs/` is the current release, `versioned_docs/version-*`
 * are the archives listed in `versions.json`. Adding a release therefore never
 * requires editing this list, and adding a locale never requires editing it
 * either: `overlayRootFor(locale, section)` derives the overlay path.
 */
const SECTION_SPECS = [
  ...(() => {
    const archives = archivedVersions();
    const current = currentVersion();
    const sections = [
      docsSection(current, archives[0] ? `docs-${archives[0]}` : null),
    ];
    for (const [index, version] of archives.entries()) {
      const older = archives[index + 1];
      sections.push(docsSection(version, older ? `docs-${older}` : null));
    }
    return sections;
  })(),
  {
    name: 'hardware',
    source: 'hardware',
    plugin: SECTION_PLUGINS.hardware,
    // A docs plugin keeps its `current` / `version-<v>` slot below the plugin
    // name; the blog plugins have no versioning, so they have no suffix.
    suffix: 'current',
    // Non-versioned section: the only legacy translation lives in the 7.26
    // tree, so reuse is limited to pages whose English body is identical.
    legacy: ['current'],
    stripVersion: '7.25',
    exactOnly: true,
  },
  {
    name: 'blog',
    source: 'blog',
    plugin: SECTION_PLUGINS.blog,
    suffix: null,
    legacy: ['current'],
    stripVersion: '7.25',
    exactOnly: true,
  },
  {
    name: 'changelog',
    source: 'changelog',
    plugin: SECTION_PLUGINS.changelog,
    suffix: null,
    legacy: ['current'],
    stripVersion: '7.25',
    exactOnly: true,
  },
];

/** `i18n/<locale>`: the root Docusaurus copies every locale tree into. */
export function localeRoot(locale = DEFAULT_TARGET_LOCALE) {
  return `i18n/${locale}`;
}

/**
 * Overlay root of one section for one locale, relative to the repository.
 *
 * `section` is a section (spec or materialised) or a section name
 * (`docs`, `docs-7.24`, `hardware`, ...). This is the only place the overlay
 * path is assembled: no other module concatenates `i18n/<locale>/...`.
 */
export function overlayRootFor(locale, section) {
  const spec =
    typeof section === 'string' ? SECTION_SPECS.find((item) => item.name === section) : section;
  if (!spec || !spec.plugin) {
    const name = typeof section === 'string' ? section : section?.name;
    throw new Error(
      `unknown section "${name}"; expected ${SECTION_SPECS.map((item) => item.name).join(', ')}`,
    );
  }
  return [localeRoot(locale), spec.plugin, spec.suffix].filter(Boolean).join('/');
}

/** Every section with `overlay` resolved for `locale` (and `locale` recorded). */
export function sectionsFor(locale = DEFAULT_TARGET_LOCALE) {
  return SECTION_SPECS.map((spec) => ({
    ...spec,
    locale,
    overlay: overlayRootFor(locale, spec),
  }));
}

/**
 * Every English section and the default (`zh-Hans`) overlay it maps to.
 *
 * Kept for callers that work on the one translated locale only (verify, the
 * post-passes, the link rewriter); locale-aware callers use `sectionsFor()`.
 */
export const SECTIONS = sectionsFor(DEFAULT_TARGET_LOCALE);

/** Default location of the read-only legacy translations (local bootstrap only). */
export const DEFAULT_LEGACY_ROOT = path.join(
  WORKSPACE,
  'mikrotik_manual_i18n/repo/content',
);

/** Translation memory and derived indexes are local build artefacts. */
export const WORK_DIR = path.join(WORKSPACE, 'work/translate');

/** `work/translate/tm-global.<locale>.json`. */
export function tmFile(locale = DEFAULT_TARGET_LOCALE) {
  return path.join(WORK_DIR, `tm-global.${locale}.json`);
}

/** `config/translation-patches/<locale>/`; `<section>/<page>.yml` lives below it. */
export function patchDir(locale = DEFAULT_TARGET_LOCALE) {
  return path.join(REPO, 'config/translation-patches', locale);
}

/** `config/glossary/<locale>.yml`. */
export function glossaryFile(locale = DEFAULT_TARGET_LOCALE) {
  return path.join(REPO, 'config/glossary', `${locale}.yml`);
}

/** Well-formed BCP-47-ish tag: `zh-Hans`, `ru-RU`, `pt-BR`, `sr-Latn`. */
const LOCALE_TAG = /^[a-z]{2,3}(?:-[A-Za-z]{4})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$/;

/** Locales the site may be translated into: configured minus the source locale. */
export function translatableLocales() {
  const {locales, defaultLocale} = resolveLocales();
  return locales.filter((locale) => locale !== defaultLocale);
}

/**
 * A bad `--locale=` value: a user error, not a crash, so CLIs print the message
 * without a stack trace and exit 1.
 */
export class LocaleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LocaleError';
  }
}

/**
 * Does this locale have any translation resource on disk yet?
 *
 * `apply` is the generator that materialises a locale's overlays, so running it
 * for a tag with no glossary, no patches, no TM and no overlay tree would only
 * write an English mirror under `i18n/<locale>/`. That is never what a probe
 * run wants (and a fresh locale is bootstrapped by adding the glossary first).
 */
export function localeHasResources(locale = DEFAULT_TARGET_LOCALE) {
  return [
    glossaryFile(locale),
    patchDir(locale),
    tmFile(locale),
    path.join(REPO, localeRoot(locale)),
  ].some((target) => fs.existsSync(target));
}

/**
 * Validate a translation target and return it.
 *
 * Rules:
 *   - the source locale (`i18n.defaultLocale`, `en`) is never a target;
 *   - a configured locale is always accepted;
 *   - a well-formed tag that is not configured yet is accepted only for a
 *     read-only run (`--dry-run` / `--check`), so the conventional paths can be
 *     probed before the locale is added to `docusaurus.config.ts`;
 *   - anything else is rejected, and the message lists the available locales.
 */
export function assertTranslationLocale(locale, {readOnly = false} = {}) {
  const {locales, defaultLocale} = resolveLocales();
  const targets = translatableLocales();
  const wanted = String(locale ?? '').trim();
  if (!wanted) {
    throw new LocaleError(
      `missing locale; translation targets: ${targets.join(', ') || '(none)'}`,
    );
  }
  if (wanted === defaultLocale) {
    throw new LocaleError(
      `locale "${wanted}" is the source locale (docusaurus.config.ts i18n.defaultLocale); ` +
        `it is never a translation target; translation targets: ${targets.join(', ') || '(none)'}`,
    );
  }
  if (locales.includes(wanted)) return wanted;
  if (!LOCALE_TAG.test(wanted)) {
    throw new LocaleError(
      `unknown locale "${wanted}"; available locales: ${locales.join(', ')} ` +
        `(translation targets: ${targets.join(', ') || '(none)'})`,
    );
  }
  if (!readOnly) {
    throw new LocaleError(
      `locale "${wanted}" is not enabled in docusaurus.config.ts i18n.locales ` +
        `(${locales.join(', ')}); add it there before writing overlays, or use --dry-run`,
    );
  }
  process.stderr.write(
    `note: locale "${wanted}" is not enabled in docusaurus.config.ts yet; ` +
      'read-only run against the conventional paths (nothing is written)\n',
  );
  return wanted;
}

export function walkMarkdown(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (/\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

export function relative(base, file) {
  return path.relative(base, file).split(path.sep).join('/');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}
