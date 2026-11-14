import fs from 'node:fs';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config, Plugin} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * 站点标识：**所有语种仓库共用这一份 `docusaurus.config.ts`**（逐字节相同），
 * 站点之间的全部差异由仓库根的 `locales.json`（语种登记表）与环境变量提供，
 * 配置文件里不再有「只对某个站点成立」的字面量。
 *
 * `locales.json` 是语种与部署地址的唯一事实源：
 *   - 每个语种的 `label` / `htmlLang`、承载它的 GitHub 仓库、部署路径与绝对地址；
 *   - 本文件据此生成 `i18n.locales` 与 `localeConfigs`，语言下拉、每页
 *     `hreflang`、`og:locale:alternate` 都从这里取值；
 *   - `tools/lib/site-config.mjs`（构建与断言）和 `tools/content/publish.mjs`
 *     （总管向语种仓推送）也读同一份文件，三处不会各自漂移。
 *
 * 环境变量覆盖仍然有效（本地预览、fork 与既有工作流都不必改文件）：
 *
 *   SITE_LOCALE            本次构建产出的语种（默认 `locales.json` 的 default）
 *   SITE_URL / BASE_URL    本站的绝对域名与路径前缀
 *   LOCALE_<X>_URL / _BASE_URL  某个语种的绝对域名 / 前缀（`zh-Hans` → `ZH`）
 *   ASSET_ORIGIN           共享资源源站（英文站基址，例
 *                          `https://newwlfz.github.io/mikrotik_manual_i18n`）：
 *                          站内资源引用改写到该源站，语种仓不再自带 `static/`
 *
 * 缺省值描述的是 GitHub Pages 上的**站点组**：当前构建的语种占用
 * `SITE_URL`/`BASE_URL`，其它语种回落到 `locales.json` 里的规范地址。
 * 显式的 `LOCALE_<X>_*` 永远优先，本地/预览时可以把另一语言指到任何地址。
 *
 * 每个仓库只构建 `SITE_LOCALE` 指定的一个语种：`tools/build/index.mjs` 在
 * 该变量存在时只跑 `docusaurus build --locale <SITE_LOCALE>`，产物里没有
 * `build/<locale>/` 这一层，但 `i18n.locales` 仍声明全部语种，语言下拉与
 * `hreflang` 因此能指到其它语种的站点（其它仓库、其它 Pages 站点）。
 */
const localeRegistryLib = require('./tools/content/locales.js') as {
  readRegistry: () => LocaleRegistry;
  validateRegistry: (registry: unknown) => string[];
  resolveSites: (
    registry: LocaleRegistry,
    options: {env?: Record<string, string | undefined>; siteLocale?: string},
  ) => ResolvedSites;
  zhVariantTargets: () => Record<string, string>;
  localeRedirectScript: (options: {
    base: string;
    currentLocale: string;
    homes: Record<string, string>;
    rules: Record<string, string>;
    defaultZh: string | null;
    cookies: {explicit: string; auto: string; maxAge: number};
  }) => string;
};

type LocaleRegistryEntry = {
  label: string;
  repo: string;
  baseUrl: string;
  site: string;
  direction?: 'ltr' | 'rtl';
  htmlLang?: string;
};
type LocaleRegistry = {default: string; locales: Record<string, LocaleRegistryEntry>};
type ResolvedSites = {
  defaultLocale: string;
  siteLocale: string;
  siteUrl: string;
  baseUrl: string;
  localeConfigs: NonNullable<Config['i18n']>['localeConfigs'];
  homes: Record<string, string>;
  zhHome: string | null;
  defaultZh: string | null;
  title: string | null;
  tagline: string | null;
  defaultHome: string;
};

const localeRegistry = localeRegistryLib.readRegistry();
const localeRegistryErrors = localeRegistryLib.validateRegistry(localeRegistry);
if (localeRegistryErrors.length > 0) {
  throw new Error(
    `locales.json is invalid:\n  - ${localeRegistryErrors.join('\n  - ')}\n` +
      'Run `npm run locales:check` for the full report.',
  );
}

