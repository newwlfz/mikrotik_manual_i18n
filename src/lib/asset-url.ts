import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * 静态资源根：`customFields.assetBaseUrl`（不带 locale 的 baseUrl）。
 *
 * Docusaurus 3.10 给非默认语种把 `siteConfig.baseUrl` 改成
 * `/mikrotik_manual_i18n/zh-Hans/`（`@docusaurus/core/lib/server/site.js`），
 * 这个值被烘进 `build/zh-Hans/assets/js/main.*.js`。`useBaseUrl` 用它产出
 * `/mikrotik_manual_i18n/zh-Hans/img/<hash>`，而 `tools/build/slim.mjs` 只保留
 * 根目录的那一份副本，所以中文页客户端新插入的 `<img>` 会 404。
 *
 * 路由仍用 `useBaseUrl`（页面 URL 必须带语种）；静态资源一律用这里的
 * `assetBaseUrl`，两者解耦。
 */

/** 规范化成前后都带 `/` 的资源根。 */
export function normalizeAssetBase(value: string): string {
  const trimmed = (value || '').trim();
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/** 去掉 baseUrl 末尾的语种段（`/repo/zh-Hans/` -> `/repo/`）。 */
function stripLocaleSuffix(baseUrl: string, locale?: string): string {
  if (!locale) return baseUrl;
  const suffix = `${locale}/`;
  return baseUrl.endsWith(suffix) ? baseUrl.slice(0, -suffix.length) : baseUrl;
}

/**
 * 站内绝对路径拼资源根；外链（`http(s)://`、`mailto:`、`data:`）、协议相对
 * `//host/...` 与相对路径原样通过。已经带资源根的路径不会重复拼接。
 */
export function assetUrl(src: string, base: string): string {
  if (!src.startsWith('/') || src.startsWith('//')) return src;
  const root = normalizeAssetBase(base);
  if (src === root || src.startsWith(root)) return src;
  return `${root}${src.replace(/^\/+/, '')}`;
}

/**
 * 同 `assetUrl`，但把 `src` 当作**站内根路径**：`img/logo.svg` 与
 * `/img/logo.svg` 等价。`themeConfig.navbar.logo.src` 这类 Docusaurus 配置值
 * 是相对 `static/` 的（不带前导 `/`），不能交给 `assetUrl` 原样通过。
 */
export function assetUrlFromRoot(src: string, base: string): string {
  return assetUrl(`/${src.replace(/^\/+/, '')}`, base);
}

/**
 * React hook：读取构建期注入的资源根。
 *
 * 优先 `siteConfig.customFields.assetBaseUrl`；旧构建没有该字段时退回
 * 「siteConfig.baseUrl 去掉当前语种段」，行为与修复前一致而不是拼出
 * `/zh-Hans/img/...`。
 */
export function useAssetBaseUrl(): string {
  const {siteConfig, i18n} = useDocusaurusContext();
  const configured = siteConfig.customFields?.assetBaseUrl;
  if (typeof configured === 'string' && configured.trim()) {
    return normalizeAssetBase(configured);
  }
  return normalizeAssetBase(stripLocaleSuffix(siteConfig.baseUrl, i18n?.currentLocale));
}

export default useAssetBaseUrl;
