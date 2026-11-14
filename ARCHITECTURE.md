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
└─ pipeline/archive/        # DSH transcript exporter
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
│  ├─ mirror.yml                     # source, versions, sections
│  ├─ translation.yml                # glossary, batch, preserve, provenance label
│  └─ glossary/zh-Hans.yml
├─ tools/
│  ├─ sync/                          # inventory, fetch, render, transform, state
│  ├─ translate/                     # config-driven Markdown translation
│  └─ verify/                        # link, asset and inventory checks
├─ state/
│  ├─ sync_state.json                # committed source/local hashes
│  └─ translation_state.json         # per-locale source/target hashes
├─ data/
│  ├─ cli/<version>/en.json          # per-version CLI comparison model
│  └─ manifests/                     # canonical inventory snapshots
├─ docs/                             # current RouterOS (data/manifests/current-version.json)
├─ versioned_docs/version-<version>/ # English RouterOS snapshots (versions.json)
├─ versioned_sidebars/
├─ hardware/                         # English Hardware Guides
├─ blog/                             # English Product news
├─ changelog/                        # English Docs Changes
├─ i18n/<locale>/                    # phase-2 translation overlays
├─ src/
│  ├─ pages/index.tsx
│  ├─ components/{ArgTable,CliCompare,CliReferenceLinks}/
│  ├─ theme/
│  └─ css/custom.css
├─ static/{img,hardware,blog,cli}/
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

Default docs plugin, native versioning:

```ts
docs: {
  routeBasePath: 'docs',
  sidebarPath: './sidebars.ts',
  lastVersion: 'current',
  versions: {
    // The current label is read from data/manifests/current-version.json.
    current: {label: currentVersion, badge: true, banner: 'none'},
    // One entry per version listed in versions.json.
    ...snapshots,
  },
}
```

- `versions.json` lists the archived versions (`data/manifests/current-version.json`
  names the current one); Docusaurus inserts `current` automatically.
- Public URL: `/docs/...` for the current version.
- Historical URL: `/docs/<version>/...` for each entry in `versions.json`.
- `/docs/<current>/...` is intentionally absent, matching the official
  current-version model.
- `docs/` is the current source; `versioned_docs/version-<version>/` is a
  historical snapshot; `versioned_sidebars/version-<version>-sidebars.json` is
  its native JSON sidebar.
- The navbar `docsVersionDropdown` becomes a native dropdown as soon as more
  than one version exists; no custom component is used.

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
`<CliCompare />`. It is a native current-version docs page at
`docs/cli-reference/compare-versions.md`, so it gets the Docs sidebar,
breadcrumbs and version badge. No archive carries the page: it is listed in
`config/mirror.yml` under `sync.current_only_pages`, so `snapshot-version`
drops it from a new snapshot, `materialize` refuses to write it back into an
archive, and every link to it resolves to `/docs/cli-reference/compare-versions`
even from `/docs/<version>/...` (there is exactly one copy on the site).

The component loads `/cli/index.json`, then the per-version models under
`/cli/<version>.json`. `tools/cli/build-all.mjs` writes both the committed
`data/cli/<version>/en.json` files and the static copies. A single-version
install naturally reports zero differences; with more than one version present
it reports the real release diff.

## 4. Multilingual layout

English is canonical and lives in the normal Docusaurus directories. Every
other locale is an overlay with the same relative paths.

| Section | English source | Translation overlay | Route |
| --- | --- | --- | --- |
| RouterOS current | `docs/` | `i18n/<locale>/docusaurus-plugin-content-docs/current/` | `/<locale>/docs/...` |
| RouterOS snapshots | `versioned_docs/version-<version>/` | `i18n/<locale>/docusaurus-plugin-content-docs/version-<version>/` | `/<locale>/docs/<version>/...` |
| Hardware | `hardware/` | `i18n/<locale>/docusaurus-plugin-content-docs-hardware/current/` | `/<locale>/hardware/...` |
| Product news | `blog/` | `i18n/<locale>/docusaurus-plugin-content-blog/` | `/<locale>/blog/...` |
| Docs Changes | `changelog/` | `i18n/<locale>/docusaurus-plugin-content-blog-changelog/` | `/<locale>/changelog/...` |
| CLI compare | `data/cli/<version>/en.json` | `data/cli/<version>/<locale>.json` | `/<locale>/docs/cli-reference/compare-versions/` |
| Navbar/footer | theme config | `i18n/<locale>/docusaurus-theme-classic/` | locale-prefixed |
| UI strings | source strings | `i18n/<locale>/code.json` | locale-prefixed |