/**
 * 每个语种的规范地址，`localeConfigs` 与 `zhHome`/`enHome` 都从这里取值。
 *
 * 当前构建的语种默认等于本站地址；其它语种回落到 `locales.json` 里的规范
 * 前缀。`zhHome` / `enHome` 是**不带尾斜杠**的绝对基址：`<head>` 首屏跳转
 * 脚本、`src/clientModules/locale-detect.js`、`src/pages/index.tsx` 拼的是以
 * `/` 开头的站内相对路径，带尾斜杠会拼出 `//`。
 */
const sites: ResolvedSites = localeRegistryLib.resolveSites(localeRegistry, {
  env: process.env,
});
const siteLocale = sites.siteLocale;
const siteUrl = sites.siteUrl;
const baseUrl = sites.baseUrl;
const localeConfigs = sites.localeConfigs;
const defaultLocale = localeRegistry.default;
const enHome = sites.defaultHome;
const zhHome = sites.zhHome;
const defaultZh = sites.defaultZh;
const localeHomes = sites.homes;
/**
 * 浏览器语言 → 目标语种的映射表（`tools/content/locales.js` 里唯一一份），
 * 原样内联进 `<head>` 脚本与 `<meta>`，浏览器侧不再有第二份规则。
 */
const zhVariantRules = localeRegistryLib.zhVariantTargets();

/**
 * 本产物自己的资源根：**不带 locale** 的 baseUrl。
 *
 * 两个用途，且都必须是**站内路径**，不能是别的域名：
 *   1. Webpack 的 `publicPath`（`docusaurusAssetPublicPath` / mdx-loader 的
 *      内联 loader query）。本仓渲染出来的 chunk、字体、以及每页 `img/` 目录
 *      里的图片都发布在本站的 `assets/` 下，前缀只能指向本站。
 *   2. pagefind 索引（`build/pagefind` 每次构建都在本站生成）。
 *
 * 为什么不能用 `siteConfig.baseUrl`：Docusaurus 3.10 对非默认语种把
 * `siteConfig.baseUrl` 改成 `/mikrotik_manual_i18n/zh-Hans/`
 * （`@docusaurus/core/lib/server/site.js:64-67`），该值被烘进
 * `build/zh-Hans/assets/js/main.*.js`。于是 `useBaseUrl` 在中文页产出
 * `/mikrotik_manual_i18n/zh-Hans/img/<hash>`；而 `tools/build/slim.mjs` 删掉
 * `build/zh-Hans/{img,assets/images}` 后只保留根目录副本，客户端新插入的
 * 图片就 404（HTML 已被 slim 改回根路径，所以只有站内跳转才暴露）。
 *
 * 路由/链接仍用 `useBaseUrl`（页面 URL 必须带语种），两者解耦。
 * 取值与 `baseUrl` 同一表达式（`BASE_URL` 环境变量优先），只做前后 `/`
 * 规范化；`baseUrl` / `locales` / `localeConfigs` 都由 `locales.json` 驱动，
 * 不要在这里写死某个语种的前缀。
 */
const assetBaseUrl = (() => {
  const value = baseUrl.trim() || '/';
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
})();

/**
 * 共享资源源站（`ASSET_ORIGIN`，不带尾斜杠；未设置时为 `null`）。
 *
 * 语种仓不再保存 `static/`：图片/PDF/视频等字节留在英文站（资源宿主），
 * 语种仓构建时把 `/img/…`、`/assets/…`、`/videos/…`、`/official/…`、
 * `/cli/…` 改写到这个源站（`tools/build/remark-prefix-root-refs.mjs`）。
 *
 * 失效风险：英文站改名、换域名或换路径前缀，会同时打断所有语种站的资源；
 * 改完必须同步更新每个语种仓的 `ASSET_ORIGIN`。以后若把资源放到独立 CDN，
 * 只需要把 `ASSET_ORIGIN` 指向 CDN。
 */
const assetOrigin = (process.env.ASSET_ORIGIN || '').trim().replace(/\/+$/, '');

