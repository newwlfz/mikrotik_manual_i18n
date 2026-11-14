/**
 * Send a first-time visitor whose browser prefers Chinese to the zh-Hans tree.
 *
 * Docusaurus localizes under `baseUrl + locale + path` (for a GitHub Pages
 * project site: `/mikrotik_manual_i18n/zh-Hans/docs/...`). The old code
 * prefixed `/zh-Hans` straight onto `pathname`, which produced
 * `/zh-Hans/mikrotik_manual_i18n/docs/...` and a GitHub Pages "Site not found"
 * 404. All path math now goes through `localizedPath()`, which splits the
 * configured `baseUrl` off first.
 *
 * Stored state, and who may write it:
 *   - `docusaurus_locale` (cookie **and** localStorage): the user's explicit
 *     choice, written only by the navbar language dropdown (the swizzled
 *     `LocaleDropdownNavbarItem`). This module must never write it: writing it
 *     on auto-redirect made the next visit look manual, so a Chinese-browser
 *     visitor who picked English was bounced back to Chinese.
 *   - `docusaurus_locale_auto`: "automatic detection already ran". This module
 *     writes it before redirecting (and when it lands on the Chinese tree) so
 *     an English page is not auto-redirected again; it is not a preference.
 *
 * The decision is made once per page and only when all of these hold:
 *   - no explicit choice (cookie or localStorage);
 *   - no automatic-detection marker (else the user already saw the result and
 *     deliberately navigated back to an English page);
 *   - the primary language (`navigator.languages[0]`, falling back to
 *     `navigator.language`) starts with `zh`;
 *   - the current path is inside `baseUrl` and outside `baseUrl + /zh-Hans`.
 *
 * The marker is written *before* `location.replace`, so the redirected page
 * sees it and cannot bounce back: no loop. `search` and `hash` are preserved
 * by the caller and the replace keeps the redirect out of the history stack.
 */

const COOKIE_NAME = 'docusaurus_locale';
const AUTO_COOKIE_NAME = 'docusaurus_locale_auto';
const COOKIE_MAX_AGE = 31536000;
const CHINESE_PREFIX = '/zh-Hans';

// Module level: `onRouteDidUpdate` fires for every client-side navigation, but
// a redirect must happen at most once per full page load.
let redirected = false;

/**
 * Pure path helper, exported for `tools/verify/locale-path.test.mjs`.
 *
 * `pathname` is the raw `window.location.pathname`; `baseUrl` is the
 * Docusaurus `siteConfig.baseUrl` (with or without a trailing slash). The
 * returned `path` is the localized pathname only: the caller appends
 * `search` and `hash`, because a pure path function must not invent them.
 *
 * `outsideBase` is true when `pathname` is not under `baseUrl` (for example
 * the `/zh-Hans/...` URL an already-broken redirect produced, or a foreign
 * path on the same host). Such a path must never be localized; the caller
 * leaves it alone.
 *
 * @param {string} pathname
 * @param {string} baseUrl
 * @returns {{path: string, alreadyChinese: boolean, outsideBase: boolean}}
 */
export function localizedPath(pathname, baseUrl) {
  const rawPath = normalizePathname(pathname);
  const base = normalizeBaseUrl(baseUrl);

  let relative;
  let outsideBase = false;
  if (base === '/') {
    relative = rawPath;
  } else if (rawPath === base.slice(0, -1)) {
    // `/repo` and `/repo/` both mean the base root.
    relative = '/';
  } else if (rawPath.startsWith(base)) {
    // `base` ends with `/`, so slicing at `base.length - 1` keeps the leading
    // slash of the relative path and therefore its trailing slash as well.
    relative = rawPath.slice(base.length - 1);
  } else {
    outsideBase = true;
    relative = rawPath;
  }

  // Only a path inside this deployment's baseUrl can be the Chinese tree; a
  // stale `/zh-Hans/...` URL outside baseUrl is not a locale match.
  const alreadyChinese =
    !outsideBase &&
    (relative === CHINESE_PREFIX || relative.startsWith(`${CHINESE_PREFIX}/`));
  if (alreadyChinese || outsideBase) {
    return {path: rawPath, alreadyChinese, outsideBase};
  }

  // `${base}${'zh-Hans'}${relative}`:
  //   `/`      + `/docs/x` -> `/zh-Hans/docs/x`
  //   `/repo/` + `/docs/x` -> `/repo/zh-Hans/docs/x`
  //   `/repo/` + `/`       -> `/repo/zh-Hans/`
  const path = `${base}${CHINESE_PREFIX.slice(1)}${relative}`;
  return {path, alreadyChinese: false, outsideBase: false};
}

