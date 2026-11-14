#!/usr/bin/env node
/**
 * 生成 llms.txt（llmstxt.org 结构，对齐官方 manual.mikrotik.com/llms.txt）。
 *
 * 官方结构：
 *   # 标题
 *   > 一句话摘要
 *   （说明段）
 *   [Complete documentation corpus](绝对 URL)
 *   ## 分类
 *   - [标题](绝对 URL.md): 描述
 *
 * 与官方一致：链接指向每页的 Markdown 副本（`generateMarkdownFiles` 产物），
 * 分类按文档一级目录。语种来自 `docusaurus.config.ts` 的 `i18n.locales`：
 * 默认语种输出到 `build/`，其余每个语种一份，标题/描述取其 overlay，
 * URL 带 `/<locale>/` 前缀。
 *
 * `llms-full.txt` 的链接必须指向插件**实际写出**的位置（这是 404 的成因）：
 * 当前版本由插件的 `current` 版本（`path: ''`）写在站点根，
 *   build/llms-full.txt、build/zh-Hans/llms-full.txt；
 * 归档版本写在各自的 `docs/<version>/`：
 *   build/docs/<v>/llms-full.txt、build/<locale>/docs/<v>/llms-full.txt。
 * 不要用路由前缀（`docs/`）去拼当前版本的全文链接。
 * 不再输出 `-----------` 之类的分隔线。
 *
 *   node tools/build/llms.mjs                 # 写 build/ 下的全部 llms.txt
 *   node tools/build/llms.mjs --out /tmp/x    # 写到别处（验证用）
 *   node tools/build/llms.mjs --json          # 输出统计
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeBaseUrl, normalizeSiteUrl, resolveBaseUrl, resolveLocales, resolveSiteUrl} from '../lib/site-config.mjs';
import {overlayRootFor} from '../translate/lib/paths.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT = outArg >= 0 && args[outArg + 1] ? path.resolve(args[outArg + 1]) : path.join(REPO, 'build');
const asJson = args.includes('--json');

// 与 docusaurus.config.ts 同源（环境变量优先），不维护第二套 fallback。
const SITE_URL = normalizeSiteUrl(resolveSiteUrl().value);
const BASE_URL = normalizeBaseUrl(resolveBaseUrl().value);
const abs = (routePath) => `${SITE_URL}${BASE_URL}${routePath.replace(/^\/+/, '')}`;

const currentVersion = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO, 'data/manifests/current-version.json'), 'utf8')).version;
  } catch {
    return 'current';
  }
})();

const versionedDocs = fs.existsSync(path.join(REPO, 'versioned_docs'))
  ? fs
      .readdirSync(path.join(REPO, 'versioned_docs'), {withFileTypes: true})
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('version-'))
      .map((entry) => entry.name.replace(/^version-/, ''))
      .sort((a, b) => {
        const aa = a.split('.').map(Number);
        const bb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
          const d = (aa[i] ?? 0) - (bb[i] ?? 0);
          if (d) return d;
        }
        return a.localeCompare(b);
      })
  : [];

/** 分类标签：优先取 sidebars.ts 顶层的 label，取不到就用人读化的目录名。 */
function topLevelLabels() {
  const labels = new Map();
  let sidebarName = 'docs';
  const humanize = (segment) =>
    segment
      .split('-')
      .map((word) => (word === 'cli' ? 'CLI' : word.charAt(0).toUpperCase() + word.slice(1)))
      .join(' ');
  try {
    const text = fs.readFileSync(path.join(REPO, 'sidebars.ts'), 'utf8');
    // sidebars.ts 是生成文件：`const sidebars: SidebarsConfig = { ... };`
    // 中间就是一个 JSON 对象（键名和字符串都有引号）。从 `= {` 起、
    // 到最后一个 `};` 止，避免把文件开头的注释或类型里的花括号算进来。
    const eq = text.indexOf('= {');
    const end = text.lastIndexOf('};');
    const tree = JSON.parse(text.slice(eq + 2, end + 1));
    sidebarName = Object.keys(tree)[0] || sidebarName;
    const walk = (items) => {
      for (const item of items || []) {
        if (item.type === 'category') {
          const target = item.link?.id || firstDocId(item.items) || '';
          const segment = target.split('/')[0];
          if (segment && !labels.has(segment)) labels.set(segment, item.label);
          walk(item.items);
        }
      }
    };
    walk(tree[sidebarName]);
  } catch {
    // sidebars.ts 结构变了也不要让生成失败：下面按目录名兜底。
  }
  return {labels, humanize, sidebarName};
}