/**
 * 对外可见的资源根，写进 `customFields.assetBaseUrl`，供 `<Img>`、导航 Logo、
 * favicon、`og:image` 与 `cli-compare.json`（CLI 对比数据也属于共享资源）
 * 使用：设置了 `ASSET_ORIGIN` 就是英文站的绝对地址，否则回落到本站的
 * `assetBaseUrl`——未设置时行为与旧版完全一致。
 *
 * **不要**把它交给 Webpack 或 pagefind：那些资源由本仓发布，见上面
 * `assetBaseUrl` 的说明（`customFields.localAssetBaseUrl`）。
 */
const sharedAssetBaseUrl = assetOrigin ? `${assetOrigin}/` : assetBaseUrl;
/**
 * Markdown 图片/附件走的是 mdx-loader 生成的**内联 loader 字符串**
 * （`!url-loader?...&fallback=file-loader!`），不经过 `module.rules`，所以
 * `docusaurusAssetPublicPath` 插件改不到它们；它们同样把
 * `__webpack_public_path__`（本地化 baseUrl）当资源前缀。
 *
 * 这里包一层 `@docusaurus/utils` 的 `getFileLoaderUtils`，给三个内联 loader
 * 的 query 补 `publicPath=<assetBaseUrl>`。该导出是只读 getter，所以用
 * `defineProperty` 覆盖；mdx-loader 在编译期按属性名取函数，覆盖后即生效。
 * 只影响资源 URL，不影响 chunk 的 `output.publicPath`。
 */
const docusaurusUtils = require('@docusaurus/utils') as {
  getFileLoaderUtils: (isServer: boolean) => {loaders: Record<string, string>};
};
const originalGetFileLoaderUtils = docusaurusUtils.getFileLoaderUtils;
const assetPublicPathQuery = `&publicPath=${encodeURIComponent(assetBaseUrl)}`;
Object.defineProperty(docusaurusUtils, 'getFileLoaderUtils', {
  configurable: true,
  enumerable: true,
  value: (isServer: boolean) => {
    const utils = originalGetFileLoaderUtils(isServer);
    for (const name of [
      'inlineMarkdownImageFileLoader',
      'inlineMarkdownAssetImageFileLoader',
      'inlineMarkdownLinkFileLoader',
    ]) {
      const value = utils.loaders[name];
      if (typeof value === 'string' && !value.includes('publicPath=')) {
        utils.loaders[name] = value.replace(/!$/, `${assetPublicPathQuery}!`);
      }
    }
    return utils;
  },
});

const currentVersionFile = 'data/manifests/current-version.json';
const currentVersion = fs.existsSync(currentVersionFile)
  ? JSON.parse(fs.readFileSync(currentVersionFile, 'utf8')).version
  : '7.24';
const versionedRoot = 'versioned_docs';
const versionedSnapshots = fs.existsSync(versionedRoot)
  ? fs
      .readdirSync(versionedRoot, {withFileTypes: true})
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('version-'))
      .map((entry) => entry.name.replace(/^version-/, ''))
      .sort((a, b) => {
        const aa = a.split('.').map(Number);
        const bb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
          if ((aa[i] ?? 0) !== (bb[i] ?? 0)) return (aa[i] ?? 0) - (bb[i] ?? 0);
        }
        return a.localeCompare(b);
      })
  : [];

/**
 * 构建期把 baseUrl 注入每个页面的 <head>：
 * `<meta name="docusaurus-base-url" content="<baseUrl>">`。
 *
 * 客户端模块 `src/clientModules/locale-detect.js` 不能从资源路径反推
 * baseUrl：Docusaurus 在本地化页面把资源放在 `${baseUrl}${locale}/assets/...`
 * （构建产物里是 `build/zh-Hans/assets/js/...`），反推出的前缀是
 * `/repo/zh-Hans/`，再拼一次语言前缀就成了 `/repo/zh-Hans/zh-Hans/...`。
 * 由构建期直接给出准确值最稳。
 *
 * 这是「内联插件工厂」：本身是函数，注册时必须把裸函数放进 `plugins`，
 * 由核心的 `initializePlugin` 以 `(context, options)` 调用，返回值再当插件对象用。
 * Docusaurus 3 的插件校验只接受字符串、函数或 `[函数, options]` 数组；若写成
 * `docusaurusBaseUrlMeta()`，数组里就是已求值的 `{name, injectHtmlTags}` 对象，
 * 校验会以 “Bad Docusaurus plugin value” 失败。返回值用 `Plugin` 类型兜住。
 */
