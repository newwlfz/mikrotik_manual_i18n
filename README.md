# MikroTik Manual Mirror — English site

A source-faithful, version-aware mirror of <https://manual.mikrotik.com/>.
**This repository builds the English documentation site only.**

The Chinese site is a separate repository (`mikrotik_manual_zh_hans`) containing
the `zh-Hans` translation overlays and its own Docusaurus build. This repository
keeps a language **entry** to it (navbar dropdown, `hreflang`, the head-script
redirect) but no Chinese content and no `build/zh-Hans/` output — see
[Cross-repository language entry](#cross-repository-language-entry).

## Scope

- RouterOS documentation: the current version is served at `/docs/...` and the
  archived versions at `/docs/<version>/...`; which is which is recorded in
  `data/manifests/current-version.json` and `versions.json`, not here.
- Hardware Guides (`/hardware/...`).
- Product news (`/blog/`).
- Docs Changes (`/changelog/...`).
- CLI comparison at the literal official URL
  `/docs/cli-reference/compare-versions/`.
- English is the only built locale. `i18n.locales` still lists `zh-Hans` so the
  language dropdown and `hreflang` can point at the other repository.

## Commands

```bash
npm ci
SITE_LOCALE=en npm run build   # cli data + docusaurus build (en) + pagefind + llms.txt
npm run serve                  # or: npx docusaurus serve --port 3013 --no-open
```

Deployment knobs (all optional, each has a working default):

| Variable | Default | Meaning |
| --- | --- | --- |
| `SITE_URL` | `https://newwlfz.github.io` | This site's origin (`canonical`, `hreflang`) |
| `BASE_URL` | `/mikrotik_manual_i18n/` (or `/mikrotik_manual_zh_hans/` when `SITE_LOCALE=zh-Hans`) | This site's path prefix |
| `SITE_LOCALE` | `en` | The single locale this build produces (`docusaurus build --locale`) |
| `LOCALE_EN_URL` | `SITE_URL` | English site origin |
| `LOCALE_EN_BASE_URL` | `BASE_URL` for the English build, else `/mikrotik_manual_i18n/` | English site path prefix |
| `LOCALE_ZH_URL` | `SITE_URL` | Chinese site origin |
| `LOCALE_ZH_BASE_URL` | `BASE_URL` for the Chinese build, else `/mikrotik_manual_zh_hans/` | Chinese site path prefix |
| `BUILD_HEAP_MB` | `10240` | Node heap for the build (`npm run build:lowmem` uses 6144) |

The Chinese mirror (`repo_zh_hans`) carries **the same `docusaurus.config.ts`
file** and supplies the other side through these variables, so no site-specific
literal lives in the config.

A local acceptance build:

```bash
SITE_URL=http://127.0.0.1:3013 BASE_URL=/mikrotik_manual_i18n/ SITE_LOCALE=en npm run build
npm run verify:deploy
```

## Cross-repository language entry

`docusaurus.config.ts` declares two locales but only builds one:

- `en` — this site (`url = SITE_URL`, `baseUrl = BASE_URL`).
- `zh-Hans` — `url = LOCALE_ZH_URL`, `baseUrl = LOCALE_ZH_BASE_URL`. No
  `i18n/zh-Hans/` overlays live here, and `translate` is off in this build
  (`siteLocale === 'zh-Hans'` is false). The Chinese repository uses the same
  config file with `SITE_LOCALE=zh-Hans`, which turns content/theme
  translation on for its own overlay tree.

Because every `localeConfigs` entry carries its own `url`/`baseUrl`, Docusaurus
generates the language dropdown, the per-page `hreflang` alternates and
`og:locale:alternate` for the Chinese site without any Chinese page being
built. `tools/build/index.mjs` builds with `--locale en` only, so
`build/zh-Hans/` never exists; the Chinese base URL is injected into
`<meta name="docusaurus-zh-home">` and the build's own locale into
`<meta name="docusaurus-site-locale">`. The head script,
`src/clientModules/locale-detect.js` and `src/pages/index.tsx` only run the
Chinese-browser redirect when that locale is `en` — the Chinese build of the
same config therefore never redirects to itself.

## Route map

| Section | English (this repo) | Simplified Chinese (other repo) |
| --- | --- | --- |
| RouterOS current | `/docs/...` | `<LOCALE_ZH_BASE_URL>docs/...` |
| RouterOS snapshots | `/docs/<version>/...` | `<LOCALE_ZH_BASE_URL>docs/<version>/...` |
| Hardware | `/hardware/...` | `<LOCALE_ZH_BASE_URL>hardware/...` |
| Product news | `/blog/...` | `<LOCALE_ZH_BASE_URL>blog/...` |
| Docs Changes | `/changelog/...` | `<LOCALE_ZH_BASE_URL>changelog/...` |
| CLI compare | `/docs/cli-reference/compare-versions/` | `<LOCALE_ZH_BASE_URL>docs/cli-reference/compare-versions/` |

## Automation

- `config/mirror.yml` — source, versions, sections, locale switches.
- `state/sync_state.json` — committed source sync state. (Translation state
  lives in the Chinese repository.)
- `data/cli/<version>/` — generated CLI model.
- `tools/sync/` — content sync, version cut, sidebars, metadata.
- `tools/build/` — build wrapper (`index.mjs`), `slim.mjs`, `llms.mjs`.
- `tools/verify/` — deploy-shape assertions (`npm run verify:deploy`).

## Current status

- Inventory and build counts are measured, not asserted here: the current
  version is `data/manifests/current-version.json`, the archived versions are
  `versions.json`, the local page count is
  `find docs -name '*.md*' | wc -l` (same for `versioned_docs/`, `hardware/`,
  `blog/`, `changelog/`), and the official target is
  `upstream/<version>/manifest.json`.
- Monolingual build: one Docusaurus pass (`--locale en`), one Pagefind index,
  no `build/zh-Hans/`.
- `STRICT_LINKS=true npm run build` passes; remaining warnings are historical
  anchors inherited from the official pages.
- CLI compare between the current and the archived versions is generated from
  the official data.
- `docusaurus-plugin-llms` generates `/llms.txt`, `/llms-full.txt` and per-page
  `.md` files; `tools/build/llms.mjs` rewrites the indexes in menu order for the
  built locale only.
- Build with `npm run build`, never `npx docusaurus build`: the npm script runs
  Pagefind and the llms rewrite after Docusaurus, and the navbar search reads
  that index. A build without it leaves search disabled.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design.