/**
 * Path relative to this deployment's `baseUrl`, leading slash preserved.
 *
 * The cross-repo redirect needs it: the Chinese site is a **separate
 * deployment** (`<meta name="docusaurus-zh-home">`, built from another
 * repository), not `${baseUrl}zh-Hans/`, so the destination cannot be derived
 * with `localizedPath`. Same path math as `localizedPath`, kept in one place.
 *
 * @param {string} pathname
 * @param {string} baseUrl
 * @returns {{relative: string, outsideBase: boolean}}
 */
export function relativeSitePath(pathname, baseUrl) {
  const rawPath = normalizePathname(pathname);
  const base = normalizeBaseUrl(baseUrl);
  if (base === '/') return {relative: rawPath, outsideBase: false};
  if (rawPath === base.slice(0, -1)) return {relative: '/', outsideBase: false};
  if (rawPath.startsWith(base)) {
    return {relative: rawPath.slice(base.length - 1), outsideBase: false};
  }
  return {relative: rawPath, outsideBase: true};
}

/**
 * Absolute URL on the Chinese site for an English path, or `null` when the
 * build did not declare a Chinese site (no absolute `zhHome`).
 *
 * @param {string} zhHome absolute base **without** trailing slash
 * @param {string} relative path relative to the English baseUrl, starting `/`
 * @returns {string | null}
 */
export function zhRedirectTarget(zhHome, relative) {
  const home = String(zhHome || '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(home)) return null;
  const rest = String(relative || '/');
  return `${home}${rest.startsWith('/') ? '' : '/'}${rest}`;
}

function normalizePathname(pathname) {
  const value = typeof pathname === 'string' && pathname ? pathname : '/';
  return value.startsWith('/') ? value : `/${value}`;
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) return '/';
  let base = baseUrl.trim();
  // Tolerate an absolute URL (the tests and future providers may pass one).
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(base)) {
    try {
      base = new URL(base).pathname;
    } catch {
      return '/';
    }
  }
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
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

function storedLocale() {
  try {
    return window.localStorage.getItem(COOKIE_NAME);
  } catch {
    return null;
  }
}

/** The explicit choice, cookie first (the dropdown writes both). */
function explicitLocale() {
  return readCookie(COOKIE_NAME) || storedLocale();
}

/** Has automatic detection already redirected this browser once? */
function hasAutoMarker() {
  if (readCookie(AUTO_COOKIE_NAME)) return true;
  try {
    return window.localStorage.getItem(AUTO_COOKIE_NAME) !== null;
  } catch {
    return false;
  }
}

/**
 * Record that automatic detection ran. Deliberately **not** `docusaurus_locale`:
 * that key means "the user picked this", and only the dropdown may set it.
 */
