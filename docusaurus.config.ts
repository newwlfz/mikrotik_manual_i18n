import fs from 'node:fs';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config, Plugin} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * 英文站（本仓库）的部署地址。中文站是**另一个仓库、另一个 Pages 站点**
 * （`mikrotik_manual_zh_hans`）：本仓库只声明它的地址作为语言入口，不构建
 * 任何中文页面（见 `SITE_LOCALE` 与 `localeConfigs`）。
 */
const siteUrl = process.env.SITE_URL || 'https://newwlfz.github.io';
const baseUrl = process.env.BASE_URL || '/mikrotik_manual_i18n/';

/**
 * 本仓库构建的语种，默认 `en`。
 *
 * 取值只影响「构建什么」：`i18n.locales` 仍声明两个语种（否则语言下拉里不会
 * 出现中文入口），但 `tools/build/index.mjs` 在 `SITE_LOCALE` 存在时只跑
 * `docusaurus build --locale <SITE_LOCALE>`，产物里因此没有 `build/zh-Hans/`。
 */
const siteLocale = process.env.SITE_LOCALE || 'en';

/**
 * 中文站的绝对地址（跨仓语言入口），与 `localeConfigs['zh-Hans']` 同源同值。
 *
 * `LOCALE_ZH_URL` 缺省与 `siteUrl` 相同：两个站点都在 `newwlfz.github.io`
 * 这一个 Pages 域名下，只差路径前缀。
 *
 * `zhHome` 是**不带尾斜杠**的绝对基址：`<head>` 首屏跳转脚本、
 * `src/clientModules/locale-detect.js`、`src/pages/index.tsx` 拼的是以 `/`
 * 开头的站内相对路径，带尾斜杠会拼出 `//`。
 */
const zhSiteUrl = (process.env.LOCALE_ZH_URL || siteUrl).replace(/\/+$/, '');
const zhBaseUrl = (() => {
  const value = (process.env.LOCALE_ZH_BASE_URL || '/mikrotik_manual_zh_hans/').trim() || '/';
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
})();
const zhHome = `${zhSiteUrl}${zhBaseUrl}`.replace(/\/+$/, '');

/**
 * 静态资源根：**不带 locale** 的 baseUrl，构建期写进
 * `customFields.assetBaseUrl`，供 `<Img>`、导航 Logo、favicon 与
 * `cli-compare.json`/pagefind 这类「资源不是路由」的引用使用。
 *
 * 为什么需要它：Docusaurus 3.10 对非默认语种把 `siteConfig.baseUrl` 改成
 * `/mikrotik_manual_i18n/zh-Hans/`
 * （`@docusaurus/core/lib/server/site.js:64-67`），该值被烘进
 * `build/zh-Hans/assets/js/main.*.js`。于是 `useBaseUrl` 在中文页产出
 * `/mikrotik_manual_i18n/zh-Hans/img/<hash>`；而 `tools/build/slim.mjs` 删掉
 * `build/zh-Hans/{img,assets/images}` 后只保留根目录副本，客户端新插入的
 * 图片就 404（HTML 已被 slim 改回根路径，所以只有站内跳转才暴露）。
 *
 * 路由/链接仍用 `useBaseUrl`（页面 URL 必须带语种），两者解耦。
 * 取值与 `baseUrl` 同一表达式（`BASE_URL` 环境变量优先），只做前后 `/`
 * 规范化；不要改 `baseUrl` / `locales` / `localeConfigs`。
 */
const assetBaseUrl = (() => {
  const value = baseUrl.trim() || '/';
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
})();
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
 * 首屏语言切换：同步内联脚本，注入到 <head>（<meta name="docusaurus-base-url">
 * 之后）。浏览器解析到它时还没有绘制任何内容，中文用户不会先看到一帧英文。
 *
 * 判断顺序与 src/clientModules/locale-detect.js / src/pages/index.tsx 一致：
 *   1. 显式选择（`docusaurus_locale` cookie 或 localStorage）存在
 *      → 按用户选择，什么都不做；
 *   2. `docusaurus_locale_auto` 存在 → 自动判断已经跑过，不再自动跳转
 *      （避免每次访问英文页都被弹回中文）；
 *   3. 否则看 navigator.languages[0]（首选语言），以 zh 开头才继续；
 *   4. 当前路径必须在 baseUrl 下（同一个域名上的其它站点/陈旧路径不动）；
 *   5. 写 `docusaurus_locale_auto`（一年；**不写** `docusaurus_locale`）
 *      后再 location.replace，跳转后的页面看到标记就不会再跳，不会循环。
 *
 * 跳转目标是**中文站**（`LOCALE_ZH_URL` + `LOCALE_ZH_BASE_URL`，另一个
 * 仓库/另一个 Pages 站点）上同一路径；本仓库只构建 `en`，产物里没有
 * `build/zh-Hans/`，所以不能再像双语同仓时那样拼 `base + zh-Hans`。
 *
 * baseUrl 与中文站基址在构建期内联进字符串（JSON.stringify），运行时不再猜。
 * 脚本被禁用时 src/pages/index.tsx 的 useEffect 仍然兜底。
 */