Rules:

- Same file names and slugs as English.
- Model numbers, CLI tokens, command paths and type names stay unchanged.
- Prose, headings, table descriptions, navigation labels and compare legend
  are translated.
- Missing translations fall back to English; partial locales are valid.
- The language switcher is the native `localeDropdown`; `locales` is
  `['en', 'zh-Hans']` with `localeConfigs` carrying the label and `htmlLang`.
- The plugin-folder suffix is `${pluginName}-${pluginId}` (verified against
  `getPluginI18nPath` in Docusaurus 3.10.1): `docusaurus-plugin-content-docs`,
  `-docs-hardware`, `-blog`, `-blog-changelog`, plus `current/` or
  `version-<v>/` for versioned docs.
- Every sidebar item carries an explicit `key`. The official sidebar repeats
  labels (`User Guides`, `interface`, `port`), and Docusaurus rejects a
  translation catalogue whose keys collide by label. `tools/sync/build-sidebars.mjs`
  assigns the keys so a regeneration stays correct.

### 4.1 Translation pipeline

`tools/translate/` is offline by default:

| Step | Command | Network |
| --- | --- | --- |
| Import the legacy translation memory (historical: the corpus is gone) | `translate:legacy` | no |
| Build overlays and sidebar catalogues | `translate:apply` | no |
| Structural verification | `translate:verify` | no |
| Translate the remaining English blocks | `translate --limit=N` | yes |

- The legacy corpus has been removed. `translate:harvest` recycles the existing
  overlays into the block memory before `apply`, and that overlay is the only
  Chinese draft (`guides/PIPELINE.md`, "harvest 先行"). The paragraphs the
  corpus once supplied came from the 7.25 and 7.24 legacy trees; its `current`
  tree was RouterOS 7.26 and could only serve non-versioned sections (hardware,
  blog, changelog), page-for-page, when the English body was identical.
- Matching erases version-prefixed links (`/docs/<version>/...` → `/docs/...`):
  the legacy captures link to their own version and that difference is a route,
  not a content change.
- A legacy file is reused verbatim when its recorded `source_sha` matches the
  current English body; only the horizontal rules the old pipeline dropped are
  restored from the English block sequence.
- A changed page is assembled block by block from the memory; the English
  separators and every fenced block are taken from the source, never from the
  translation.
- Relative image URLs are rebased onto the English source directory, because an
  overlay lives in a different directory and would otherwise resolve images
  inside the overlay.
- Model output is recorded in a local model memory, so a later `apply` cannot
  discard it.
- `state/translation-state.json` records per-file mode (`exact`, `exact+memory`,
  `memory`), hit/miss counts and pending blocks.

## 5. Configuration-driven automation

`config/mirror.yml` is the switchboard:

```yaml
source:
  versions: ["7.24"]
  sections: [docs, hardware, blog, changelog]
translation:
  enabled: false
```

Enabled locales and the source locale are **not** listed here: the single source
of truth is `i18n` in `docusaurus.config.ts` (`locales` / `defaultLocale`), read
by `tools/lib/site-config.mjs#resolveLocales()` and used by every translate
command (`--locale=<tag>`, default `zh-Hans`). Per-locale translation resources
follow a naming convention (`config/glossary/<locale>.yml`,
`config/translation-patches/<locale>/`, `work/translate/tm-global.<locale>.json`,
top-level key `<locale>` in `config/known-translations.yml`); the checklist for
adding a language is in `guides/PIPELINE.md`.

`config/translation.yml` controls the translation policy: glossary, batch size,
temperature, the structures that must be preserved and the provenance label
written to overlay front matter. The endpoint, model, API key, timeout and retry
budget come from `LLM_*` (`tools/translate/lib/llm-config.mjs`; see
`guides/LLM.md`) and are never committed.

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

When enabled:

