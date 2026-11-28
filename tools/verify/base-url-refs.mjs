#!/usr/bin/env node
/**
 * 断言构建产物里的资源型根绝对引用都落在 baseUrl 之下。
 *
 * `<Img src="/img/x.webp">` 直接透传 src 时，站点一旦部署在子路径
 * （GitHub Pages 的 `/mikrotik_manual_i18n/`），浏览器会把 `/img/x.webp`
 * 解析到域名根而 404。这个检查扫描 `build/` 下的 `.html` / `.xml`，找出
 * src、srcset、poster、og:image / twitter:image 的 content、`<link href>`
 * 以及 `<a href>` 中的内部页面路由里，以单个 `/` 开头、却不在 baseUrl
 * 之下的值。
 *
 * baseUrl 从 `docusaurus.config.ts` 读（`BASE_URL` 环境变量优先，与
 * Docusaurus 本体的取值一致）；也可以用 `--base-url=` 直接指定要验证的部署
 * 前缀。默认 baseUrl 是 `/` 时，任何根绝对引用都在 baseUrl 之下，检查对这份
 * 产物是空转的——它只有在按部署前缀构建的产物上才能暴露漏加前缀。
 *
 * 例外按**文件路径**豁免，不按 URL 前缀：`static/assets/295239801_index2.html`
 * 是抓下来的 WebFig 登录页示例，里面的 `/favicon.png`、`/assets/style.css`、
 * `/assets/script.js` 是**路由器**的根路径，不是站点资源，补 baseUrl 反而会
 * 把示例改错。默认登记这个文件（见 `DEFAULT_ALLOW_FILES`），输出里单独报
 * "allowed by file (device-root example)"；新增例外必须落在某个文件上，
 * 不能用 URL 前缀放过同类引用。唯一的 URL 前缀例外是 `ASSET_ORIGIN` 的
 * 根绝对路径（共享资源宿主）：那些引用就该落在 baseUrl 之外。
 *
 * 另有两条针对正文 `<a href>` 的断言：① 双 base 引用（`/<siteBase>/<assetOrigin>/assets/x`，
 * 即本站 baseUrl 与 hub 前缀重复）虽然以 baseUrl 开头、会被常规检查放行，却是
 * 实际 404 的来源，命中单独计数并使构建失败；② 内部页面路由（`/docs/`、
 * `/hardware/`、`/blog/`、`/changelog/` 等）的裸根绝对路径同样必须落在 baseUrl
 * 之下，否则按越界命中并使构建失败。外部链接（`https?://`、`//`）、锚点、
 * 相对路径以及非页面路由的根绝对路径跳过，避免把外链和抓取的设备页示例
 * 误报为越界；allow-file / 跨仓前缀豁免照常复用，命中阈值仍为 0。
 *
 * 分仓模式（`--multi-repo` / `--allowed-prefixes=…`）：真实部署是三仓各自独立的
 * GitHub Pages，跨站链接指向另一仓的 baseUrl 是合法的，不能按“同一 origin 下
 * 越界”判失败。开启后，从工作区 `locales.json` 推导（或由 `--allowed-prefixes`
 * 显式给出）的跨仓 baseUrl 前缀单独计入 `allowed by cross-repo prefix`，不再
 * 算越界；不加任何参数时是完全严格的单仓判定，行为与原先逐字节一致。
 *
 * `--exclude-dir=<name>`（可重复）在扫描时剪掉 `build/` 下的陈旧 locale 子树
 * （早期双语托管残留），不删除任何文件；用于彩排产物里混入别仓全量副本的情形。
 *
 * Usage:
 *   node tools/verify/base-url-refs.mjs [--build=build] [--base-url=/prefix/]
 *                                       [--allow=/path]... [--allow-file=<path>]...
 *                                       [--multi-repo] [--allowed-prefixes=/a,/b]...
 *                                       [--exclude-dir=<name>]... [--json]
 *
 * 有任何命中 exit 1，全部干净 exit 0。
 */

import fs from 'node:fs';
import path from 'node:path';

import {normalizeBaseUrl, resolveBaseUrl, resolveLocales} from '../lib/site-config.mjs';
import localeRegistry from '../content/locales.js';