function localeRedirectScript(base: string, zh: string): string {
  return `(function(){try{
var base=${JSON.stringify(base)};
var zh=${JSON.stringify(zh)};
var EXPLICIT=${JSON.stringify(LOCALE_COOKIE)};
var AUTO=${JSON.stringify(AUTO_LOCALE_COOKIE)};
var m=document.cookie.match(/(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)/);
if(m&&m[1])return;
try{if(window.localStorage&&window.localStorage.getItem(EXPLICIT))return}catch(e){}
if(document.cookie.match(/(?:^|;\\s*)${AUTO_LOCALE_COOKIE}=([^;]*)/))return;
try{if(window.localStorage&&window.localStorage.getItem(AUTO))return}catch(e){}
var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||''];
var first=String(langs[0]||'').toLowerCase();
if(first.indexOf('zh')!==0)return;
var p=location.pathname||'/';
if(p.indexOf(base)!==0)return;
var rest=p.slice(base.length-1);
if(rest==='/404.html')return;
try{if(window.localStorage)window.localStorage.setItem(AUTO,'zh-Hans')}catch(e){}
document.cookie=AUTO+'=zh-Hans; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax';
location.replace(zh+rest+location.search+location.hash);
}catch(e){}})();`;
}

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
        // 中文站（另一个 Pages 站点）的绝对基址，不含尾斜杠。客户端模块与
        // 落底页据此拼跨仓入口，不再假设 `baseUrl + zh-Hans` 一定存在。
        {
          tagName: 'meta',
          attributes: {
            name: 'docusaurus-zh-home',
            content: zhHome,
          },
        },
        // 必须排在 meta 之后：脚本本身不读 meta，但顺序保证客户端模块和
        // 兜底页面拿到的都是同一个构建期值。
        {
          tagName: 'script',
          attributes: {},
          innerHTML: localeRedirectScript(content, zhHome),
        },
      ],
    }),
  };
}

const config: Config = {
  title: 'RouterOS Manual',
  tagline: 'MikroTik RouterOS documentation, hardware guides, news and CLI reference',
  // `SiteMetadataDefaults`（@docusaurus/core 的 client App，不可 swizzle）渲染
  // `<link rel="icon" href={useBaseUrl(favicon)}>`：在 zh-Hans 页面上它会指向
  // `/…/zh-Hans/img/favicon.svg`，而 `tools/build/slim.mjs` 删掉了该副本，于是
  // 水合后浏览器重新请求 favicon 会 404（改 client module 只能事后补，仍会
  // 先发一次错误请求）。`favicon` 是可选字段：不声明它，默认的 icon 标签就
  // 不会渲染；favicon 改由下面的 `headTags` 用不带 locale 的 `assetBaseUrl`
  // 静态注入，SSR 与客户端一致。
  // Locale-independent asset root for client-side references; see the
  // `assetBaseUrl` comment at the top of this file.
  customFields: {assetBaseUrl, siteLocale},

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
    defaultLocale: 'en',
    // 两个语种都必须声明：语言下拉（`localeDropdown`）与每页的 hreflang
    // 都按这个列表生成入口，删掉 zh-Hans 中文入口就消失了。
    // 但本仓库只**构建** en（`SITE_LOCALE`），中文页面由另一个仓库产出。
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      // 英文站自己：url/baseUrl 与站点顶层一致，hreflang/canonical 指向本站。
      en: {label: 'English', url: siteUrl, baseUrl, direction: 'ltr', htmlLang: 'en'},
      'zh-Hans': {
        label: '简体中文',
        // 跨仓入口：绝对地址与路径前缀都指向中文站，不是本产物的子目录。
        // 有了这两个字段，Docusaurus 生成的语言下拉链接、`hreflang`
        // 与 `og:locale:alternate` 全部指向中文站。
        url: zhSiteUrl,
        baseUrl: zhBaseUrl,
        direction: 'ltr',
        htmlLang: 'zh-Hans',
        // 本仓库没有 `i18n/zh-Hans/` 语料：写 translation 清单的工具跳过它，
        // 免得把中文站的词条又抄一份进英文仓。
        translate: false,
      },
    },
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
        href: `${assetBaseUrl}img/favicon.svg`,
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
    image: `${siteUrl.replace(/\/$/, '')}${assetBaseUrl}img/logo.svg`,
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
