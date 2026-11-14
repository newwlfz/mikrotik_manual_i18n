#!/usr/bin/env node
/**
 * 断言构建产物里的资源型根绝对引用都落在 baseUrl 之下。
 *
 * `<Img src="/img/x.webp">` 直接透传 src 时，站点一旦部署在子路径
 * （GitHub Pages 的 `/mikrotik_manual_i18n/`），浏览器会把 `/img/x.webp`
 * 解析到域名根而 404。这个检查扫描 `build/` 下的 `.html` / `.xml`，找出
 * src、srcset、poster、og:image / twitter:image 的 content 以及 `<link href>`
 * 里以单个 `/` 开头、却不在 baseUrl 之下的值。
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
 * 不能用 URL 前缀放过同类引用。
 *
 * Usage:
 *   node tools/verify/base-url-refs.mjs [--build=build] [--base-url=/prefix/]
 *                                       [--allow=/path]... [--allow-file=<path>]...
 *                                       [--json]
 *
 * 有任何命中 exit 1，全部干净 exit 0。
 */

import fs from 'node:fs';
import path from 'node:path';

import {normalizeBaseUrl, resolveBaseUrl, resolveLocales} from '../lib/site-config.mjs';

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

// 只看会触发资源请求的标签：正文里的 <a href> 是页面链接，不在此列。
const SCAN_TAGS = new Set([
  'img', 'source', 'video', 'audio', 'iframe', 'embed', 'input', 'track',
  'script', 'link', 'meta',
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
    '                                          [--json]',
    '',
    '  --build=<dir>        default: build',
    '  --base-url=<prefix>  override the baseUrl read from docusaurus.config.ts',
    '  --allow=<path>       ignore values equal to or under this path (repeatable)',
    '  --allow-file=<path>  ignore root-absolute refs inside this build file',
    '                       (relative to <build>; repeatable). The WebFig device',
    '                       page is registered by default.',
    '  --json               machine-readable output (nothing else on stdout)',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {build: 'build', baseUrl: null, allow: [], allowFiles: [], json: false};
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--json') options.json = true;
    else if (arg.startsWith('--build=')) options.build = arg.slice('--build='.length);
    else if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length);
    else if (arg.startsWith('--allow-file=')) options.allowFiles.push(arg.slice('--allow-file='.length));
    else if (arg.startsWith('--allow=')) options.allow.push(arg.slice('--allow='.length));
    else throw new Error(`unknown argument: ${arg}\n${usage()}`);
  }
  return options;
}

function normalizeAllow(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error('--allow needs a value');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
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

function stripQuery(value) {
  return value.split('#')[0].split('?')[0];
}

function isAllowed(value, allowList) {
  const bare = stripQuery(value);
  return allowList.some((allowed) => {
    if (bare === allowed) return true;
    return bare.startsWith(allowed.endsWith('/') ? allowed : `${allowed}/`);
  });
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

function walk(root, visit) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) visit(full);
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
  const locales = resolveLocales().locales;
  const allowFiles = [...DEFAULT_ALLOW_FILES, ...options.allowFiles].map(normalizeFileId);
  const allowFileSet = new Set(allowFiles);

  const files = [];
  walk(root, (file) => {
    if (TEXT_EXT.has(path.extname(file).toLowerCase())) files.push(file);
  });
  files.sort();

  let refs = 0;
  let allowed = 0;
  let allowedByFile = 0;
  const allowedFiles = new Map();
  const hits = [];
  let hitCount = 0;
  const groups = new Map();

  const record = (rel, content, index, tag, attribute, value) => {
    if (!value) return;
    refs += 1;
    const trimmed = value.trim();
    if (!isRootAbsolute(trimmed)) return;
    if (isUnderBaseUrl(trimmed, baseUrl)) return;
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
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`base-url-refs: build=${root} baseUrl=${baseUrl} (${baseUrlSource})`);
    console.log(`base-url-refs: scanned ${files.length} html/xml files, ${refs} asset refs`);
    if (note) console.log(`base-url-refs: note: ${note}`);
    console.log(`base-url-refs: root-absolute refs outside baseUrl = ${hitCount} (allowed: ${allowed})`);
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

  if (hitCount > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`base-url-refs: ${error.message}`);
  process.exit(1);
}