function writeAutoMarker() {
  try {
    document.cookie = `${AUTO_COOKIE_NAME}=zh-Hans; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // Cookies can be disabled; the redirect still works for this page view.
  }
  try {
    window.localStorage.setItem(AUTO_COOKIE_NAME, 'zh-Hans');
  } catch {
    // localStorage can be unavailable (private mode); the cookie is enough.
  }
}

/**
 * 只看**首选**语言：`<head>` 里的同步跳转脚本（`docusaurus.config.ts` 的
 * `localeRedirectScript`）就是这么判的。若这里用 `.some()`，脚本判定「不跳」
 * 之后本模块还会把页面拉去中文，形成「英文先绘制、随后又跳」的闪烁——正是
 * 用户 #20 报的问题。两边共用同一规则，站内二次检测只会补位、不会打架。
 */
function prefersChinese() {
  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  const first = languages.filter(Boolean)[0];
  return String(first || '').toLowerCase().startsWith('zh');
}

const LOCALE_SEGMENTS = new Set(['zh-Hans']);

/**
 * Resolve the deployment `baseUrl`, most reliable source first.
 *
 * The current build injects `<meta name="docusaurus-base-url">` into every
 * page's `<head>` from `docusaurus.config.ts`, so the first branch is the
 * normal one. The remaining branches only matter for stale builds or embedded
 * copies of this module.
 *
 * Why the asset scan is last and guarded: Docusaurus serves the default
 * locale's bundles from `${baseUrl}assets/...` but a localized page's from
 * `${baseUrl}${locale}/assets/...` (`build/zh-Hans/assets/js/...`). On a
 * zh-Hans page the derived prefix is therefore `/repo/zh-Hans/`; using it as
 * `baseUrl` made `localizedPath` think the path was English and prepend the
 * locale a second time (`/repo/zh-Hans/zh-Hans/docs/...`). A candidate ending
 * in a locale segment is never the deployment root, so it is rejected.
 */
function detectBaseUrl() {
  if (typeof window === 'undefined') return '/';

  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="docusaurus-base-url"]');
    const metaValue = meta?.getAttribute('content')?.trim();
    if (metaValue) return normalizeBaseUrl(metaValue);
  }

  // Optional runtime global; Docusaurus 3.10.1 does not expose it today, but a
  // future version or an injected value wins over any guess.
  const siteConfig = window.__DOCUSAURUS__?.siteConfig;
  if (siteConfig && typeof siteConfig.baseUrl === 'string') {
    return normalizeBaseUrl(siteConfig.baseUrl);
  }

  if (typeof document === 'undefined') return '/';

  const declarativeBase = baseUrlFromDocumentBase();
  if (declarativeBase) return declarativeBase;

  const assetBase = baseUrlFromBundledAssets();
  if (assetBase) return assetBase;

  // Unknown host/layout: keep the module harmless rather than redirecting to a
  // guessed prefix.
  return '/';
}

/**
 * Use an explicit `<base href>`, or `document.baseURI` when it points at a
 * directory above the current page. Without a `<base>` tag `document.baseURI`
 * is the page URL itself, which is rejected; a locale-prefixed URL is rejected
 * as well because localized pages live *under* `${baseUrl}${locale}`.
 */
function baseUrlFromDocumentBase() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }
  const baseElement = document.querySelector('base[href]');
  const href = baseElement ? baseElement.getAttribute('href') : document.baseURI;
  if (!href) return null;

  let candidate;
  try {
    candidate = new URL(href, document.baseURI).pathname;
  } catch {
    return null;
  }

  const base = normalizeBaseUrl(candidate);
  const pathname = normalizePathname(window.location.pathname);
  if (base === '/') return null;
  // The page URL is not a directory prefix of itself.
  if (base === pathname) return null;
  // The candidate has to be an ancestor of the current page.
  if (!pathname.startsWith(base)) return null;
  if (hasLocaleSuffix(base)) return null;
  return base;
}

function hasLocaleSuffix(base) {
  const segments = base.split('/').filter(Boolean);
  return segments.length > 0 && LOCALE_SEGMENTS.has(segments[segments.length - 1]);
}

/**
 * Derive `baseUrl` from the site's own bundled asset URLs. Only same-origin
 * `.../assets/js/*.js` and `.../assets/css/*.css` references are considered, so
 * a CDN stylesheet with a similar path cannot be mistaken for the site root.
 * A locale-prefixed candidate is skipped: see the comment on `detectBaseUrl`.
 */
function baseUrlFromBundledAssets() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }
  const nodes = document.querySelectorAll('script[src], link[href]');
  for (const node of nodes) {
    const value = node.getAttribute('src') || node.getAttribute('href');
    if (!value) continue;
    let url;
    try {
      url = new URL(value, document.baseURI);
    } catch {
      continue;
    }
    if (url.origin !== window.location.origin) continue;
    const match = /^(.*?)\/assets\/(?:js|css)\/[^/]+\.(?:js|css)$/.exec(
      url.pathname,
    );
    if (!match) continue;
    const candidate = normalizeBaseUrl(match[1] || '/');
    if (hasLocaleSuffix(candidate)) continue;
    return candidate;
  }
  return null;
}

