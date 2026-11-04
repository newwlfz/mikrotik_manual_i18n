import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const siteUrl = process.env.SITE_URL || 'https://mirror.invalid';
const baseUrl = process.env.BASE_URL || '/';

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

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          lastVersion: '7.24',
          onlyIncludeVersions: ['7.24'],
          versions: {
            '7.24': {
              label: '7.24',
              path: '7.24',
              badge: true,
            },
          },
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