/**
 * 文件级例外（相对 `build/`，可省略 locale 前缀）。
 *
 * `assets/295239801_index2.html` 是 RouterOS WebFig 登录页的抓取示例：页内
 * `/favicon.png`、`/favicon.svg`、`/assets/style.css`、`/assets/script.js`
 * 指向设备自己的根，官方文档站上也同样是 404。内容保持与抓取时逐字节一致，
 * 这里按文件登记，产物在每个 locale 树下各有一份，匹配时剥掉 locale 段。
 */
const DEFAULT_ALLOW_FILES = ['assets/295239801_index2.html'];

const TEXT_EXT = new Set(['.html', '.xml']);

// 会触发资源请求的标签，另加 <a>：正文链接既过双 base 断言，其裸内部路由也走常规越界判定。
const SCAN_TAGS = new Set([
  'img', 'source', 'video', 'audio', 'iframe', 'embed', 'input', 'track',
  'script', 'link', 'meta', 'a',
]);
const META_IMAGE_KEYS = new Set([
  'og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src',
]);
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const MAX_STORED_HITS = 5000;
const MAX_PRINTED_HITS = 20;

function usage() {
  return [
    'usage: node tools/verify/base-url-refs.mjs [--build=<dir>] [--base-url=<prefix>]',
    '                                          [--allow=<path>]... [--allow-file=<path>]...',
    '                                          [--multi-repo] [--allowed-prefixes=/a,/b]...',
    '                                          [--exclude-dir=<name>]... [--json]',
    '',
    '  --build=<dir>        default: build',
    '  --base-url=<prefix>  override the baseUrl read from docusaurus.config.ts',
    '  --allow=<path>       ignore values equal to or under this path (repeatable)',
    '  --allow-file=<path>  ignore root-absolute refs inside this build file',
    '                       (relative to <build>; repeatable). The WebFig device',
    '                       page is registered by default.',
    '  --multi-repo         split-repo mode: cross-repo baseUrl prefixes (derived',
    '                       from the workspace locales.json) are reported as allowed',
    '                       instead of counted as outside baseUrl.',
    '  --allowed-prefixes=  extra cross-repo prefixes, comma separated; repeatable.',
    '    /a,/b              Providing any prefix also enables split-repo reporting.',
    '  --exclude-dir=<name> skip a stale locale subtree directly under <build>',
    '                       while walking (repeatable); no file is deleted.',
    '  --json               machine-readable output (nothing else on stdout)',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    build: 'build',
    baseUrl: null,
    allow: [],
    allowFiles: [],
    json: false,
    multiRepo: false,
    allowedPrefixes: [],
    excludeDirs: [],
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--json') options.json = true;
    else if (arg === '--multi-repo') options.multiRepo = true;
    else if (arg.startsWith('--build=')) options.build = arg.slice('--build='.length);
    else if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length);
    else if (arg.startsWith('--allow-file=')) options.allowFiles.push(arg.slice('--allow-file='.length));
    else if (arg.startsWith('--allowed-prefixes=')) {
      for (const prefix of arg.slice('--allowed-prefixes='.length).split(',')) {
        if (prefix.trim()) options.allowedPrefixes.push(prefix.trim());
      }
    } else if (arg.startsWith('--exclude-dir=')) {
      options.excludeDirs.push(arg.slice('--exclude-dir='.length));
    } else if (arg.startsWith('--allow=')) options.allow.push(arg.slice('--allow='.length));
    else throw new Error(`unknown argument: ${arg}\n${usage()}`);
  }
  return options;
}