/**
 * 侧边栏分类标签的翻译覆盖。
 *
 * Docusaurus 构建时用 `i18n/<locale>/docusaurus-plugin-content-docs/<slot>.json`
 * 里的 `sidebar.<sidebar>.<type>.<key>` 替换 `sidebars.ts` 的英文 label；
 * `llms.txt` 的分类标题直接读 `sidebars.ts`，所以翻译语种必须优先查这份
 * 映射，否则索引正文是中文、分类标题仍是英文。
 */
function sidebarTranslations(locale, slot) {
  if (!locale) return {};
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(REPO, 'i18n', locale, 'docusaurus-plugin-content-docs', slot),
        'utf8',
      ),
    );
  } catch {
    return {};
  }
}

function firstDocId(items) {
  for (const item of items || []) {
    if (item.type === 'doc') return item.id;
    if (item.type === 'category') {
      const nested = item.link?.id || firstDocId(item.items);
      if (nested) return nested;
    }
  }
  return '';
}

const {labels, humanize, sidebarName} = topLevelLabels();

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** 极简 front matter：只要 title / description，够用且不引依赖。 */
function frontMatter(text) {
  const data = {};
  if (!text.startsWith('---')) return data;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return data;
  for (const line of text.slice(3, end).split('\n')) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    // YAML 单引号里的转义是 ''，去掉外层引号后要还原成一个 '。
    data[match[1]] = match[2]
      .trim()
      .replace(/^'(.*)'$/, '$1')
      .replace(/^"(.*)"$/, '$1')
      .replace(/''/g, "'");
  }
  data.__body = text.slice(end + 4);
  return data;
}

