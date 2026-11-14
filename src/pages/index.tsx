import React, {useEffect, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

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
const CHINESE_LOCALE = 'zh-Hans';
const DOCS_ENTRY = 'docs/introduction/';

type Copy = {
  heading: string;
  body: string;
  link: string;
};

const COPY: Record<'en' | 'zh-Hans', Copy> = {
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

/**
 * 只看**首选**语言（`navigator.languages[0]`），与 `<head>` 里注入的同步脚本
 * （`docusaurus.config.ts` 的 `localeRedirectScript`）判定完全一致：脚本决定
 * 「不跳」时这里也不跳，避免脚本先渲染英文、水合后又跳中文的二次闪烁。
 */
function prefersChinese(): boolean {
  if (typeof navigator === 'undefined') return false;
  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  const first = languages.filter(Boolean)[0];
  return String(first || '').toLowerCase().startsWith('zh');
}

/**
 * 目标 locale 的判断顺序（与 `<head>` 脚本、locale-detect 一致）：
 *   1. 显式选择 `docusaurus_locale`（cookie，其次 localStorage）——只有语言
 *      下拉会写它；`en` 也是有效选择，必须尊重；
 *   2. 当前页面本身的 locale（`/zh-Hans/` 根路径）优先；
 *   3. 浏览器首选语言（`navigator.languages[0]`）；
 *   4. 以上都没有 → 默认英文。
 *
 * `docusaurus_locale_auto` 只是自动跳转的“已处理”标记，不是偏好，这里不读它：
 * 站点根 `/` 本来就是入口，按浏览器语言送一次是预期行为；手选过的用户由
 * 第 1 条保护。
 */
function readStoredLocale(): string | null {
  try {
    const value = window.localStorage.getItem(COOKIE_NAME);
    return value || null;
  } catch {
    return null;
  }
}

function targetIsChinese(currentLocale: string): boolean {
  const explicit = readCookie(COOKIE_NAME) || readStoredLocale();
  if (explicit) return explicit.toLowerCase().startsWith('zh');
  if (currentLocale === CHINESE_LOCALE) return true;
  return prefersChinese();
}

/**
 * 中文站的绝对基址（不含尾斜杠），由 `docusaurus.config.ts` 的
 * `docusaurusBaseUrlMeta` 插件按 `LOCALE_ZH_URL` + `LOCALE_ZH_BASE_URL` 注入。
 * 中文站是**另一个仓库/另一个 Pages 站点**，本产物里没有 `/zh-Hans/` 目录。
 */
function readZhHome(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="docusaurus-zh-home"]');
  const value = meta?.getAttribute('content')?.trim();
  if (!value || !/^https?:\/\//i.test(value)) return null;
  return value.replace(/\/+$/, '');
}

function readSiteLocale(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="docusaurus-site-locale"]');
  return meta?.getAttribute('content')?.trim() || null;
}

function targetPath(currentLocale: string): string {
  const baseUrl = readBaseUrl();
  // 中文站自己：落地页永远进本站文档，不做跨仓跳转。只有英文站才按浏览器
  // 语言把读者送去中文站（与 locale-detect / <head> 脚本一致）。
  const siteLocale = readSiteLocale();
  if (siteLocale && siteLocale !== 'en') return `${baseUrl}${DOCS_ENTRY}`;
  if (targetIsChinese(currentLocale)) {
    const zhHome = readZhHome();
    // 跨仓入口：落到中文站自己的文档入口，而不是英文站里不存在的子目录。
    if (zhHome) return `${zhHome}/${DOCS_ENTRY}`;
    return `${baseUrl}${DOCS_ENTRY}`;
  }
  return `${baseUrl}${DOCS_ENTRY}`;
}

export default function Home(): ReactNode {
  const {i18n} = useDocusaurusContext();
  const currentLocale = i18n.currentLocale;
  const copy = COPY[currentLocale === CHINESE_LOCALE ? CHINESE_LOCALE : 'en'];

  // `useEffect` 只在浏览器里跑：SSR 与预渲染完全不碰 `window`。
  useEffect(() => {
    const target = targetPath(currentLocale);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    // 已经在目标路径上就不要再 reload 一次（防循环）。
    if (current === target) return;
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