const LOCALE_COOKIE = 'docusaurus_locale';
/**
 * 自动跳转的“已处理”标记，**不是**用户选择。
 *
 * `docusaurus_locale` 只由语言下拉写入（见
 * `src/theme/NavbarItem/LocaleDropdownNavbarItem`），表示“用户明确选过”。
 * 自动跳转以前也写这个键，于是「中文浏览器手选英文」下一次被当成没选过，
 * 又被弹回中文。现在自动跳转只写 `docusaurus_locale_auto`：它不参与
 * “用户偏好是哪一种语言”的判断，只说明“本浏览器自动跳过一次”，
 * 这样已经自动跳过的人再看英文页不会被反复弹走。
 */
const AUTO_LOCALE_COOKIE = 'docusaurus_locale_auto';
const LOCALE_COOKIE_MAX_AGE = 31536000;


/**
 * 代码块语言归一表（config/code-fence-languages.yml）是唯一事实源：
 * tools/build/normalize-fences.mjs 按同一份别名表改写 docs 里的 info string，
 * 这里把 prism_languages 交给 prism.additionalLanguages，两边不会漂移。
 * ros / mikrotik 由 src/clientModules/ros-prism.js 自己注册，不在列表里。
 */
const fenceLanguages: {prism_languages?: string[]} = (() => {
  try {
    const yaml = require('js-yaml');
    return yaml.load(fs.readFileSync('config/code-fence-languages.yml', 'utf8')) || {};
  } catch {
    // 配置文件缺失时退回旧列表，构建不因此中断。
    return {};
  }
})();
const prismLanguages =
  fenceLanguages.prism_languages && fenceLanguages.prism_languages.length
    ? fenceLanguages.prism_languages
    : ['bash', 'powershell', 'json', 'yaml'];

function docusaurusAssetPublicPath(): Plugin {
  return {
    name: 'docusaurus-asset-public-path',
    /**
     * Webpack 给每个被 `require()` 的资源拼 `output.publicPath`，而 Docusaurus
     * 把它设成**本地化后的** baseUrl，于是 `/…/zh-Hans/assets/images/…` 被烘进
     * 中文页面的 chunk。`tools/build/slim.mjs` 只改写 HTML/XML/JSON 并删掉各
     * 语种目录下的副本，所以 SSR 的 HTML 正确、客户端路由切换后新插入的
     * Markdown 图片 404。
     *
     * 这里只把 file-loader/url-loader 的 `publicPath` 固定到 `assetBaseUrl`
     * （覆盖 fonts/medias/files 这类走 `module.rules` 的资源）；
     * `output.publicPath` 不动，chunk 仍然从各语种自己的 `assets/js` 加载。
     * Markdown 图片/附件走 mdx-loader 的**内联** loader 字符串，不经过 rules，
     * 由上面的 `getFileLoaderUtils` 补丁处理。
     */
    configureWebpack(webpackConfig) {
      const rules = (webpackConfig as {module?: {rules?: unknown[]}}).module?.rules;
      if (Array.isArray(rules)) {
        for (const rule of rules as {use?: unknown}[]) {
          const use = rule?.use;
          const uses = (Array.isArray(use) ? use : use ? [use] : []) as unknown[];
          for (const entry of uses) {
            if (!entry || typeof entry !== 'object') continue;
            const useEntry = entry as {loader?: unknown; options?: object};
            if (
              typeof useEntry.loader !== 'string' ||
              !/[\\/](?:file|url)-loader[\\/]/.test(useEntry.loader)
            ) {
              continue;
            }
            useEntry.options = {...useEntry.options, publicPath: assetBaseUrl};
          }
        }
      }
      // 就地修改，**不要**返回整份 config：Docusaurus 用 webpack-merge 合并
      // 返回值，数组默认是拼接，返回整份配置会把 module.rules 复制一遍，
      // MDX loader 因此对同一资源跑两次，触发 mdxCrossCompilerCache 的
      // “this should never be called”。
    },
  };
}

