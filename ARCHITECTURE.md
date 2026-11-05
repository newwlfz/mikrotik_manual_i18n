# Architecture

This repository is the complete site + automation project. Runtime scratch,
official snapshots and the conversation archive remain outside it.

## 1. Workspace layout

```text
~/mikrotik_manual_i18n/
├─ repo/                    # GitHub project: site + tools + config + state
├─ session-archive/         # conversation history, not part of the site
├─ vendor/                  # official CSS/JS/static snapshots, local Chrome
├─ work/                    # resumable scratch, never pushed
├─ incoming/                # legacy content audit staging
├─ reports/                 # local verification evidence
├─ pipeline/archive/        # DSH transcript exporter
├─ mikrotik-docs-i18n/      # legacy, to delete
└─ mikrotik_manual_i18n/    # legacy, to delete
```

`repo/` contains everything needed to run the automation on GitHub: site,
tools, configs, state and workflows.

`session-archive/`, `vendor/`, `work/`, `incoming/`, `reports/` and the
transcript exporter are local-only. They are deliberately not part of the
repository.

## 2. Repository layout

```text
repo/
├─ .github/workflows/
│  ├─ ci.yml                         # pull-request build
│  ├─ pages.yml                      # build + deploy on main
│  └─ sync.yml                       # scheduled detect/update/translate/build
├─ config/
│  ├─ mirror.yml                     # source, versions, sections, locales
│  ├─ translation.yml                # provider, model, glossary, preserve rules
│  └─ glossary/zh-Hans.yml
├─ tools/
│  ├─ sync/                          # inventory, fetch, render, transform, state
│  ├─ translate/                     # config-driven Markdown translation
│  └─ verify/                        # link, asset and inventory checks
├─ state/
│  ├─ sync_state.json                # committed source/local hashes
│  └─ translation_state.json         # per-locale source/target hashes
├─ data/
│  ├─ cli/7.24/en.json               # CLI comparison model
│  └─ manifests/                     # canonical inventory snapshots
├─ versioned_docs/version-7.24/      # English RouterOS 7.24
├─ versioned_sidebars/
├─ hardware/                         # English Hardware Guides
├─ blog/                             # English Product news
├─ changelog/                        # English Docs Changes
├─ i18n/<locale>/                    # phase-2 translation overlays
├─ src/
│  ├─ pages/index.tsx
│  ├─ pages/docs/cli-reference/compare-versions.tsx
│  ├─ components/{ArgTable,CliCompare}/
│  ├─ theme/
│  └─ css/custom.css
├─ static/{img,hardware,blog}/
├─ docusaurus.config.ts
├─ sidebars.ts
├─ sidebars-hardware.ts
├─ versions.json
├─ package.json
├─ package-lock.json
└─ tsconfig.json
```

`state/` and `data/` are intentional exceptions to "content only": the
scheduled workflow needs committed hashes and generated CLI data to work
without an external database.

## 3. Docusaurus plugin routing

### 3.1 RouterOS docs

Default docs plugin, versioned:

```ts
docs: {
  routeBasePath: 'docs',
  sidebarPath: './sidebars.ts',
  lastVersion: '7.24',
  onlyIncludeVersions: ['7.24'],
}
```

- `versions.json`: `["7.24"]`
- Public URL: `/docs/7.24/...`
- `/docs/` is not published.
- `docs/index.md` is a current-version placeholder excluded by the version
  filter; it exists because the docs plugin expects a current source directory.

The route spike verified `/docs/7.24/introduction/`, `/hardware/`, `/blog/`,
`/changelog/`, and the literal CLI Compare URL.

### 3.2 Hardware

Separate `@docusaurus/plugin-content-docs` instance:

```ts
{
  id: 'hardware',
  path: 'hardware',
  routeBasePath: 'hardware',
  sidebarPath: './sidebars-hardware.ts',
}
```

### 3.3 Product news

`@docusaurus/plugin-content-blog`, route `/blog`, path `blog`.

### 3.4 Docs Changes

Second blog plugin instance:

```ts
{
  id: 'changelog',
  path: 'changelog',
  routeBasePath: 'changelog',
  blogTitle: 'Docs Changes',
}
```

### 3.5 CLI Compare

Official page: `/docs/cli-reference/compare-versions/`, MDX with
`<CliCompare />`, hosted upstream inside the current 7.26 docs.

Because phase 1 has no current docs version, the literal URL is served by a
standard pages route:

```text
repo/src/pages/docs/cli-reference/compare-versions.tsx
→ /docs/cli-reference/compare-versions/
```

This is a compatibility shim, not a new content mechanism. It shares the CLI
data model with the future versioned page. The earlier 7.24-scoped spike page
was removed to avoid two public URLs.

## 4. Multilingual layout

English is canonical and lives in the normal Docusaurus directories. Every
other locale is an overlay with the same relative paths.

| Section | English source | Translation overlay | Route |
| --- | --- | --- | --- |
| RouterOS 7.24 | `versioned_docs/version-7.24/` | `i18n/<locale>/docusaurus-plugin-content-docs/version-7.24/` | `/<locale>/docs/7.24/...` |
| Hardware | `hardware/` | `i18n/<locale>/docusaurus-plugin-content-docs-hardware/current/` | `/<locale>/hardware/...` |
| Product news | `blog/` | `i18n/<locale>/docusaurus-plugin-content-blog/` | `/<locale>/blog/...` |
| Docs Changes | `changelog/` | `i18n/<locale>/docusaurus-plugin-content-blog-changelog/` | `/<locale>/changelog/...` |
| CLI compare | `data/cli/7.24/en.json` | `data/cli/7.24/<locale>.json` | `/<locale>/docs/cli-reference/compare-versions/` |
| Navbar/footer | theme config | `i18n/<locale>/docusaurus-theme-classic/` | locale-prefixed |
| UI strings | source strings | `i18n/<locale>/code.json` | locale-prefixed |

