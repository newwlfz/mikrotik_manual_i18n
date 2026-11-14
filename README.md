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

npm run locales:check          # validate locales.json (no network)
npm run content:publish:dry    # print the docs/ + locales.json publish plan
npm run content:publish        # push to the language repos (needs CROSS_REPO_TOKEN)
```

Deployment knobs (all optional, each has a working default):

| Variable | Default | Meaning |
| --- | --- | --- |
| `SITE_URL` | the build locale's `site` origin in `locales.json` | This site's origin (`canonical`, `hreflang`) |
| `BASE_URL` | the build locale's `baseUrl` in `locales.json` | This site's path prefix |
| `SITE_LOCALE` | `locales.json` `default` (`en`) | The single locale this build produces (`docusaurus build --locale`) |
| `LOCALE_EN_URL` / `_BASE_URL` | `locales.json` entry for `en` | English site origin / path prefix |
| `LOCALE_ZH_URL` / `_BASE_URL` | `locales.json` entry for `zh-Hans` | Chinese site origin / path prefix |
| `ASSET_ORIGIN` | unset (local assets) | Shared asset origin for localized sites: the hub's site base address, with its path prefix and no trailing slash. The Chinese build sets `/img/`, `/assets/`, `/videos/`, `/official/` and `/cli/` references to it; this repository leaves it unset. See `guides/CI.md`. |
| `ASSET_HOST` | unset | Asset-host build: `slim` keeps the full `build/img` tree (~99 MiB) so localized sites can load `/img/…`; set on the `build` job in `pages.yml` |
| `BUILD_HEAP_MB` | `10240` | Node heap for the build (`npm run build:lowmem` uses 6144) |

Every language repository carries **the same `docusaurus.config.ts` file** and
supplies its own side through `SITE_LOCALE`/`SITE_URL`/`BASE_URL` (or the
`LOCALE_<X>_*` overrides), so no site-specific literal lives in the config. A
language site does not ship `static/`: its assets come from the hub through
`ASSET_ORIGIN`.

A local acceptance build:

```bash
SITE_URL=http://127.0.0.1:3013 BASE_URL=/mikrotik_manual_i18n/ SITE_LOCALE=en npm run build
npm run verify:deploy
```

## Architecture: hub + language sites

This repository is the **hub**. It owns the corrected English source, the
shared asset tree and the language registry; each translated site is a separate
repository with its own translations, build and deployment.

```text
hub  newwlfz/mikrotik_manual_i18n
     docs/  static/  data/  locales.json
       |
       +-- build + deploy (pages.yml)
       |     -> https://newwlfz.github.io/mikrotik_manual_i18n/
       |
       +-- publish-content (pages.yml, CROSS_REPO_TOKEN)
             |  docs/ + locales.json, one commit, only when something changed
             v
     language site  newwlfz/mikrotik_manual_zh_hans
       i18n/zh-Hans/ (own overlays)   docs/ (synced)   locales.json (synced)
       |
       +-- translate + build + deploy (its own pages.yml)
             -> https://newwlfz.github.io/mikrotik_manual_zh_hans/
```

**What the hub publishes.** For every non-default locale in `locales.json` the
`publish-content` job clones that locale's repository, replaces its `docs/`
tree with the hub's (pages deleted here disappear there), writes the hub's
`locales.json`, and commits only if `git status --porcelain` is non-empty. The
push triggers the language repository's `pages.yml` (translate → build →
deploy). The destination's `i18n/`, `config/` and `work/` are never touched.
Failure isolation, the full data flow and the security model are in
[`guides/ARCHITECTURE-MULTISITE.md`](guides/ARCHITECTURE-MULTISITE.md); the
accepted decisions and their trade-offs are in
[`guides/DECISIONS.md`](guides/DECISIONS.md).

**`locales.json`** (repository root) is the single source of truth for the
locale list and every deployment address:

| Field | Meaning |
| --- | --- |
| `default` | Locale the hub builds; must be `en` (`npm run locales:check` enforces it) |
| `locales.<tag>.label` | Name shown in the navbar language dropdown |
| `locales.<tag>.repo` | `owner/name` of the repository that builds this locale |
| `locales.<tag>.baseUrl` | GitHub Pages path prefix; must start and end with `/` |
| `locales.<tag>.site` | Absolute site URL (origin + `baseUrl`); used for `hreflang` and language links |

`docusaurus.config.ts` derives `i18n.locales` and `localeConfigs` from this
file, and `tools/lib/site-config.mjs` uses it for the build and verification
tools. `SITE_URL`, `BASE_URL` and the `LOCALE_<X>_*` environment variables
still override it for local previews and forks.

**`CROSS_REPO_TOKEN`.** A GitHub fine-grained personal access token with
**Contents: Read and write** on the language repositories (nothing on the hub).
It is stored as an Actions secret in **this (hub) repository**: *Settings →
Secrets and variables → Actions → New repository secret →
`CROSS_REPO_TOKEN`*. Only `publish-content` uses it; that job keeps
`contents: read` because the PAT is not limited by this repository's workflow
permissions. A missing secret fails the job with an explicit error, never a
silent skip. Locally: `export CROSS_REPO_TOKEN=…` then
`npm run content:publish`; the dry run does not need it.

**Adding a language.**

1. Create the repository with the same `docusaurus.config.ts` and tooling, and
   its own `pages.yml` (translate + build + deploy).
2. Add an entry to `locales.json` — key = BCP 47 tag, plus `label`, `repo`,
   `baseUrl`, `site`. Locale-specific environment overrides, if needed, are
   `LOCALE_<PRIMARY_SUBTAG>_URL` / `_BASE_URL` (`zh-Hans` → `ZH`).
3. Run `npm run locales:check` and `npm run content:publish:dry` (no network).
4. Run `npm run content:publish -- --only=<tag>` once locally, or let the next
   push to `main` do it, then confirm the language repository's workflow
   started.

### Cross-repository language entry

`docusaurus.config.ts` declares every locale in `locales.json` but each build
produces exactly one of them:

- the build's own locale — `url = SITE_URL`, `baseUrl = BASE_URL`, and
  `translate: true`, so its own `i18n/<locale>/` overlays are used;
- every other locale — the declared `site`/`baseUrl`, with `translate: false`.
  No `i18n/` overlay for another locale exists in this repository.

Because every `localeConfigs` entry carries its own `url`/`baseUrl`, Docusaurus
generates the language dropdown, the per-page `hreflang` alternates and
`og:locale:alternate` for the other sites without building any page for them.
`tools/build/index.mjs` builds with `--locale en` only, so `build/zh-Hans/`
never exists; the Chinese base URL is injected into
`<meta name="docusaurus-zh-home">` and the build's own locale into
`<meta name="docusaurus-site-locale">`. The head script,
`src/clientModules/locale-detect.js` and `src/pages/index.tsx` only run the
Chinese-browser redirect from the default locale — the Chinese build of the
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
- `tools/content/` — the locale registry (`locales.js`, `check-locales.mjs`)
  and the cross-repository publisher (`publish.mjs`).

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