/**
 * Absolute base of the Chinese site, from
 * `<meta name="docusaurus-zh-home">` (injected at build time by
 * `docusaurus.config.ts` from `LOCALE_ZH_URL` + `LOCALE_ZH_BASE_URL`).
 *
 * The Chinese mirror is another repository and another Pages site; this
 * deployment has no `zh-Hans/` tree to send readers to. Returns `null` when the
 * meta is missing or not an absolute URL, and the caller then never redirects.
 */
function detectZhHome() {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="docusaurus-zh-home"]');
  const value = meta?.getAttribute('content')?.trim();
  if (!value || !/^https?:\/\//i.test(value)) return null;
  return value.replace(/\/+$/, '');
}

function run() {
  if (typeof window === 'undefined' || redirected) return;

  const {pathname, search, hash} = window.location;
  const baseUrl = detectBaseUrl();
  const {alreadyChinese, outsideBase} = localizedPath(pathname, baseUrl);

  // The Chinese tree is already the requested locale. Record that automatic
  // detection ran (so a later English page is not silently redirected back),
  // but never claim it was a user choice.
  if (alreadyChinese) {
    if (!explicitLocale() && !hasAutoMarker()) writeAutoMarker();
    return;
  }

  // A path outside baseUrl (a stale prefixed URL, another app on this host)
  // cannot be localized safely; leave it untouched instead of 404ing it.
  if (outsideBase) return;

  // A `404.html` has no translated counterpart; prefixing it would break it.
  if (pathname === `${baseUrl}404.html`) return;

  // An explicit choice always wins, even when it is `en`; the dropdown
  // mirrored it to localStorage, so a cleared cookie does not lose it.
  if (explicitLocale()) return;
  // Automatic detection already sent this browser to Chinese once; a return to
  // an English page is deliberate, so do not bounce it again.
  if (hasAutoMarker()) return;
  if (!prefersChinese()) return;

  redirected = true;
  // Write the marker first, then replace: the destination page sees it.
  writeAutoMarker();
  // Cross-repo entry: keep the same path on the Chinese site (another Pages
  // deployment). Without a declared Chinese site there is nothing safe to jump
  // to, so the English page stays put instead of 404ing on `${baseUrl}zh-Hans/`.
  const zhHome = detectZhHome();
  const {relative} = relativeSitePath(pathname, baseUrl);
  const target = zhHome ? zhRedirectTarget(zhHome, relative) : null;
  if (!target) {
    redirected = false;
    return;
  }
  window.location.replace(`${target}${search}${hash}`);
}

/**
 * 首屏也要执行一次：`onRouteDidUpdate` 在某些入口/版本上只在客户端切换路由时
 * 触发，首次加载（服务端预渲染的 HTML 直接水合）不触发，于是中文用户第一屏
 * 停在英文页。`onRouteUpdate` 在真实路由更新时触发得更早，并且首屏也会触发。
 *
 * 触发时机早于 React 提交新路由的 DOM，所以推迟到下一帧（`requestAnimationFrame`）
 * 之后再用 `setTimeout(0)` 跑一次：此时 `<meta name="docusaurus-base-url">`、
 * `document.baseURI` 和资源路径都已经是当前页面的。`scheduled` 只用来合并
 * 同一帧内的重复调度，执行后立刻复位，后续客户端导航仍然会重新判断。
 */
let scheduled = false;

function scheduleRun() {
  if (typeof window === 'undefined' || scheduled) return;
  scheduled = true;
  const exec = () => {
    scheduled = false;
    run();
  };
  if (typeof window.requestAnimationFrame === 'function') {
    // 后台标签页里 rAF 会被节流到几乎不触发，setTimeout 保证最终还是会跑。
    window.requestAnimationFrame(() => window.setTimeout(exec, 0));
  } else {
    window.setTimeout(exec, 0);
  }
}

export function onRouteUpdate() {
  scheduleRun();
}

// 兜底：万一当前 Docusaurus 版本不调用客户端模块的 `onRouteUpdate`
// （或者模块被单独嵌入），DOM 就绪后仍然执行一次。模块可能在 SSR 阶段被
// 载入，所以这里必须先判断 `window` / `document` 存在。
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', scheduleRun, {once: true});
  } else {
    scheduleRun();
  }
}

export function onRouteDidUpdate() {
  run();
}
