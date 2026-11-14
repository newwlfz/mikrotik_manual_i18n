#!/usr/bin/env node
/**
 * `siteUrl` / `baseUrl` 的唯一解析入口：构建脚本与产物断言共用。
 *
 * 取值必须和 Docusaurus 本体一致：读 `docusaurus.config.ts` 里
 * `const siteUrl = ...` / `const baseUrl = ...` 的赋值表达式，`SITE_URL` /
 * `BASE_URL` 环境变量优先，否则用表达式里的字面量 fallback。这样本地构建、
 * llms.txt 的绝对 URL、静态服务器和产物断言都走同一份取值，不会再出现第二套
 * fallback 各自漂移。
 *
 * 注意：`docusaurus.config.ts` 的两个赋值必须保持内联字面量
 * （`process.env.BASE_URL || '/prefix/'`）——本模块用正则解析该表达式；
 * 抽成常量会让解析失败。
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONFIG_FILE = path.join(REPO, 'docusaurus.config.ts');

function configSource() {
  return fs.readFileSync(CONFIG_FILE, 'utf8');
}

function assignmentOf(source, name) {
  const match = source.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

function resolveExpression(name, expression, envName) {
  if (!expression) throw new Error(`cannot find ${name} in docusaurus.config.ts`);
  if (new RegExp(`process\\.env\\.${envName}`).test(expression)) {
    if (process.env[envName]) return {value: process.env[envName], source: `${envName} env`};
    const fallback = expression.match(/['"]([^'"]*)['"]/);
    if (fallback) return {value: fallback[1], source: 'docusaurus.config.ts'};
    throw new Error(`cannot resolve ${name} expression: ${expression}`);
  }
  const literal = expression.match(/^['"]([^'"]*)['"]$/);
  if (literal) return {value: literal[1], source: 'docusaurus.config.ts'};
  throw new Error(`cannot resolve ${name} expression: ${expression}`);
}

/**
 * 站点启用的语种与默认语种，唯一事实源是 `docusaurus.config.ts`。
 *
 * 镜像不保留第二份语种清单：`config/mirror.yml` 曾经有一份 `locales:`，但没有任何
 * 脚本读它，删掉之后所有脚本（translate / build / verify）都从这里取。
 *
 * 依赖配置文件里两个内联字面量：`locales: ['en', 'zh-Hans']` 与
 * `defaultLocale: 'en'`（抽成变量会让正则解析失败，和上面 siteUrl/baseUrl 的约定
 * 一致）。
 */
let localesCache = null;
export function resolveLocales() {
  if (localesCache) return localesCache;
  const source = configSource();
  const list = source.match(/\blocales\s*:\s*\[([\s\S]*?)\]/);
  if (!list) throw new Error('cannot find i18n.locales in docusaurus.config.ts');
  const locales = [...list[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (locales.length === 0) throw new Error('i18n.locales in docusaurus.config.ts is empty');
  const field = source.match(/\bdefaultLocale\s*:\s*['"]([^'"]+)['"]/);
  const defaultLocale = field ? field[1] : locales[0];
  if (!locales.includes(defaultLocale)) {
    throw new Error(
      `i18n.defaultLocale "${defaultLocale}" is not in i18n.locales (${locales.join(', ')})`,
    );
  }
  localesCache = {locales, defaultLocale};
  return localesCache;
}

/** 测试里改配置后重读；正常运行不需要调用。 */
export function resetLocalesCache() {
  localesCache = null;
}

/** baseUrl 及其来源（`BASE_URL env` / `docusaurus.config.ts`）。 */
export function resolveBaseUrl() {
  const source = configSource();
  const field = source.match(/^\s*baseUrl\s*:\s*(['"])([^'"]+)\1\s*,?\s*$/m);
  if (field) return {value: field[2], source: 'docusaurus.config.ts'};
  return resolveExpression('baseUrl', assignmentOf(source, 'baseUrl'), 'BASE_URL');
}

/** siteUrl 及其来源（`SITE_URL env` / `docusaurus.config.ts`）。 */
export function resolveSiteUrl() {
  return resolveExpression('siteUrl', assignmentOf(configSource(), 'siteUrl'), 'SITE_URL');
}

/** 与 Docusaurus 一致：非空 baseUrl 以 `/` 开头、以 `/` 结尾；空值即 `/`。 */
export function normalizeBaseUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === '/') return '/';
  const leading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return leading.endsWith('/') ? leading : `${leading}/`;
}

/** siteUrl 不带尾斜杠，便于拼绝对 URL。 */
export function normalizeSiteUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error('siteUrl is empty');
  return trimmed.replace(/\/+$/, '');
}