function docusaurusBaseUrlMeta(): Plugin {
  const content = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    name: 'docusaurus-base-url-meta',
    injectHtmlTags: () => ({
      headTags: [
        {
          tagName: 'meta',
          attributes: {
            name: 'docusaurus-base-url',
            content,
          },
        },
        // 本次构建的语种。客户端模块（`locale-detect.js`）与落地页据此决定
        // 「要不要把中文浏览器送到另一个站点」：中文站自己绝不能做这个判断。
        {
          tagName: 'meta',
          attributes: {
            name: 'docusaurus-site-locale',
            content: siteLocale,
          },
        },
        // 中文站（另一个 Pages 站点）的绝对基址，不含尾斜杠。客户端模块与
        // 落地页据此拼跨仓入口，不再假设 `baseUrl + zh-Hans` 一定存在。
        // 只在 `locales.json` 声明了中文语种时注入：没有中文站就没有入口。
        ...(zhHome
          ? [
              {
                tagName: 'meta',
                attributes: {
                  name: 'docusaurus-zh-home',
                  content: zhHome,
                },
              },
            ]
          : []),
        // 英文站的绝对基址，供中文产物里的跨仓入口使用（与 zh-home 对称）。
        {
          tagName: 'meta',
          attributes: {
            name: 'docusaurus-en-home',
            content: enHome,
          },
        },
        // 每个语种站点的绝对基址（不含尾斜杠）。`<head>` 脚本、客户端模块与
        // 落地页据此把读者送到**映射结果**对应的站点，而不是「第一个中文站」。
        {
          tagName: 'meta',
          attributes: {
            name: 'docusaurus-locale-homes',
            content: JSON.stringify(localeHomes),
          },
        },
        // 浏览器语言 → 目标语种的规则表，与 `<head>` 脚本内联的那份是同一份数据。
        {
          tagName: 'meta',
          attributes: {
            name: 'docusaurus-zh-rules',
            content: JSON.stringify(zhVariantRules),
          },
        },
        // 首屏自动跳转只属于默认语种（英文站）：中文站已经是目标语种，再
        // 「跳中文」就是自己跳自己。`SITE_LOCALE` 与 `locales.json` 在构建期
        // 决定是否注入这段脚本。
        ...(siteLocale === defaultLocale && defaultZh
          ? [
              {
                tagName: 'script',
                attributes: {},
                innerHTML: localeRegistryLib.localeRedirectScript({
                  base: content,
                  currentLocale: siteLocale,
                  homes: localeHomes,
                  rules: zhVariantRules,
                  defaultZh,
                  cookies: {
                    explicit: LOCALE_COOKIE,
                    auto: AUTO_LOCALE_COOKIE,
                    maxAge: LOCALE_COOKIE_MAX_AGE,
                  },
                }),
              },
            ]
          : []),
      ],
    }),
  };
}

/**
 * 站点标题/副标题也跟随构建语种：同一份配置在中文仓构建时不应输出英文
 * 标题（`<title>`、`og:site_name`、导航栏品牌文字的来源）。
 */
const siteTitle = sites.title || 'RouterOS Manual';
const siteTagline =
  sites.tagline ||
  'MikroTik RouterOS documentation, hardware guides, news and CLI reference';

