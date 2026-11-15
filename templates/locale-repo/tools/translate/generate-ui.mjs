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
 *   - category labels come from the legacy sidebar catalogue (matched by path)
 *     and a small manual table for the terms it does not cover;
 *   - doc labels come from the translated page title in the overlay.
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
const LEGACY_LABELS = path.join(
  REPO,
  '../mikrotik_manual_i18n/repo/data/i18n/sidebar_labels.json',
);
const OUT = path.join(REPO, localeRoot(LOCALE));

/** Prose labels the legacy catalogue does not cover (CLI menu names stay English). */
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

function parseSidebars(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('= {') + 2;
  const end = text.lastIndexOf('};') + 1;
  return JSON.parse(text.slice(start, end).replace(/,\s*([}\]])/g, '$1'));
}

function legacyCategoryMap() {
  if (!fs.existsSync(LEGACY_LABELS)) return {};
  // The legacy catalogue is keyed by language, like the corpus itself.
  const data = JSON.parse(fs.readFileSync(LEGACY_LABELS, 'utf8'))[LOCALE] || {};
  const map = {};
  for (const [key, value] of Object.entries(data)) {
    map[key.replace('sidebar.docs.category.', '')] = value.message;
  }
  return map;
}

function categoryTranslation(label, id, legacy) {
  if (id) {
    let candidate = id.replace(/\/index$/, '');
    const parts = candidate.split('/');
    while (parts.length > 0) {
      if (legacy[parts.join('/')]) return legacy[parts.join('/')];
      parts.pop();
    }
  }
  if (MANUAL[label]) return MANUAL[label];
  // CLI menu names, acronyms and product names are identifiers: leave them.
  if (/^[a-zA-Z0-9]/i.test(label) === false) return null;
  if (/^[a-z0-9/._-]+$/.test(label)) return null;
  return null;
}

function walkIn(node, cliBranch, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walkIn(child, cliBranch, visit);
    return;
  }
  if (!node || typeof node !== 'object') return;
  // The `CLI Reference` section itself is prose; everything below it is a
  // RouterOS menu name and must stay English.
  visit(node, cliBranch);
  const next = cliBranch || (node.type === 'category' && node.label === 'CLI Reference');
  if (node.items) walkIn(node.items, next, visit);
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

function buildSidebarTranslations(sidebar, overlayRoot, legacy) {
  const out = {};
  // CLI menu names are RouterOS identifiers: the whole subtree stays English.
  const inCli = (node) => String(node.key ?? node.label ?? '').startsWith('cli-reference/');
  walkIn(sidebar, false, (node, cliBranch) => {
    if (node.type === 'category' && node.label) {
      const label = node.label;
      const key = `sidebar.docs.category.${node.key ?? label}`;
      if (out[key] || cliBranch) return;
      const zh = categoryTranslation(label, node.link?.id, legacy);
      if (zh) out[key] = {message: zh, description: `Category '${label}'`};
    } else if (node.type === 'link' && node.label) {
      const key = `sidebar.docs.link.${node.key ?? node.label}`;
      if (out[key] || (cliBranch && !isCompareNode(node))) return;
      const zh = categoryTranslation(node.label, node.href, legacy);
      if (zh) out[key] = {message: zh, description: `Link '${node.label}'`};
    } else if (node.type === 'doc' && node.id && node.label) {
      const key = `sidebar.docs.doc.${node.key ?? node.label}`;
      if (out[key] || (cliBranch && !isCompareNode(node))) return;
      // A page that is not translated yet can still have a translated nav
      // label (`Version comparison` is mirror-local prose, not a menu name).
      const zh = overlayLabel(overlayRoot, node.id) ?? MANUAL[node.label] ?? null;
      if (zh && zh !== node.label) {
        out[key] = {message: zh, description: `Doc '${node.label}'`};
      }
    }
  });
  return out;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function mergeExisting(file, translations) {
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return {...existing, ...translations};
}

function main() {
  const legacy = legacyCategoryMap();
  const sidebars = parseSidebars(path.join(REPO, 'sidebars.ts'));

  const current = buildSidebarTranslations(
    sidebars.docs,
    path.join(OUT, 'docusaurus-plugin-content-docs/current'),
    legacy,
  );
  writeJson(
    path.join(OUT, 'docusaurus-plugin-content-docs/current.json'),
    current,
  );

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
      legacy,
    );
    writeJson(
      path.join(OUT, `docusaurus-plugin-content-docs/version-${version}.json`),
      translations,
    );
    versionedCounts[version] = Object.keys(translations).length;
  }

  // Theme strings: fixed wording, authored here rather than sent to a model.
  const navbarFile = path.join(OUT, 'docusaurus-theme-classic/navbar.json');
  writeJson(navbarFile, mergeExisting(navbarFile, {
    'item.label.Hardware Guides': {message: '硬件指南'},
    'item.label.CLI compare': {message: 'CLI 版本对比'},
    'item.label.Product news': {message: '产品新闻'},
    'item.label.Docs Changes': {message: '文档变更'},
  }));

  const footerFile = path.join(OUT, 'docusaurus-theme-classic/footer.json');
  writeJson(footerFile, mergeExisting(footerFile, {
    'link.title.Docs': {message: '文档'},
    'link.title.Community': {message: '社区'},
    'link.title.MikroTik': {message: 'MikroTik'},
    'link.item.label.Introduction': {message: '简介'},
    'link.item.label.CLI Reference': {message: 'CLI 参考'},
    'link.item.label.Forum': {message: '论坛'},
    'link.item.label.Product news': {message: '产品新闻'},
    'link.item.label.Docs Changes': {message: '文档变更'},
    copyright: {message: '版权所有 © 2026 MikroTik。由 Docusaurus 构建。'},
  }));

  const hardwareFile = path.join(OUT, 'docusaurus-plugin-content-docs-hardware/current.json');
  if (fs.existsSync(hardwareFile)) {
    // Hardware Guides are a category tree of product names: only the category
    // level is translated (config/sidebar-labels.yml), never the models.
    const policy = (() => {
      const file = path.join(REPO, 'config/sidebar-labels.yml');
      if (!fs.existsSync(file)) return {categories: {}};
      const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
      return parsed.hardware || {categories: {}};
    })();
    const existing = JSON.parse(fs.readFileSync(hardwareFile, 'utf8'));
    for (const [key, value] of Object.entries(existing)) {
      if (!key.startsWith('sidebar.hardware.category.')) continue;
      const label = value.message;
      const mapped = policy.categories?.[label] || categoryTranslation(label, null, legacy);
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