Rules:

- Same file names and slugs as English.
- Model numbers, CLI tokens, command paths and type names stay unchanged.
- Prose, headings, table descriptions, navigation labels and compare legend
  are translated.
- Missing translations fall back to English; partial locales are valid.
- No language switcher in phase 1. `locales` stays `['en']` until phase 2.
- The exact plugin-folder suffix for the `hardware` and `changelog` instances
  is verified during translation scaffolding.

## 5. Configuration-driven automation

`config/mirror.yml` is the switchboard:

```yaml
source:
  versions: ["7.24"]
  sections: [docs, hardware, blog, changelog]
locales:
  en: {enabled: true, translate: false}
  zh-Hans: {enabled: false, translate: true}
translation:
  enabled: false
```

To add a language, change the locale flags and set translation to true. The
workflow reads the same file; no code edit is required.

`config/translation.yml` controls provider, model, glossary, batch size and the
structures that must be preserved. The API key is read from the environment
variable named there (`DEEPSEEK_API_KEY` by default).

## 6. Workflow design

### `ci.yml`

Pull requests and manual runs: `npm ci`, `npm run build`.

### `pages.yml`

Push to `main`: build with `SITE_URL` / `BASE_URL`, upload the Pages artifact,
deploy. This is the only deployment path.

### `sync.yml`

Scheduled daily and manually dispatchable. It is feature-flagged with the
repository variable `ENABLE_SYNC=true`; it stays disabled until the sync tool
is implemented and verified.

When enabled in phase 1:

1. check the official site and update English content;
2. build;
3. commit content + state if anything changed;
4. the push triggers `pages.yml`.

Translation is a separate phase-2 step. It is not part of the phase-1
workflow.

This avoids a bot commit loop: `sync.yml` runs on a schedule/manual dispatch,
while `pages.yml` runs on the resulting push.

## 7. Official CSS and JavaScript

**Reused verbatim where safe**

- Logo, favicon, fonts, icons, Open Graph images.
- Standalone third-party assets that do not embed the official route map.
- Separable custom CSS rules and theme variables.

**Regenerated**

- Docusaurus `main.js` and `runtime~main.js`.
- CSS Modules with build-hashed class names.

There is no supported JavaScript override layer equivalent to CSS. Official
bundles contain the official route/chunk map and the 7.24/7.25/7.26 content
manifest. Injecting them would create a second runtime and request official
data. The lower-work, lower-risk path is:

1. pin the exact Docusaurus version;
2. regenerate the runtime;
3. use official CSS/DOM as the comparison baseline;
4. copy the small custom layer that is separable.

Official snapshots and SHA-256 values live in
`../vendor/official/3.10.1/manifest.json`. They are not part of the build.

## 8. Incremental synchronisation

`state/sync_state.json` is committed. Modes:

- `--full` — fetch all inventory items.
- `--check` — compare state, local files and remote validators.
- `--repair` — restore missing or hash-mismatched files.
- `--only=docs,hardware,blog,changelog,assets` — bounded runs.
- `--dry-run` — report only.

For HTML-only sections (Hardware, Blog, Changelog), the stored hash is the hash
of the normalised Markdown, not raw HTML. Raw snapshots go to `.work/`.

A missing local file is always repairable, even when the remote page is
unchanged. This is the deletion drill requirement.

## 8.1 Version/current rule

`versioned_docs/version-*` is the source of truth produced by the external
content workflow. The Docusaurus build discovers the newest semver directory
and uses it for:

- the `/docs/*` client redirect (currently to `/docs/7.24/*`);
- the current `llms.txt` / `.md` source (`.generated/current-docs`);
- the next version automatically, without editing route tables.

The versioned routes stay addressable. `tools/sync/materialize-current.mjs`
only rewrites `/docs/<latest>/` links to `/docs/` for the current LLM copies;
it does not duplicate HTML pages.

## 9. Current inventory and legacy reuse

The legacy project was used as the localised image/body baseline, then the
official gaps were fetched. Current imported inventory:

| Section | Local | Official target | Status |
| --- | ---: | ---: | --- |
| RouterOS 7.24 | 1,422 | 1,418 | complete, including compatibility pages |
| Hardware | 250 | 250 | complete |
| Product news | 6 | 6 | complete |
| Docs Changes | 108 | 108 | complete |
| CLI Reference | 1,054 commands | 1,055 commands | one root-level command pending |

`STRICT_LINKS=true npm run build` succeeds with zero broken links. Pagefind
indexes 1,810 output pages.

Deletion drill:

1. remove one docs, one hardware and one blog file;
2. `node tools/sync/index.mjs --check` reports exactly three missing entries;
3. `node tools/sync/index.mjs --repair` restores all three;
4. `--check` returns `missing=0 changed=0`.

Promotion rules remain: legacy content is read-only input, and only verified
content is copied into the repository.

## 10. Git policy

- Repository root: `repo/`.
- Branch: `main`.
- Site, tools, config, state and workflows are committed.
- No remote during local phase 1.
- `node_modules/`, `build/`, `.docusaurus/`, `.work/` and logs are ignored.
- `session-archive/`, `vendor/`, `incoming/`, `reports/` and `work/` stay
  outside the repository.
