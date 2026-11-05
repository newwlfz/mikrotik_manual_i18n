import fs from 'node:fs';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const siteUrl = process.env.SITE_URL || 'https://mirror.invalid';
const baseUrl = process.env.BASE_URL || '/';
const versionedRoot = 'versioned_docs';
const availableVersions = fs.existsSync(versionedRoot)
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
  : ['7.24'];
const latestVersion = availableVersions.at(-1)!;
const currentRedirectTargets = new Set<string>();

const config: Config = {
  title: 'RouterOS Manual',
  tagline: 'MikroTik RouterOS documentation, hardware guides, news and CLI reference',
  favicon: 'img/favicon.svg',

  // The public mirror URL is intentionally not the official origin. It is
  // replaced when the repository is deployed.
  url: siteUrl,
  baseUrl,

  onBrokenLinks: process.env.STRICT_LINKS === 'true' ? 'throw' : 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: process.env.STRICT_LINKS === 'true' ? 'throw' : 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Official width preference survives client-side route changes because the
  // document class is re-applied whenever Docusaurus replaces it.
  headTags: [
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
          lastVersion: latestVersion,
          onlyIncludeVersions: availableVersions,
          versions: Object.fromEntries(
            availableVersions.map((version) => [
              version,
              {label: version, path: version, badge: true},
            ]),
          ),
        },
        blog: {
          routeBasePath: 'blog',
          path: 'blog',
          blogTitle: 'Product news',
          blogDescription: 'MikroTik product news',
          showReadingTime: true,
          onUntruncatedBlogPosts: 'ignore',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [{from: '/docs', to: `/docs/${latestVersion}/introduction`}],
        createRedirects(existingPath) {
          const prefix = `/docs/${latestVersion}/`;
          if (existingPath === prefix) return ['/docs/'];
          if (existingPath.endsWith('/index')) return undefined;
          if (existingPath.startsWith(prefix)) {
            const target = existingPath.replace(prefix, '/docs/');
            const key = target.replace(/\/$/, '');
            if (currentRedirectTargets.has(key)) return undefined;
            currentRedirectTargets.add(key);
            return [target];
          }
          return undefined;
        },
      },
    ],
    [
      'docusaurus-plugin-llms',
      {
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        generateMarkdownFiles: true,
        docsDir: [
          {
            path: `versioned_docs/version-${latestVersion}`,
            routeBasePath: 'docs',
          },
        ],
        versions: [
          {
            name: 'current',
            label: latestVersion,
            docsDir: [
              {
                path: '.generated/current-docs',
                routeBasePath: 'docs',
              },
            ],
            path: '',
            routePrefix: '',
          },
          ...availableVersions.map((version) => ({
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
      },
    ],
  ],

  themeConfig: {
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    image: 'img/logo.svg',
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
            {label: 'Introduction', to: '/docs/7.24/introduction'},
            {label: 'CLI Reference', to: '/docs/7.24/cli-reference/'},
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
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