function normalizeAllow(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error('--allow needs a value');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** 跨仓前缀统一成 `/x/`：`x`、`/x`、`/x/` 都归并为 `/x/`。 */
function normalizePrefix(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error('--allowed-prefixes needs a value');
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
}

/**
 * 分仓模式的默认白名单：工作区 `locales.json` 登记的全部 baseUrl。
 * 三站各自独立 GitHub Pages，链接到另一仓的 baseUrl 是合法跨站链接。
 */
function deriveRepoPrefixes() {
  const registry = localeRegistry.readRegistry();
  const prefixes = new Set();
  for (const entry of Object.values(registry.locales ?? {})) {
    const base = normalizePrefix(localeRegistry.normalizeBaseUrl(entry.baseUrl));
    if (base !== '/') prefixes.add(base);
  }
  return [...prefixes].sort();
}

/** `--exclude-dir` 只按 `build/` 下第一层目录名剪枝，避免误伤深层同名目录。 */
function normalizeExcludeDir(value) {
  const trimmed = String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+$/, '');
  const first = trimmed.split('/')[0];
  if (!first) throw new Error('--exclude-dir needs a value');
  return first;
}

/** `./a/b`、`a\b`、`/a/b` 都归一成 `a/b`，便于跨平台比较。 */
function normalizeFileId(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error('--allow-file needs a value');
  return trimmed.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/{2,}/g, '/');
}

/**
 * 产物相对路径去掉 locale 段：`zh-Hans/assets/x.html` 与 `assets/x.html`
 * 是同一个 `static/` 文件的两份拷贝，豁免一个就应豁免另一个。
 */
function fileKey(rel, locales) {
  const clean = normalizeFileId(rel);
  for (const locale of locales) {
    if (clean.startsWith(`${locale}/`)) return clean.slice(locale.length + 1);
  }
  return clean;
}

function isRootAbsolute(value) {
  return value.startsWith('/') && !value.startsWith('//');
}

/** 与 Docusaurus 的 addBaseUrl 一致：`/base`（不带尾斜杠）也算 baseUrl。 */
function isUnderBaseUrl(value, baseUrl) {
  if (baseUrl === '/') return true;
  if (value === baseUrl.replace(/\/$/, '')) return true;
  return value.startsWith(baseUrl);
}

/** ASSET_ORIGIN 的路径部分：path-only 与 full URL 两种形式都接受。 */
function assetOriginPath(origin) {
  if (!origin) return null;
  if (origin.startsWith('/')) return origin.replace(/\/+$/, '') || null;
  try {
    return new URL(origin).pathname.replace(/\/+$/, '') || null;
  } catch {
    return null;
  }
}

/**
 * 双 base：`/<siteBase>/<assetOrigin>/…`。这类值以本站 baseUrl 开头，常规
 * isUnderBaseUrl 会直接放行，必须单独识别；hub 前缀只应出现一次。
 */
function isDoubleBaseRef(value, baseUrl, originPath) {
  if (baseUrl === '/' || !originPath || originPath === '/') return false;
  if (!value.startsWith(baseUrl)) return false;
  const rest = `/${value.slice(baseUrl.length)}`;
  return rest === originPath || rest.startsWith(`${originPath}/`);
}

function stripQuery(value) {
  return value.split('#')[0].split('?')[0];
}

/**
 * Docusaurus 内容路由的第一段（`routeBasePath`）：这些是本站自己的页面路径。
 * `<a href>` 只有落在这些路由上的裸根绝对路径才参与常规越界判定；外链
 * （`https?://`、`//`）、锚点、相对路径以及其它根路径（例如抓下来的 WebFig
 * 设备页示例 `/graphs`、`/license.txt`）跳过，避免误报。
 */
const INTERNAL_PAGE_SEGMENTS = new Set(['docs', 'blog', 'changelog', 'hardware']);

/**
 * 判断 `<a href>` 是否为内部页面路由的裸引用。值可能带本站 baseUrl 或跨仓
 * baseUrl 前缀，先剥掉前缀再按第一段识别路由：这样跨仓前缀仍能落入 record()
 * 的豁免分支，而不是在这里被直接跳过。
 */
function isInternalPageRoute(value, baseUrl, repoPrefixes) {
  if (!isRootAbsolute(value)) return false;
  let rest = stripQuery(value).replace(/^\/+/, '');
  for (const prefix of [baseUrl, ...repoPrefixes]) {
    const bare = prefix.replace(/^\/+|\/+$/g, '');
    if (!bare) continue;
    if (rest === bare) return false;
    if (rest.startsWith(`${bare}/`)) {
      rest = rest.slice(bare.length + 1);
      break;
    }
  }
  return INTERNAL_PAGE_SEGMENTS.has(rest.split('/')[0]);
}