1. check the official site and update English content;
2. download images from the official origin and prune unreferenced ones
   (`tools/sync/fetch-assets.mjs`);
3. prune pages the official inventory no longer lists (`tools/sync/prune-orphans.mjs`,
   with `sync.preserve_pages` protecting mirror-generated pages);
4. translate the changed units (`tools/translate`);
5. build;
6. commit content + state if anything changed;
7. the push triggers `pages.yml`.

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
bundles contain the official route/chunk map and the same content manifest the
official site serves. Injecting them would create a second runtime and request
official data. The lower-work, lower-risk path is:

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

`docs/` is the Docusaurus current source and is served at `/docs` without a
version prefix. Historical snapshots live in `versioned_docs/version-*` and are
served at `/docs/<version>`. This is the same layout as the official site: the
current release is `/docs`, and every archived release is `/docs/<version>`.
Which release is current here is `data/manifests/current-version.json`; which
ones are archived is `versions.json`.

The external content workflow writes the current version number to
`data/manifests/current-version.json` and the historical list to `versions.json`.
The version cut is pipeline-driven:

1. `tools/sync/snapshot-version.mjs --version <old>` copies `docs/` to
   `versioned_docs/version-<old>`, removes current-only pages, rewrites
   internal `/docs/` links to `/docs/<old>/`, adds the official `user-guides`
   landing page, writes `versioned_sidebars/version-<old>-sidebars.json` and
   updates `versions.json`.
2. `tools/sync/install-version.mjs --version <new> --source <dir>` installs the
   new tree into `docs/`, applies the official directory normalisation
   (for example `routing-and-networking-protocols` under `user-guides/`),
   rewrites versioned links to the current root, keeps current-only pages and
   updates `current-version.json`.
3. `tools/sync/sync-sidebars.mjs` regenerates every sidebar from the official
   site: it crawls each mirrored version (`crawl-sidebar.mjs`), then builds
   `sidebars.ts` for the current version and
   `versioned_sidebars/version-<old>-sidebars.json` for each historical one
   (`build-sidebars.mjs`). Each version has its own tree, so the historical
   sidebars are no longer derived by pruning the current one. `--no-crawl`
   rebuilds from the manifests already in `data/manifests/`.

   The crawler only sees categories it can open; several `*/install/` landing
   pages return 404 upstream, which hides whole subtrees. `build-sidebars.mjs`
   therefore merges every page that carries a `sidebar_key` back into its
   category (creating the category when the crawl dropped it) and inserts it at
   its own `sidebar_position`. Existing official order is never rewritten.
4. `npm run metadata:build` regenerates descriptions, tags, labels,
   categories, per-version CLI links and CLI models for every version.

`tools/sync/extract-doc-metadata.mjs` and `apply-doc-metadata.mjs` capture the
official full description, tags, sidebar labels and CLI-reference links. The
theme `DocItem/Content` wrapper renders the CLI-reference block from a
version-keyed manifest, so current and historical pages get their own hrefs.

## 9. Current inventory and legacy reuse

The legacy project was used as the localised image/body baseline, then the
official gaps were fetched. Counts are not asserted here: the local page count
is measured (`find docs -name '*.md*' | wc -l`, and the same for
`versioned_docs/`, `hardware/`, `blog/`, `changelog/`), the official target is
`upstream/<version>/manifest.json`, the current version is
`data/manifests/current-version.json` and the CLI command counts are in
`data/cli/<version>/en.json`.

- RouterOS current (`docs/`): complete, including the current-only compare page.
- RouterOS snapshots (`versioned_docs/version-*`): complete; four legacy
  duplicate routes collapse to the same doc ids.
- Hardware, Product news, Docs Changes: complete.
- CLI Reference: exact for the current version; an archived version may differ
  by the official `Headings` pseudo-command.

`STRICT_LINKS=true npm run build` succeeds with zero broken links. Pagefind
indexes every version.

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
- Remote: `https://github.com/newwlfz/mikrotik_manual_i18n.git`.
- `node_modules/`, `build/`, `.docusaurus/`, `.work/` and logs are ignored.
- `session-archive/`, `vendor/`, `incoming/`, `reports/` and `work/` stay
  outside the repository.
