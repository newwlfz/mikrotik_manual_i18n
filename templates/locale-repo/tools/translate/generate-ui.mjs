#!/usr/bin/env node
/**
 * Generate one locale's sidebar and theme translation catalogues.
 *
 * The locale is `--locale=<tag>` (default zh-Hans) and must be enabled in
 * `docusaurus.config.ts`; the output tree is `i18n/<locale>/`. The wording in
 * this file is Chinese, so a new locale needs its own catalogue before this
 * script can produce anything but Chinese (see `guides/PIPELINE.md#语种locale`).
 *
 * The default docs sidebar is explicit (`sidebars.ts`), so Docusaurus would keep
 * 1,000+ English labels unless every one is translated. This script derives the
 * labels mechanically:
 *   - category labels come from `config/sidebar-labels.yml` (`docs.categories`),
 *     the single source of truth. Every non-CLI category gets a key; a category
 *     without a reviewed mapping keeps its English message so `translate:ui`
 *     can fill it in without a whole-catalogue overwrite;
 *   - doc labels come from the translated page title in the overlay;
 *   - RouterOS CLI menu names below `CLI Reference` stay verbatim English
 *     (`docs.keep_english`).
 * Nothing here calls a model.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  DEFAULT_TARGET_LOCALE,
  LocaleError,
  assertTranslationLocale,
  localeRoot,
  REPO,
} from './lib/paths.mjs';
import {splitFrontMatter, readField} from './lib/frontmatter.mjs';

let LOCALE;
try {
  LOCALE = assertTranslationLocale(
    process.argv.find((arg) => arg.startsWith('--locale='))?.slice('--locale='.length) ||
      DEFAULT_TARGET_LOCALE,
    {readOnly: false},
  );
} catch (error) {
  // A bad `--locale=` is a user error: one line, no stack trace.
  if (!(error instanceof LocaleError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
const POLICY_FILE = path.join(REPO, 'config/sidebar-labels.yml');
const OUT = path.join(REPO, localeRoot(LOCALE));

/** Prose labels the sidebar policy does not cover (CLI menu names stay English). */
const MANUAL = {
  'Introduction': '简介',
  'Getting Started': '入门',
  'Routing and Networking Protocols': '路由与网络协议',
  'Unicast': '单播',
  'Multicast': '组播',
  'User Guides': '用户指南',
  'Version comparison': '版本比较',
  'FAQ': '常见问题',
  'Note': '说明',
  'Introduction to RouterOS': 'RouterOS 简介',
  'Hardware Guides': '硬件指南',
};

/** Taiwan-Traditional wording for the same handful of prose doc/link labels. */
const MANUAL_HANT = {
  'Introduction': '簡介',
  'Getting Started': '入門',
  'Routing and Networking Protocols': '路由與網路協定',
  'Unicast': '單播',
  'Multicast': '群播',
  'User Guides': '使用者指南',
  'Version comparison': '版本比較',
  'FAQ': '常見問題',
  'Note': '說明',
  'Introduction to RouterOS': 'RouterOS 簡介',
  'Hardware Guides': '硬體指南',
};
const MANUAL_FOR_LOCALE = LOCALE === 'zh-Hant' ? MANUAL_HANT : MANUAL;

/** The label policy is read once; both the docs and hardware sections use it. */
function readPolicy() {
  if (!fs.existsSync(POLICY_FILE)) return {docs: {}, hardware: {}};
  return YAML.parse(fs.readFileSync(POLICY_FILE, 'utf8')) || {};
}

/**
 * Reviewed category wording for one locale and one policy section.
 *
 * The legacy top-level maps stay the zh-Hans default for tools that are not
 * locale-aware. Locale-aware consumers use `locales.<tag>.<section>.categories`:
 *   - `zh-Hant` with no section is a hard error. Falling back to the legacy
 *     Simplified map is the exact bug this split fixes, so it is not allowed;
 *   - an absent individual key is fine: the caller keeps the English label;
 *   - an unknown/English locale gets an empty map (source labels stay English).
 */
function localeCategories(policy, section, locale) {
  const byLocale = policy.locales || {};
  const sectionPolicy = byLocale[locale]?.[section];
  if (locale === 'zh-Hant' && (!sectionPolicy || !sectionPolicy.categories)) {
    throw new Error(
      `config/sidebar-labels.yml: locales.zh-Hant.${section}.categories is missing; ` +
        'refusing to emit Simplified Chinese wording into a zh-Hant catalogue',
    );
  }
  return sectionPolicy?.categories || null;
}

function parseSidebars(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('= {') + 2;
  const end = text.lastIndexOf('};') + 1;
  return JSON.parse(text.slice(start, end).replace(/,\s*([}\]])/g, '$1'));
}