function matchedAllowed(value, allowList) {
  const bare = stripQuery(value);
  return (
    allowList.find((allowed) => {
      if (bare === allowed) return true;
      return bare.startsWith(allowed.endsWith('/') ? allowed : `${allowed}/`);
    }) ?? null
  );
}

function isAllowed(value, allowList) {
  return matchedAllowed(value, allowList) !== null;
}

/** 按路径前缀分组：`/img/`、`/assets/js/`、`/blog/`…… */
function groupOf(value) {
  const segments = stripQuery(value).replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  if (segments[0] === 'assets' && segments[1]) return `/assets/${segments[1]}/`;
  return `/${segments[0]}/`;
}

/** srcset 是逗号分隔的 `url [descriptor]`；data: 值整条跳过（内含逗号）。 */
function srcsetUrls(value) {
  if (!value || /^\s*data:/i.test(value)) return [];
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function walk(root, visit, excludeDirs = new Set()) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // 只剪顶层陈旧子树；build/ 本身与其它层级不受影响。
        if (current === root && excludeDirs.has(normalizeExcludeDir(entry.name))) continue;
        stack.push(full);
      } else if (entry.isFile()) visit(full);
    }
  }
}

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line += 1;
  return line;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), options.build);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`build directory not found: ${root}`);
  }

  const fromConfig = resolveBaseUrl();
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? fromConfig.value);
  const baseUrlSource = options.baseUrl
    ? '--base-url'
    : fromConfig.source === 'BASE_URL env'
      ? 'BASE_URL env'
      : 'docusaurus.config.ts';
  const allowList = options.allow.map(normalizeAllow);
  // ASSET_ORIGIN=/repo 把共享资源引用改写成根绝对路径 /repo/...：它们刻意
  // 落在本站 baseUrl 之外（浏览器按当前 origin 去资源宿主取字节），不能被
  // 当成漏加前缀。完整 URL 形式产生的是绝对 URL，isRootAbsolute 已跳过。
  const assetOrigin = localeRegistry.normalizeAssetOrigin(process.env.ASSET_ORIGIN);
  if (assetOrigin && assetOrigin.startsWith('/')) {
    allowList.push(normalizeAllow(assetOrigin));
  }
  const originPath = assetOriginPath(assetOrigin);
  const locales = resolveLocales().locales;
  const allowFiles = [...DEFAULT_ALLOW_FILES, ...options.allowFiles].map(normalizeFileId);
  const allowFileSet = new Set(allowFiles);

  // 分仓模式：跨仓 baseUrl 前缀默认从工作区 locales.json 推导，可由
  // --allowed-prefixes 增补。单仓模式（默认、不加参数）不放开任何前缀。
  const multiRepo = options.multiRepo || options.allowedPrefixes.length > 0;
  const repoPrefixes = multiRepo
    ? [
        ...new Set([
          ...(options.multiRepo ? deriveRepoPrefixes() : []),
          ...options.allowedPrefixes.map(normalizePrefix),
        ]),
      ].sort()
    : [];
  const excludeDirs = new Set(options.excludeDirs.map(normalizeExcludeDir));

  const files = [];
  walk(
    root,
    (file) => {
      if (TEXT_EXT.has(path.extname(file).toLowerCase())) files.push(file);
    },
    excludeDirs,
  );
  files.sort();

  let refs = 0;
  let allowed = 0;
  let allowedByRepo = 0;
  const repoPrefixCounts = new Map();
  let allowedByFile = 0;
  const allowedFiles = new Map();
  const hits = [];
  let hitCount = 0;
  const groups = new Map();
  const doubleBaseHits = [];
  let doubleBaseCount = 0;

  const recordDoubleBase = (rel, content, index, tag, attribute, value) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!isRootAbsolute(trimmed)) return;
    if (!isDoubleBaseRef(trimmed, baseUrl, originPath)) return;
    doubleBaseCount += 1;
    if (doubleBaseHits.length < MAX_STORED_HITS) {
      doubleBaseHits.push({file: rel, line: lineOf(content, index), tag, attribute, value: trimmed});
    }
  };

  const record = (rel, content, index, tag, attribute, value) => {
    if (!value) return;
    refs += 1;
    const trimmed = value.trim();
    if (!isRootAbsolute(trimmed)) return;
    // 双 base 单独记账；它虽落在 baseUrl 之下，却是真实 404。
    recordDoubleBase(rel, content, index, tag, attribute, trimmed);
    if (isUnderBaseUrl(trimmed, baseUrl)) return;
    // 分仓模式：跨仓前缀单独记账，不计入 outside baseUrl。
    if (multiRepo) {
      const matched = matchedAllowed(trimmed, repoPrefixes);
      if (matched) {
        allowedByRepo += 1;
        repoPrefixCounts.set(matched, (repoPrefixCounts.get(matched) ?? 0) + 1);
        return;
      }
    }
    if (allowFileSet.has(fileKey(rel, locales))) {
      allowedByFile += 1;
      allowedFiles.set(rel, (allowedFiles.get(rel) ?? 0) + 1);
      return;
    }
    if (isAllowed(trimmed, allowList)) {
      allowed += 1;
      return;
    }
    hitCount += 1;
    const prefix = groupOf(trimmed);
    groups.set(prefix, (groups.get(prefix) ?? 0) + 1);
    if (hits.length < MAX_STORED_HITS) {
      hits.push({file: rel, line: lineOf(content, index), tag, attribute, value: trimmed});
    }
  };

  const checkAttribute = (rel, content, tagMatch, tag, attributes, attribute) => {
    const value = attributes[attribute];
    if (value === undefined) return;
    if (attribute === 'srcset') {
      for (const url of srcsetUrls(value)) record(rel, content, tagMatch.index, tag, attribute, url);
      return;
    }
    record(rel, content, tagMatch.index, tag, attribute, value);
  };

  const checkDoubleBase = (rel, content, tagMatch, tag, attributes, attribute) => {
    const value = attributes[attribute];
    if (value === undefined) return;
    if (attribute === 'srcset') {
      for (const url of srcsetUrls(value)) recordDoubleBase(rel, content, tagMatch.index, tag, attribute, url);
      return;
    }
    recordDoubleBase(rel, content, tagMatch.index, tag, attribute, value);
  };

  /**
   * `<a href>` 的常规越界判定入口：只把裸的内部页面路由交给 record()，复用其
   * allow-file / 跨仓前缀 / --allow 豁免逻辑与计数。双 base 由 checkDoubleBase
   * 独立覆盖；落在 baseUrl 下的值无越界可言，无需再记一次。
   */
  const checkAnchor = (rel, content, tagMatch, tag, attributes, attribute) => {
    const value = attributes[attribute];
    if (value === undefined) return;
    const trimmed = value.trim();
    if (!isRootAbsolute(trimmed)) return;
    if (isUnderBaseUrl(trimmed, baseUrl)) return;
    if (!isInternalPageRoute(trimmed, baseUrl, repoPrefixes)) return;
    record(rel, content, tagMatch.index, tag, attribute, trimmed);
  };

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);

    for (const tagMatch of content.matchAll(TAG_RE)) {
      const tag = tagMatch[1].toLowerCase();
      if (!SCAN_TAGS.has(tag)) continue;

      const attributes = Object.create(null);
      for (const attr of tagMatch[0].matchAll(ATTR_RE)) {
        attributes[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? '';
      }

      if (tag === 'link') {
        checkAttribute(rel, content, tagMatch, tag, attributes, 'href');
      } else if (tag === 'meta') {
        const key = (attributes.property || attributes.name || '').toLowerCase();
        if (META_IMAGE_KEYS.has(key)) checkAttribute(rel, content, tagMatch, tag, attributes, 'content');
      } else if (tag === 'a') {
        // 双 base 必须拦下；裸内部页面路由另走常规越界判定（阈值仍为 0）。
        checkDoubleBase(rel, content, tagMatch, tag, attributes, 'href');
        checkAnchor(rel, content, tagMatch, tag, attributes, 'href');
      } else {
        checkAttribute(rel, content, tagMatch, tag, attributes, 'src');
        checkAttribute(rel, content, tagMatch, tag, attributes, 'srcset');
        checkAttribute(rel, content, tagMatch, tag, attributes, 'poster');
      }
    }
  }

  const prefixes = [...groups.entries()]
    .map(([prefix, count]) => ({prefix, count}))
    .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));
  const allowedFileRows = [...allowedFiles.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const repoPrefixRows = [...repoPrefixCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const truncated = hitCount > hits.length;
  const note =
    baseUrl === '/'
      ? 'baseUrl 是 "/"（本地默认值）：任何根绝对引用都在它之下，这份产物无法暴露漏加前缀的问题。'
        + ' 用 --base-url=<部署前缀>（或 BASE_URL=<部署前缀>）验证按该前缀构建的产物。'
      : null;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          build: root,
          baseUrl,
          baseUrlSource,
          allow: allowList,
          allowFiles,
          multiRepo,
          allowedPrefixes: repoPrefixes,
          allowedByRepo: {total: allowedByRepo, prefixes: repoPrefixRows.map(([prefix, count]) => ({prefix, count}))},
          excludeDirs: [...excludeDirs].sort(),
          vacuous: baseUrl === '/',
          note,
          files: files.length,
          refs,
          allowed,
          allowedByFile: {
            total: allowedByFile,
            files: allowedFileRows.map(([file, count]) => ({file, count})),
          },
          total: hitCount,
          truncated,
          prefixes,
          hits,
          doubleBase: {total: doubleBaseCount, hits: doubleBaseHits},
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`base-url-refs: build=${root} baseUrl=${baseUrl} (${baseUrlSource})`);
    console.log(`base-url-refs: scanned ${files.length} html/xml files, ${refs} asset refs`);
    if (multiRepo) {
      console.log(
        `base-url-refs: 分仓模式 (multi-repo): allowed cross-repo prefixes = ${repoPrefixes.join(', ') || '(none)'}`,
      );
      console.log(`base-url-refs: allowed by cross-repo prefix = ${allowedByRepo}`);
      for (const [prefix, count] of repoPrefixRows) console.log(`  ${prefix}  ${count}`);
    }
    if (excludeDirs.size > 0) {
      console.log(`base-url-refs: excluded stale build subdirs from scan = ${[...excludeDirs].sort().join(', ')}`);
    }
    if (note) console.log(`base-url-refs: note: ${note}`);
    console.log(`base-url-refs: root-absolute refs outside baseUrl = ${hitCount} (allowed: ${allowed})`);
    console.log(`base-url-refs: double-base refs (site baseUrl + asset origin) = ${doubleBaseCount}`);
    if (doubleBaseHits.length > 0) {
      console.log(`base-url-refs: first ${Math.min(doubleBaseHits.length, MAX_PRINTED_HITS)} double-base hits:`);
      for (const hit of doubleBaseHits.slice(0, MAX_PRINTED_HITS)) {
        console.log(`  ${hit.file}:${hit.line}: <${hit.tag} ${hit.attribute}> ${hit.value}`);
      }
    }
    if (allowFiles.length > 0) {
      console.log(`base-url-refs: allow-file (device-root example): ${allowFiles.join(', ')}`);
      console.log(
        `base-url-refs: allowed by file (device-root example) = ${allowedByFile}`
          + ` in ${allowedFileRows.length} file(s)`,
      );
      for (const [file, count] of allowedFileRows) console.log(`  ${file}  ${count}`);
    }
    for (const {prefix, count} of prefixes) console.log(`  ${prefix}  ${count}`);
    if (hits.length > 0) {
      console.log(`base-url-refs: first ${Math.min(hits.length, MAX_PRINTED_HITS)} of ${hitCount}:`);
      for (const hit of hits.slice(0, MAX_PRINTED_HITS)) {
        console.log(`  ${hit.file}:${hit.line}: ${hit.value}`);
      }
    }
    if (truncated) console.log(`base-url-refs: (stored first ${hits.length} hits; run with --json for details)`);
  }

  if (hitCount > 0 || doubleBaseCount > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`base-url-refs: ${error.message}`);
  process.exit(1);
}
