import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'RouterOS Manual',
  tagline: 'MikroTik RouterOS documentation, hardware guides, news and CLI reference',
  favicon: 'img/favicon.svg',

  // The public mirror URL is intentionally not the official origin. It is
  // replaced when the repository is deployed.
  url: 'https://mirror.invalid',
  baseUrl: '/',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
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
      title: 'RouterOS Manual',
      logo: {
        alt: 'MikroTik',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'introduction',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/hardware/',
          label: 'Hardware',
          position: 'left',
        },
        {
          to: '/docs/cli-reference/compare-versions/',
          label: 'Compare Versions',
          position: 'left',
        },
        {
          to: '/blog/',
          label: 'Blog',
          position: 'left',
        },
        {
          to: '/changelog/',
          label: 'Changelog',
          position: 'left',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            {label: 'Discord', href: 'https://discord.gg/exGj6whYw7'},
            {label: 'Forum', href: 'https://forum.mikrotik.com/'},
          ],
        },
        {
          title: 'MikroTik',
          items: [{label: 'mikrotik.com', href: 'https://mikrotik.com/'}],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} MikroTik.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