/**
 * Reviewed translation for a sidebar label.
 *
 * `docs.categories` wins: it is keyed by the Docusaurus category key and is the
 * only place a translator has to edit. `MANUAL` remains as a fallback for the
 * handful of prose *doc/link* labels that are not categories. A null result is
 * not a reason to drop the key any more: the caller keeps the English message
 * so the entry is visible to `translate:ui`.
 */
function categoryTranslation(label, key, docsPolicy, manual = MANUAL_FOR_LOCALE) {
  const categories = docsPolicy?.categories || {};
  if (key && categories[key]) return categories[key];
  if (categories[label]) return categories[label];
  if (manual[label]) return manual[label];
  return null;
}

/** Category keys whose whole subtree is kept verbatim (RouterOS CLI menus). */
function keepPrefixes(docsPolicy) {
  return (docsPolicy?.keep_english || []).map((entry) => String(entry));
}

/** Is this node the root of a subtree that keeps its English labels? */
function isKeepBranch(node, prefixes) {
  const key = String(node.key ?? node.label ?? '');
  return prefixes.some((prefix) => key.startsWith(prefix));
}

function walkIn(node, cliBranch, visit, prefixes = []) {
  if (Array.isArray(node)) {
    for (const child of node) walkIn(child, cliBranch, visit, prefixes);
    return;
  }
  if (!node || typeof node !== 'object') return;
  // The `CLI Reference` section itself is prose; everything below it is a
  // RouterOS menu name and must stay English. The boundary is configuration.
  visit(node, cliBranch);
  const next =
    cliBranch || isKeepBranch(node, prefixes) || node.label === 'CLI Reference';
  if (node.items) walkIn(node.items, next, visit, prefixes);
}

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (node.items) walk(node.items, visit);
}

function overlayField(overlayRoot, id, field) {
  const file = path.join(overlayRoot, `${id}.md`);
  if (!fs.existsSync(file)) return null;
  const {frontMatter} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
  const value = readField(frontMatter, field);
  return value && /[\u4e00-\u9fff]/.test(value) ? value : null;
}

function overlayTitle(overlayRoot, id) {
  return overlayField(overlayRoot, id, 'title');
}

/** The sidebar label wins over the title: it is the short form the nav shows. */
function overlayLabel(overlayRoot, id) {
  return overlayField(overlayRoot, id, 'sidebar_label') || overlayTitle(overlayRoot, id);
}

/** The `Version comparison` entry is mirror-local prose, not a RouterOS menu. */
function isCompareNode(node) {
  return node.id === 'cli-reference/compare-versions' || node.key === 'version-comparison';
}

function buildSidebarTranslations(sidebar, overlayRoot, docsPolicy, manual = MANUAL_FOR_LOCALE) {
  const out = {};
  const prefixes = keepPrefixes(docsPolicy);
  walkIn(
    sidebar,
    false,
    (node, cliBranch) => {
      if (node.type === 'category' && node.label) {
        const label = node.label;
        const key = `sidebar.docs.category.${node.key ?? label}`;
        if (out[key] || cliBranch) return;
        const zh = categoryTranslation(label, node.key ?? label, docsPolicy);
        // Every non-CLI category gets a key even without a reviewed wording:
        // keep the English message and let translate:ui fill it in later.
        out[key] = {message: zh || label, description: `Category '${label}'`};
      } else if (node.type === 'link' && node.label) {
        const key = `sidebar.docs.link.${node.key ?? node.label}`;
        if (out[key] || (cliBranch && !isCompareNode(node))) return;
        const zh = categoryTranslation(node.label, node.key ?? node.label, docsPolicy);
        if (zh) out[key] = {message: zh, description: `Link '${node.label}'`};
      } else if (node.type === 'doc' && node.id && node.label) {
        const key = `sidebar.docs.doc.${node.key ?? node.label}`;
        if (out[key] || (cliBranch && !isCompareNode(node))) return;
        // A page that is not translated yet can still have a translated nav
        // label (`Version comparison` is mirror-local prose, not a menu name).
        const zh = overlayLabel(overlayRoot, node.id) ?? manual[node.label] ?? null;
        if (zh && zh !== node.label) {
          out[key] = {message: zh, description: `Doc '${node.label}'`};
        }
      }
    },
    prefixes,
  );
  return out;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

const hasChinese = (value) => /[\u4e00-\u9fff]/.test(String(value ?? ''));

function mergeExisting(file, translations) {
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const [key, value] of Object.entries(translations)) {
    const previous = existing[key];
    // An unreviewed English fallback must never replace a translation that
    // translate:ui (or a human) already wrote into the catalogue.
    if (previous?.message && hasChinese(previous.message) && !hasChinese(value.message)) continue;
    existing[key] = value;
  }
  return existing;
}

