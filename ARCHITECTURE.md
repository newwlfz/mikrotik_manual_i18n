# Architecture

This document describes the site repository and its relationship to the
workspace around it. The repository is intentionally site-only.

## 1. Workspace layout

```text
~/mikrotik_manual_i18n/
├─ repo/                    # GitHub repository: Docusaurus site only
├─ pipeline/                # fetch, transform, CLI, state, verify
├─ data/                    # sync state, manifests, CLI JSON
├─ reports/                 # build, sync and visual evidence
├─ session-archive/         # transcript, summaries, fragments, index
├─ vendor/                  # official CSS/JS/static snapshots, browsers
├─ work/                    # resumable scratch, git-ignored
├─ incoming/                # audited legacy extraction staging
├─ mikrotik-docs-i18n/      # legacy, to delete
└─ mikrotik_manual_i18n/    # legacy, to delete
```

`repo/` is the only directory intended for a Git remote. Everything else is a
sibling and must not be copied into the repository.

Consequence: the GitHub repository contains the site and its content, not the
synchronisation tooling. If the tooling must be published later, it becomes a
second repository; it does not move into `repo/`.

## 2. Repository layout

```text
repo/
├─ docusaurus.config.ts
├─ sidebars.ts
├─ sidebars-hardware.ts
├─ versions.json                        # ["7.24"]
├─ versioned_docs/
│  └─ version-7.24/                     # English RouterOS 7.24
├─ versioned_sidebars/
│  └─ version-7.24-sidebars.json
├─ hardware/                            # English Hardware Guides
├─ blog/                                # English Product news
├─ changelog/                           # English Docs Changes
├─ i18n/<locale>/                       # phase-2 translation overlays
├─ src/
│  ├─ pages/index.tsx                   # home
│  ├─ pages/docs/cli-reference/compare-versions.tsx
│  ├─ components/ArgTable/
│  ├─ components/CliCompare/
│  ├─ theme/
│  └─ css/custom.css
├─ static/
│  ├─ img/
│  ├─ hardware/
│  └─ blog/
├─ package.json
├─ package-lock.json
├─ tsconfig.json
└─ README.md
```

No `pipeline/`, `data/`, `reports/`, `session-archive/`, `vendor/` or `work/`
inside this tree.

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
- `docs/index.md` is a current-version placeholder that the version filter
  excludes. It exists only because the docs plugin expects a current source
  directory.

A build spike proved that Docusaurus 3.10.1 produces the required routes:
`/docs/7.24/introduction/`, `/hardware/`, `/blog/`, `/changelog/`.

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

The two blog instances have separate feeds, archives and sidebars.

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
| CLI compare | `data/cli/7.24/en.json` (outside repo) | `data/cli/7.24/<locale>.json` | `/<locale>/docs/cli-reference/compare-versions/` |
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

## 5. Official CSS and JavaScript

**Reused verbatim where safe**

- Logo, favicon, fonts, icons, Open Graph images.
- Standalone third-party assets that do not embed the official route map.
- Separable custom CSS rules and theme variables.

**Regenerated**

- Docusaurus `main.js` and `runtime~main.js`.
- CSS Modules with build-hashed class names.

There is no supported JavaScript override layer equivalent to CSS. Official
bundles contain the official route/chunk map and the 7.24/7.25/7.26 content
manifest. Injecting them into this build would create a second runtime and
request official data. The lower-work, lower-risk path is:

1. pin the exact Docusaurus version;
2. regenerate the runtime;
3. use official CSS/DOM as the comparison baseline;
4. copy the small custom layer that is separable.

Official snapshots and SHA-256 values live in
`../vendor/official/3.10.1/manifest.json`. They are not part of the site build.

## 6. Incremental workflow

The synchroniser lives in `../pipeline/`. It writes state to
`../data/sync_state.json` and never writes scratch into `repo/`.

Modes:

- `--full` — fetch all inventory items.
- `--check` — compare state, local files and remote validators.
- `--repair` — restore missing or hash-mismatched files.
- `--only=docs,hardware,blog,changelog,assets` — bounded runs.
- `--dry-run` — report only.

For HTML-only sections (Hardware, Blog, Changelog), the stored hash is the hash
of the normalised Markdown, not raw HTML. Raw snapshots live in
`../work/html/`.

A missing local file is always repairable, even when the remote page is
unchanged. This is the deletion drill requirement.

## 7. Legacy content reuse

The old `mikrotik_manual_i18n/repo/site` is read-only input, not authority.

| Section | Legacy | Official target | Gap |
| --- | ---: | ---: | ---: |
| 7.24 docs | 1,412 | 1,418 | 6 |
| Hardware | 250 | 250 | 0 |
| Product news | 6 | 10 | 4 |
| Docs Changes | 97 | 132 | 35 |

Promotion rules:

1. Copy candidates to `../incoming/legacy/`, never directly into `repo/`.
2. Normalise the body and compare its hash with the official source.
3. Promote only hash-matching content; re-fetch changed or missing pages.
4. Move `source` / `captured_at` metadata into manifests or strip it.
5. Leave the old directories untouched.

Before the old directories are deleted, copy
`mikrotik_manual_i18n/.browsers/chrome-linux64/` to
`../vendor/browsers/chrome-linux64/` so the visual verifier can run offline.

## 8. Git policy

- Repository root: `repo/`.
- Branch: `main`.
- No remote during phase 1.
- No GitHub Actions.
- Only site code and content are committed.
- `node_modules/`, `build/`, `.docusaurus/` and logs are ignored.
- Tooling, state, reports and the session archive are outside the repository.
