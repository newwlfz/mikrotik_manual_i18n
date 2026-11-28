#!/usr/bin/env node
/**
 * `siteUrl` / `baseUrl` / 语种清单的唯一解析入口：构建脚本与产物断言共用。
 *
 * 事实源是仓库根的 `locales.json`（见 `tools/content/locales.js`）：
 *
 *   - `resolveBaseUrl()` 取本次构建语种（`SITE_LOCALE`，缺省为 default）的
 *     `baseUrl`，`BASE_URL` 环境变量优先；
 *   - `resolveSiteUrl()` 取该语种 `site` 的 origin，`SITE_URL` 环境变量优先；
 *   - `resolveLocales()` 返回 `locales.json` 的语种清单与 default。
 *
 * 这与 `docusaurus.config.ts` 走同一份 `resolveSites()`，所以本地构建、llms.txt
 * 的绝对 URL、瘦身脚本和产物断言不会再各自维护一套 fallback 而漂移。
 *
 * 注意：语种地址不再从 `docusaurus.config.ts` 的赋值表达式里正则解析——配置
 * 文件现在也从 `locales.json` 生成，两处解析会互相耦合。需要新语种时改
 * `locales.json`，然后跑 `npm run locales:check`。
 */

import path from 'node:path';
import {fileURLToPath} from 'node:url';

import localeRegistry from '../content/locales.js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LOCALES_FILE = path.join(REPO, localeRegistry.FILE_NAME);

/** 与 Docusaurus 一致：非空 baseUrl 以 `/` 开头、以 `/` 结尾；空值即 `/`。 */
export const normalizeBaseUrl = localeRegistry.normalizeBaseUrl;

/** siteUrl 不带尾斜杠，便于拼绝对 URL。 */
export const normalizeSiteUrl = localeRegistry.normalizeSiteUrl;

let localesCache = null;

/**
 * 站点启用的语种与默认语种，唯一事实源是 `locales.json`。
 *
 * 镜像不保留第二份语种清单：`config/mirror.yml` 曾经有一份 `locales:`，但没有
 * 任何脚本读它；现在 `docusaurus.config.ts`、构建/断言脚本和
 * `tools/content/publish.mjs` 都从这里取值。
 */
export function resolveLocales() {
  if (localesCache) return localesCache;
  const registry = localeRegistry.readRegistry();
  const errors = localeRegistry.validateRegistry(registry);
  if (errors.length > 0) {
    throw new Error(`locales.json is invalid:\n  - ${errors.join('\n  - ')}`);
  }
  localesCache = {locales: Object.keys(registry.locales), defaultLocale: registry.default};
  return localesCache;
}

/** 测试里改配置后重读；正常运行不需要调用。 */
export function resetLocalesCache() {
  localesCache = null;
}

/** 本次构建的语种；未设置 `SITE_LOCALE` 时是登记表的 default。 */
function siteLocaleForBuild() {
  return (process.env.SITE_LOCALE || '').trim() || resolveLocales().defaultLocale;
}

/** 语种条目；未知语种回落到 default（构建期 Docusaurus 会先报错）。 */
function localeEntry(locale) {
  const registry = localeRegistry.readRegistry();
  return registry.locales[locale] ?? registry.locales[registry.default];
}

/** baseUrl 及其来源（`BASE_URL env` / `locales.json`）。 */
export function resolveBaseUrl() {
  if (process.env.BASE_URL) {
    return {value: normalizeBaseUrl(process.env.BASE_URL), source: 'BASE_URL env'};
  }
  return {
    value: normalizeBaseUrl(localeEntry(siteLocaleForBuild()).baseUrl),
    source: 'locales.json',
  };
}

/** siteUrl 及其来源（`SITE_URL env` / `locales.json`）。 */
export function resolveSiteUrl() {
  if (process.env.SITE_URL) {
    return {value: normalizeSiteUrl(process.env.SITE_URL), source: 'SITE_URL env'};
  }
  return {
    value: localeRegistry.siteOrigin(localeEntry(siteLocaleForBuild())),
    source: 'locales.json',
  };
}