function main() {
  const policy = readPolicy();
  const docsPolicy = {
    ...(policy.docs || {}),
    categories: localeCategories(policy, 'docs', LOCALE) ?? {},
  };
  const sidebars = parseSidebars(path.join(REPO, 'sidebars.ts'));

  const current = buildSidebarTranslations(
    sidebars.docs,
    path.join(OUT, 'docusaurus-plugin-content-docs/current'),
    docsPolicy,
  );
  const currentFile = path.join(OUT, 'docusaurus-plugin-content-docs/current.json');
  // Never overwrite the catalogue whole: hand-reviewed doc/link entries that
  // this generator does not re-derive must survive a regenerate.
  writeJson(currentFile, mergeExisting(currentFile, current));

  // One catalogue per archived version, discovered from versioned_sidebars/ so a
  // new release needs no edit here.
  const versionedCounts = {};
  const versionedDir = path.join(REPO, 'versioned_sidebars');
  const versionedFiles = fs.existsSync(versionedDir)
    ? fs.readdirSync(versionedDir).filter((file) => /^version-.+-sidebars\.json$/.test(file))
    : [];
  for (const file of versionedFiles.sort()) {
    const version = file.replace(/^version-/, '').replace(/-sidebars\.json$/, '');
    const tree = JSON.parse(fs.readFileSync(path.join(versionedDir, file), 'utf8'));
    const translations = buildSidebarTranslations(
      tree.docs,
      path.join(OUT, `docusaurus-plugin-content-docs/version-${version}`),
      docsPolicy,
    );
    const target = path.join(OUT, `docusaurus-plugin-content-docs/version-${version}.json`);
    writeJson(target, mergeExisting(target, translations));
    versionedCounts[version] = Object.keys(translations).length;
  }

  // Theme strings: fixed wording, authored here rather than sent to a model.
  const hant = LOCALE === 'zh-Hant';
  const navbarFile = path.join(OUT, 'docusaurus-theme-classic/navbar.json');
  writeJson(navbarFile, mergeExisting(navbarFile, {
    'item.label.Hardware Guides': {message: hant ? '硬體指南' : '硬件指南'},
    'item.label.CLI compare': {message: hant ? 'CLI 版本比較' : 'CLI 版本对比'},
    'item.label.Product news': {message: hant ? '產品新聞' : '产品新闻'},
    'item.label.Docs Changes': {message: hant ? '文件變更' : '文档变更'},
  }));

  const footerFile = path.join(OUT, 'docusaurus-theme-classic/footer.json');
  writeJson(footerFile, mergeExisting(footerFile, {
    'link.title.Docs': {message: hant ? '文件' : '文档'},
    'link.title.Community': {message: hant ? '社群' : '社区'},
    'link.title.MikroTik': {message: 'MikroTik'},
    'link.item.label.Introduction': {message: hant ? '簡介' : '简介'},
    'link.item.label.CLI Reference': {message: hant ? 'CLI 參考' : 'CLI 参考'},
    'link.item.label.Forum': {message: hant ? '論壇' : '论坛'},
    'link.item.label.Product news': {message: hant ? '產品新聞' : '产品新闻'},
    'link.item.label.Docs Changes': {message: hant ? '文件變更' : '文档变更'},
    copyright: {message: hant ? '版權所有 © 2026 MikroTik。由 Docusaurus 建置。' : '版权所有 © 2026 MikroTik。由 Docusaurus 构建。'},
  }));

  const hardwareFile = path.join(OUT, 'docusaurus-plugin-content-docs-hardware/current.json');
  if (fs.existsSync(hardwareFile)) {
    // Hardware Guides are a category tree of product names: only the category
    // level is translated (config/sidebar-labels.yml), never the models.
    const hardwarePolicy = {
      ...(policy.hardware || {categories: {}}),
      categories: localeCategories(policy, 'hardware', LOCALE) ?? {},
    };
    const existing = JSON.parse(fs.readFileSync(hardwareFile, 'utf8'));
    const prefix = 'sidebar.hardware.category.';
    for (const [key, value] of Object.entries(existing)) {
      if (!key.startsWith(prefix)) continue;
      // The English label is the catalogue key's suffix, NOT value.message:
      // looking up the already-translated message meant the policy never
      // applied and three categories kept stale wording.
      const label = key.slice(prefix.length);
      const mapped = hardwarePolicy.categories?.[label];
      if (mapped) existing[key] = {...value, message: mapped};
    }
    writeJson(hardwareFile, existing);
  }

  const counts = {
    current: Object.keys(current).length,
    versioned: versionedCounts,
  };
  process.stdout.write(`${JSON.stringify(counts)}\n`);
}

main();