const config: Config = {
  title: siteTitle,
  tagline: siteTagline,
  // `SiteMetadataDefaults`（@docusaurus/core 的 client App，不可 swizzle）渲染
  // `<link rel="icon" href={useBaseUrl(favicon)}>`：在 zh-Hans 页面上它会指向
  // `/…/zh-Hans/img/favicon.svg`，而 `tools/build/slim.mjs` 删掉了该副本，于是
  // 水合后浏览器重新请求 favicon 会 404（改 client module 只能事后补，仍会
  // 先发一次错误请求）。`favicon` 是可选字段：不声明它，默认的 icon 标签就
  // 不会渲染；favicon 改由下面的 `headTags` 用不带 locale 的 `assetBaseUrl`
  // 静态注入，SSR 与客户端一致。
  // Locale-independent asset root for client-side references; see the
  // `assetBaseUrl` comment at the top of this file.
  customFields: {
    // 共享资源根（可能是英文站的绝对地址）；见 `sharedAssetBaseUrl`。
    assetBaseUrl: sharedAssetBaseUrl,
    // 本产物自己发布的资源根（Webpack publicPath、pagefind），始终是站内路径。
    localAssetBaseUrl: assetBaseUrl,
    siteLocale,
  },

  /**
   * `static/` 是**英文站**（资源宿主）的资源树。语种仓在
   * `ASSET_ORIGIN` 模式下既不下载也不发布它：把 `staticDirectories` 设为空，
   * 遗留的 `static/`（例如旧的 content release 解压出来的）会被完全忽略，
   * Docusaurus 不会把它复制进 `build/`（`StaticDirectoriesCopyPlugin` 对空
   * 列表直接返回 `undefined`）。未设置时仍是默认的 `['static']`。
   */
  staticDirectories: assetOrigin ? [] : ['static'],

  // Three doc versions and two locales do not fit in Node's default heap, and
  // the static renderer is the peak. `ssgWorkerThreads` renders in worker
  // threads (smaller peak per thread, uses all cores) and the MDX cache shares
  // compiled documents between the two locales. `removeLegacyPostBuildHeadAttribute`
  // is a prerequisite of the SSG workers and only changes how <head> attributes
  // are post-processed.
  future: {
    v4: {removeLegacyPostBuildHeadAttribute: true},
    faster: {ssgWorkerThreads: true, mdxCrossCompilerCache: true},
  },

  // The public mirror URL is intentionally not the official origin. It is
  // replaced when the repository is deployed.
  url: siteUrl,
  baseUrl,

  onBrokenLinks: process.env.STRICT_LINKS === 'true' ? 'throw' : 'warn',
  markdown: {
    // The official site renders ```mermaid fences as diagrams; some ask for the
    // ELK layout through front-matter config.
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: process.env.STRICT_LINKS === 'true' ? 'throw' : 'warn',
      // The official 7.24 markdown references images the official site itself
      // does not serve; a faithful mirror keeps the reference and warns.
      onBrokenMarkdownImages: process.env.STRICT_LINKS === 'true' ? 'throw' : 'warn',
    },
  },

  clientModules: [
    './src/clientModules/ros-prism.js',
    './src/clientModules/wide-table.js',
    './src/clientModules/image-zoom.js',
    './src/clientModules/locale-detect.js',
  ],

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    // 语种清单与部署地址全部来自 `locales.json`（见文件头）：语言下拉
    // （`localeDropdown`）与每页的 `hreflang` 按它生成入口，删掉一个语种就
    // 同时删掉对应入口。每次构建只产出 `SITE_LOCALE` 一个语种（`--locale`），
    // 其它语种由各自的仓库构建；每个 `localeConfigs` 条目都带自己的
    // url/baseUrl（`tools/content/locales.js` 的 `resolveSites`）。
    defaultLocale,
    locales: Object.keys(localeRegistry.locales),
    // `translate` 只对本次构建的语种为 true：Docusaurus 3.10 的
    // `translate:false` 不只是跳过 `write-translations`，它让 docs 插件把
    // `contentPathLocalized` 设为 undefined、让 navbar/footer/sidebar 标签不
    // 翻译（`@docusaurus/core/lib/server/plugins/plugins.js` 的
    // `shouldTranslate`）。写死 false 会让中文仓产出“英文正文 + 英文外壳”；
    // 写死 true 会让英文仓去读中文仓的 `i18n/zh-Hans/` 覆盖层。
    localeConfigs,
  },

  // Official width preference survives client-side route changes because the
  // document class is re-applied whenever Docusaurus replaces it.
  headTags: [
    {
      // Replaces the default `favicon` link (see above): static, built once with
      // the root asset path, so no locale prefix and no client-side rewrite.
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `${sharedAssetBaseUrl}img/favicon.svg`,
      },
    },
    {
      tagName: 'script',
      attributes: {},
      innerHTML:
        '!function(){var t="content-wide";function e(){document.documentElement.classList.toggle(t,"true"===window.localStorage.getItem(t))}try{e(),new MutationObserver(e).observe(document.documentElement,{attributes:!0,attributeFilter:["class"]})}catch(t){}}()',
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          // `beforeDefaultRemarkPlugins` runs before Docusaurus' built-in
          // `transformImage`, so the plugin still sees markdown `image` nodes
          // instead of the `<img>` JSX they are rewritten into.
          beforeDefaultRemarkPlugins: [
            require('./src/remark/normalize-compliance-marks.mjs').default,
            // `ASSET_ORIGIN` 模式必须跑在 `transformImage` / `transformLinks`
            // 之前：它们会把 `/img/…` 解析成本地文件并 `require()`，而语种仓
            // 没有 `static/`。未设置 `ASSET_ORIGIN` 时这一步不动 Markdown 节点。
            require('./tools/build/remark-prefix-root-refs.mjs').default,
          ],
          remarkPlugins: [
            require('./src/remark/fence-language.mjs').default,
            // Root-absolute `<video src="/videos/…">` / `<img src="/img/…">`
            // copied from the official site must carry the deployment prefix.
            require('./tools/build/remark-prefix-root-refs.mjs').default,
          ],
          // The current docs directory is the newest version and is served at
          // /docs; snapshots are served at /docs/<version>.
          lastVersion: 'current',
          versions: {
            current: {
              label: currentVersion,
              badge: true,
              banner: 'none',
            },
            ...Object.fromEntries(
              versionedSnapshots.map((version) => [
                version,
                {label: version, path: version, badge: true, banner: 'none'},
              ]),
            ),
          },
        },
        blog: {
          routeBasePath: 'blog',
          path: 'blog',
          blogTitle: 'Product news',
          blogDescription: 'MikroTik product news',
          showReadingTime: true,
          onUntruncatedBlogPosts: 'ignore',
          beforeDefaultRemarkPlugins: [
            // `ASSET_ORIGIN` 模式必须跑在 `transformImage` / `transformLinks`
            // 之前：它们会把 `/img/…` 解析成本地文件并 `require()`，而语种仓
            // 没有 `static/`。未设置 `ASSET_ORIGIN` 时这一步不动 Markdown 节点。
            require('./tools/build/remark-prefix-root-refs.mjs').default,
          ],
          remarkPlugins: [
            require('./tools/build/remark-prefix-root-refs.mjs').default,
          ],
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        generateMarkdownFiles: true,
        docsDir: [
          {
            path: 'docs',
            routeBasePath: 'docs',
          },
        ],
        versions: [
          {
            name: 'current',
            label: currentVersion,
            docsDir: [
              {
                path: 'docs',
                routeBasePath: 'docs',
              },
            ],
            path: '',
            routePrefix: '',
          },
          ...versionedSnapshots.map((version) => ({
            name: version,
            label: version,
            docsDir: [
              {
                path: `versioned_docs/version-${version}`,
                routeBasePath: `docs/${version}`,
              },
            ],
            path: `docs/${version}`,
            routePrefix: `docs/${version}`,
          })),
        ],
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'hardware',
        path: 'hardware',
        routeBasePath: 'hardware',
        sidebarPath: './sidebars-hardware.ts',
        beforeDefaultRemarkPlugins: [
          require('./src/remark/normalize-compliance-marks.mjs').default,
          // `ASSET_ORIGIN` 模式必须跑在 `transformImage` / `transformLinks`
          // 之前：它们会把 `/img/…` 解析成本地文件并 `require()`，而语种仓
          // 没有 `static/`。未设置 `ASSET_ORIGIN` 时这一步不动 Markdown 节点。
          require('./tools/build/remark-prefix-root-refs.mjs').default,
        ],
        remarkPlugins: [
          require('./src/remark/fence-language.mjs').default,
          require('./tools/build/remark-prefix-root-refs.mjs').default,
        ],
      },
    ],
    [
      '@docusaurus/plugin-content-blog',
      {
        id: 'changelog',
        path: 'changelog',
        routeBasePath: 'changelog',
        blogTitle: 'Docs Changes',
        blogDescription: 'Documentation updates',
        showReadingTime: false,
        onUntruncatedBlogPosts: 'ignore',
        beforeDefaultRemarkPlugins: [
          // `ASSET_ORIGIN` 模式必须跑在 `transformImage` / `transformLinks`
          // 之前：它们会把 `/img/…` 解析成本地文件并 `require()`，而语种仓
          // 没有 `static/`。未设置 `ASSET_ORIGIN` 时这一步不动 Markdown 节点。
          require('./tools/build/remark-prefix-root-refs.mjs').default,
        ],
        remarkPlugins: [
          require('./tools/build/remark-prefix-root-refs.mjs').default,
        ],
      },
    ],
    // 追加为 plugins 的最后两个插件（以工厂函数形式注册，不覆盖已有插件）。
    docusaurusAssetPublicPath,
    docusaurusBaseUrlMeta,
  ],

  themeConfig: {
    // The official site lists every heading level from h2 down to h5 in the
    // right-hand outline; the default stops at h3, which hid whole subsections
    // (for example `Point-to-point addressing` on Networking Fundamentals).
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 5,
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    // og:image / twitter:image. `PageMetadata` resolves this with
    // `useBaseUrl(image, {absolute: true})`, which on a zh-Hans page yields
    // `/…/zh-Hans/img/logo.svg` (deleted by slim). An absolute URL is returned
    // untouched by `addBaseUrl`, so it keeps the locale-independent asset root;
    // it is built from `siteUrl` exactly like the canonical/og:url tags.
    // `ASSET_ORIGIN` 模式下 `sharedAssetBaseUrl` 已经是绝对地址，不能再拼
    // `siteUrl`（会得到 `https://sitehttps://origin/...`）。
    image: assetOrigin
      ? `${sharedAssetBaseUrl}img/logo.svg`
      : `${siteUrl.replace(/\/$/, '')}${assetBaseUrl}img/logo.svg`,
    navbar: {
      title: 'MikroTik',
      logo: {
        alt: 'MikroTik',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'introduction',
          position: 'left',
          label: 'RouterOS',
        },
        {
          to: '/hardware/',
          label: 'Hardware Guides',
          position: 'left',
        },
        {
          to: '/docs/cli-reference/compare-versions/',
          label: 'CLI compare',
          position: 'left',
        },
        {
          to: '/blog/',
          label: 'Product news',
          position: 'left',
        },
        {
          to: '/changelog/',
          label: 'Docs Changes',
          position: 'left',
        },
        {
          type: 'custom-WidthToggle',
          position: 'right',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
          docsPluginId: 'default',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          type: 'custom-SearchBox',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/docs/introduction'},
            {label: 'CLI Reference', to: '/docs/cli-reference/'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'Discord', href: 'https://discord.gg/exGj6whYw7'},
            {label: 'Forum', href: 'https://forum.mikrotik.com/'},
          ],
        },
        {
          title: 'MikroTik',
          items: [
            {label: 'MikroTik.com', href: 'https://mikrotik.com/'},
            {label: 'Product news', to: '/blog'},
            {label: 'Docs Changes', to: '/changelog'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} MikroTik. Built with Docusaurus.`,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    prism: {
      // The official manual highlights with `oneLight` / `oneDark`; the token
      // colours that make `/interface bridge` green and `:local` magenta come
      // from these themes, not from custom CSS.
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
      // `ros`, `routeros` and `mikrotik` are registered by
      // `src/clientModules/ros-prism.js`; the rest comes from
      // `config/code-fence-languages.yml` (`prism_languages`), which the fence
      // normalizer uses as its alias target list.
      additionalLanguages: prismLanguages,
    },
    mermaid: {
      // Official: a plain grey diagram in light mode, the dark theme otherwise.
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