function firstParagraph(body) {
  for (const block of (body || '').split(/\n\s*\n/)) {
    const plain = block
      .replace(/^#+\s.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?[A-Za-z][^>]*>/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (plain.length >= 40) return plain;
  }
  return '';
}

const clip = (value, max = 240) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

function pageInfo(file, rootDir, overlayRoot) {
  const rel = path.relative(rootDir, file).split(path.sep).join('/');
  const relId = rel.replace(/\.md$/, '').replace(/\/index$/, '');
  const overlay = overlayRoot ? path.join(overlayRoot, rel) : null;
  const overlayText =
    overlay && fs.existsSync(overlay) ? fs.readFileSync(overlay, 'utf8') : null;
  const base = frontMatter(fs.readFileSync(file, 'utf8'));
  // The source locale has no overlay (`overlayRoot` is null), so `localized` is
  // empty there and every field falls back to the English page. A translated
  // locale prefers its overlay's title/description, then the English ones.
  const localized = overlayText ? frontMatter(overlayText) : {};
  const title =
    localized.title ||
    base.title ||
    (localized.__body.match(/^#\s+(.+)$/m) || [])[1] ||
    (base.__body.match(/^#\s+(.+)$/m) || [])[1] ||
    relId.split('/').pop();
  const description =
    clip(localized.description || base.description) ||
    clip(firstParagraph(overlayText ? localized.__body : base.__body));
  return {relId, title: title.trim(), description};
}

/**
 * 分类归属：一级目录 a/b.md 归到 a；根目录的 section 落地页 a.md（存在同名
 * 目录 a/）也归到 a，与官方 llms.txt 把 section 首页放在该 section 顶部一致；
 * 其余根目录单页（introduction）归「概览」。
 */
function sectionFor(relId, sectionDirs) {
  if (relId.includes('/')) return relId.split('/')[0];
  return sectionDirs.has(relId) ? relId : '__overview__';
}

/**
 * 每种语种的 llms.txt 文案。新增语种没写条目时退回英文文案（URL 前缀仍按语种），
 * 这样少了翻译不会让 `llms:build` 失败。
 */
const INDEX_TEXT = {
  en: {
    title: '# MikroTik RouterOS Documentation',
    summary:
      '> MikroTik RouterOS documentation: configuration reference, CLI reference, and user guides.',
    note: (versionLabel) =>
      `Index of the RouterOS ${versionLabel} manual, in documentation menu order. Links open Markdown copies of the pages.`,
    corpus: 'Complete documentation corpus',
    overview: 'Overview',
  },
  'zh-Hans': {
    title: '# MikroTik RouterOS 文档',
    summary: '> MikroTik RouterOS 官方文档：配置参考、CLI 参考与使用指南（简体中文镜像）。',
    note: (versionLabel) =>
      `RouterOS ${versionLabel} 手册索引，按文档目录顺序排列。链接指向页面的 Markdown 副本。`,
    corpus: '完整文档语料',
    overview: '概览',
  },
};

function buildLocale({
  locale,
  docsRoot,
  routePrefix,
  llmsFullPath,
  overlayRoot,
  versionLabel,
  defaultLocale,
  singleLocaleBuild,
  sidebarName,
  translationSlot,
}) {
  const entries = listMarkdown(docsRoot).map((file) => pageInfo(file, docsRoot, overlayRoot));
  const sectionDirs = new Set(
    entries.filter((entry) => entry.relId.includes('/')).map((entry) => entry.relId.split('/')[0]),
  );
  // 一级目录顺序：sidebars 里出现过的按出现顺序，其余按名称；单页（概览）在最前。
  const order = [...labels.keys()];
  const groups = new Map();
  for (const entry of entries) {
    const key = sectionFor(entry.relId, sectionDirs);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === '__overview__') return -1;
    if (b === '__overview__') return 1;
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== ib) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    return a.localeCompare(b);
  });

  // 翻译语种优先用 sidebars 的翻译覆盖；取不到再退回 sidebars.ts 的英文
  // label / 目录名，未翻译的分类不会因此消失。
  const translations = sidebarTranslations(locale, translationSlot);
  const localizedLabel = (key) => {
    for (const type of ['category', 'doc']) {
      const entry = translations[`sidebar.${sidebarName}.${type}.${key}`];
      if (entry?.message) return entry.message;
    }
    return null;
  };

  const text = INDEX_TEXT[locale] || INDEX_TEXT[defaultLocale] || INDEX_TEXT.en;
  // `docusaurus build --locale <X>` 把该语种写到 `build/` 根（`tools/build/
  // index.mjs` 的单语种模式），没有 `/<locale>/` 路由前缀；只有同仓双语构建
  // 才会把非默认语种放在 `/<locale>/` 下。跨仓镜像站（英文仓 / 中文仓各建
  // 一个语种）属于前一种，URL 直接落在本站 baseUrl 下。
  const prefix = singleLocaleBuild || locale === defaultLocale ? '' : `${locale}/`;
  // The corpus file is written by the plugin next to this llms.txt, not at a
  // route: current lives at the site/locale root, archives under docs/<v>/.
  const corpusUrl = abs(`${prefix}${llmsFullPath}`);
  const lines = [text.title, '', text.summary, '', text.note(versionLabel), '', `[${text.corpus}](${corpusUrl})`, ''];

  for (const key of keys) {
    const heading =
      key === '__overview__'
        ? text.overview
        : localizedLabel(key) || labels.get(key) || humanize(key);
    lines.push(`## ${heading}`, '');
    const sorted = groups.get(key).sort((a, b) => {
      // section 落地页（relId 与分类同名）排在最前，其余按路径。
      const aLanding = a.relId === key ? 0 : 1;
      const bLanding = b.relId === key ? 0 : 1;
      if (aLanding !== bLanding) return aLanding - bLanding;
      return a.relId.localeCompare(b.relId);
    });
    for (const entry of sorted) {
      const url = abs(`${prefix}${routePrefix}${entry.relId}.md`);
      const desc = entry.description ? `: ${entry.description}` : '';
      lines.push(`- [${entry.title}](${url})${desc}`);
    }
    lines.push('');
  }
  return {text: `${lines.join('\n').replace(/\n+$/, '')}\n`, count: entries.length, groups: keys.length};
}

// 语种来自 `docusaurus.config.ts`（`i18n.locales`），这里不再维护第二份清单：
// 新增语种只改配置。
const {locales, defaultLocale} = resolveLocales();

/**
 * 只给**已构建**的语种写 llms.txt。
 *
 * `SITE_LOCALE=en`（本仓库的常态）时 Docusaurus 只建英文产物；若这里仍按
 * `i18n.locales` 跑两种，就会在 `build/zh-Hans/` 下凭空造出中文站的目录，
 * `tools/build/slim.mjs` 和 `verify` 随后会把产物当成双语站处理，验收
 * （"产物不含 build/zh-Hans"）也会失败。`--locale` 优先于环境变量。
 */
const requestedLocale = (() => {
  const inline = args.find((arg) => arg.startsWith('--locale='));
  if (inline) return inline.slice('--locale='.length).trim();
  const index = args.indexOf('--locale');
  if (index >= 0 && args[index + 1]) return String(args[index + 1]).trim();
  return (process.env.SITE_LOCALE || '').trim();
})();
const builtLocales = requestedLocale
  ? locales.filter((locale) => locale === requestedLocale)
  : locales;
if (requestedLocale && builtLocales.length === 0) {
  throw new Error(
    `SITE_LOCALE/--locale "${requestedLocale}" is not declared in i18n.locales (${locales.join(', ')})`,
  );
}

/**
 * 文档树 + 路由前缀；`section` 是 `SECTIONS` 里的名字，用来按约定解析
 * `i18n/<locale>/<plugin>/...` 这个 overlay 根。
 */
const scopes = [
  {
    docsRoot: path.join(REPO, 'docs'),
    section: 'docs',
    routePrefix: 'docs/',
    // The plugin's `current` version uses `path: ''`, so its full text is the
    // site-root one, not `docs/llms-full.txt`.
    llmsFullPath: 'llms-full.txt',
    versionLabel: currentVersion,
    // 当前文档的侧边栏翻译槽位（Docusaurus 把 sidebars 标签抽出到这里）。
    translationSlot: 'current.json',
    outRoot: OUT,
    versionOut: null,
  },
  ...versionedDocs.map((version) => ({
    docsRoot: path.join(REPO, `versioned_docs/version-${version}`),
    section: `docs-${version}`,
    routePrefix: `docs/${version}/`,
    llmsFullPath: `docs/${version}/llms-full.txt`,
    versionLabel: version,
    translationSlot: `version-${version}.json`,
    outRoot: path.join(OUT, 'docs', version),
    versionOut: version,
  })),
];

// 顺序保持「先当前版本、再每个归档版本；每个 scope 内按配置顺序列语种」，
// 让既有产物的生成顺序不变。
const targets = scopes.flatMap((scope) =>
  builtLocales.map((locale) => {
    const isDefault = locale === defaultLocale;
    // 单语种构建（`SITE_LOCALE`/`--locale`）：产物就是 `build/` 本身，没有
    // `build/<locale>/` 这一层；被构建的语种即使不是 `defaultLocale`，也写在
    // 站点根。同仓双语构建仍按语种子目录写。
    const atSiteRoot = Boolean(requestedLocale) || isDefault;
    return {
      locale,
      defaultLocale,
      docsRoot: scope.docsRoot,
      overlayRoot: isDefault ? null : path.join(REPO, overlayRootFor(locale, scope.section)),
      routePrefix: scope.routePrefix,
      llmsFullPath: scope.llmsFullPath,
      versionLabel: scope.versionLabel,
      singleLocaleBuild: Boolean(requestedLocale),
      sidebarName,
      translationSlot: scope.translationSlot,
      outDir: atSiteRoot
        ? scope.outRoot
        : path.join(OUT, locale, scope.versionOut ? `docs/${scope.versionOut}` : ''),
    };
  }),
);

const written = [];
for (const target of targets) {
  const {text, count, groups} = buildLocale(target);
  fs.mkdirSync(target.outDir, {recursive: true});
  const file = path.join(target.outDir, 'llms.txt');
  fs.writeFileSync(file, text);
  written.push({
    file: path.relative(REPO, file),
    version: target.versionLabel,
    locale: target.locale,
    pages: count,
    groups,
  });
}

if (asJson) {
  console.log(JSON.stringify({written}, null, 2));
} else {
  for (const item of written) {
    console.log(`${item.file}  (${item.locale} ${item.version}, ${item.pages} 页, ${item.groups} 个分类)`);
  }
}
