import React, {useEffect, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {markLocaleRedirecting, markLocaleSettled} from '../lib/locale-signal';

/**
 * 站点根路径的落地页。
 *
 * 以前是 `<Redirect to="/docs/introduction" />`：预渲染出来几乎是个空壳，
 * 而且硬编码英文路径，中文用户/项目站点（`baseUrl` 不是 `/`）都会跳错。
 *
 * 现在拆成两段：
 *   1. 预渲染的兜底内容：一段说明 + 指向介绍页的 `<Link>`，禁掉 JS 也能用；
 *   2. 水合后用 `window.location.replace()` 做整页跳转，SSR 阶段不碰
 *      `window`，所以不会出现「服务端和客户端输出不一致」。
 *
 * 目标路径与 `src/clientModules/locale-detect.js` 保持同一套判断，避免两者
 * 互相打架：同一个显式选择键 `docusaurus_locale`（cookie + localStorage，
 * 只由语言下拉写入）、同一套 `navigator.languages` 规则，并且落到
 * `${baseUrl}docs/introduction/`（或中文树）之后，locale-detect 看到路径已是
 * 目标 locale 就只补写自动标记、不再跳转。
 */

const COOKIE_NAME = 'docusaurus_locale';
const DOCS_ENTRY = 'docs/introduction/';

type Copy = {
  heading: string;
  body: string;
  link: string;
};

const COPY: Record<'en' | 'zh-Hans' | 'zh-Hant', Copy> = {
  en: {
    heading: 'RouterOS Manual',
    body: 'Opening the documentation introduction. If the page does not move on its own, follow the link below.',
    link: 'Go to the introduction',
  },
  'zh-Hans': {
    heading: 'RouterOS 手册',
    body: '正在打开文档简介页。如果没有自动跳转，请点下面的链接。',
    link: '前往简介',
  },
  'zh-Hant': {
    heading: 'RouterOS 手冊',
    body: '正在開啟文件簡介頁。如果沒有自動跳轉，請點下面的連結。',
    link: '前往簡介',
  },
};

/** 与 locale-detect 的 `normalizeBaseUrl` 同义：保证首尾都有 `/`。 */
function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/**
 * 构建期由 `docusaurus.config.ts` 的 `docusaurusBaseUrlMeta` 插件注入。
 * 取不到（旧构建产物、嵌入式副本）时退回 `/`，与 locale-detect 一致。
 */
function readBaseUrl(): string {
  if (typeof document === 'undefined') return '/';
  const meta = document.querySelector('meta[name="docusaurus-base-url"]');
  return normalizeBaseUrl(meta?.getAttribute('content') || '/');
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!entry) return null;
  const value = entry.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 显式选择（语言下拉写入 localStorage；cookie 由 `readCookie` 读）。 */
function readStoredLocale(): string | null {
  try {
    const value = window.localStorage.getItem(COOKIE_NAME);
    return value || null;
  } catch {
    return null;
  }
}

/** 首选语言；与 `<head>` 脚本、locale-detect 都只看这一项。 */
function preferredLanguage(): string {
  if (typeof navigator === 'undefined') return '';
  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  return String(languages.filter(Boolean)[0] || '');
}

/**
 * 目标语种：显式选择优先，其次浏览器首选语言；规则表与站点地址来自构建期
 * 注入的 `<meta>`（与 `<head>` 脚本、locale-detect 同源）。
 */
function pickTarget(): string | null {
  const explicit = readCookie(COOKIE_NAME) || readStoredLocale();
  const rules = readJsonMeta('docusaurus-zh-rules');
  const homes = readLocaleHomes();
  if (!rules || !homes) return null;
  const languages = explicit ? [explicit] : [preferredLanguage()];
  const tag = String(languages[0] || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (!tag || !tag.startsWith('zh')) return explicit ? explicit : null;
  let mapped = rules[tag];
  if (!mapped) {
    const parts = tag.split('-').filter(Boolean);
    for (let i = 1; i < parts.length && !mapped; i += 1) mapped = rules[parts[i]];
  }
  if (!mapped && tag === 'zh') mapped = rules.zh;
  if (!mapped) return null;
  const defaultZh = homes['zh-Hans']
    ? 'zh-Hans'
    : Object.keys(homes).find((locale) => locale.startsWith('zh')) || null;
  const target = mapped === 'default' ? defaultZh : mapped;
  return target && homes[target] ? target : null;
}

/** 构建期注入的 JSON `<meta>`；取不到时返回 `null`。 */
function readJsonMeta(name: string): Record<string, string> | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector(`meta[name="${name}"]`);
  const value = meta?.getAttribute('content')?.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** 语种 → 绝对基址（不含尾斜杠），来自 `<meta name="docusaurus-locale-homes">`。 */
function readLocaleHomes(): Record<string, string> {
  const homes = readJsonMeta('docusaurus-locale-homes');
  if (!homes) return {};
  const absolute: Record<string, string> = {};
  for (const [locale, home] of Object.entries(homes)) {
    const value = String(home || '')
      .trim()
      .replace(/\/+$/, '');
    if (/^https?:\/\//i.test(value)) absolute[locale] = value;
  }
  return absolute;
}

function readSiteLocale(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="docusaurus-site-locale"]');
  return meta?.getAttribute('content')?.trim() || null;
}

function targetPath(): string {
  const baseUrl = readBaseUrl();
  // 中文站自己：落地页永远进本站文档，不做跨仓跳转。只有英文站才按浏览器
  // 语言把读者送去对应语种的中文站（与 locale-detect / <head> 脚本一致）。
  const siteLocale = readSiteLocale();
  if (siteLocale && siteLocale !== 'en') return `${baseUrl}${DOCS_ENTRY}`;
  const target = pickTarget();
  const homes = readLocaleHomes();
  // 跨仓入口：落到目标语种站自己的文档入口，而不是英文站里不存在的子目录。
  if (target && homes[target]) return `${homes[target]}/${DOCS_ENTRY}`;
  return `${baseUrl}${DOCS_ENTRY}`;
}

export default function Home(): ReactNode {
  const {i18n} = useDocusaurusContext();
  const currentLocale = i18n.currentLocale;
  const copyKey = currentLocale.startsWith('zh')
    ? (currentLocale === 'zh-Hant' ? 'zh-Hant' : 'zh-Hans')
    : 'en';
  const copy = COPY[copyKey];

  // `useEffect` 只在浏览器里跑：SSR 与预渲染完全不碰 `window`。
  useEffect(() => {
    const target = targetPath();
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    // 已经在目标路径上就不要再 reload 一次（防循环）。
    if (current === target) {
      markLocaleSettled();
      return;
    }
    // 这次是整页 replace（可能跨站换语种），目标页会重新挂载版权框：先在本页
    // 把版权框按住，读者只会看到一次，而不是「弹 → 跳 → 再弹」。
    markLocaleRedirecting();
    // `replace` 不进历史栈：后退不会回到这个中转页。
    window.location.replace(target);
  }, [currentLocale]);

  return (
    <Layout>
      <main className="container margin-vert--lg">
        <h1>{copy.heading}</h1>
        <p>{copy.body}</p>
        <p>
          {/* Docusaurus 的 Link 会按 baseUrl / 当前 locale 补全前缀。 */}
          <Link to={`/${DOCS_ENTRY}`}>{copy.link}</Link>
        </p>
      </main>
    </Layout>
  );
}
