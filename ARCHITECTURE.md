# Architecture

This document is the reference for the repository layout. It is deliberately
written before content is imported so that the same rules apply to every later
incremental run.

## 1. Ground rules

1. **Official mechanism first.** The site runs Docusaurus **3.10.1**. This
   repository pins that version and uses `@docusaurus/preset-classic` plus the
   same plugin families the official site uses:
   - default docs plugin: versioned RouterOS docs;
   - a second docs plugin instance, id `hardware`, route `/hardware`;
   - a blog plugin instance for `/blog`;
   - a second blog plugin instance for `/changelog`;
   - the pages plugin for the home page and the CLI comparison shell.
2. **Content is not duplicated.** The Docusaurus content directories are the
   canonical English source. `data/` stores manifests, hashes, CLI indexes and
   sync state, not a second copy of every page.
3. **Every write is idempotent.** Re-running a sync step must produce the same
   bytes and the same state entry unless the official source changed.
4. **Nothing temporary enters content directories.** Throwaway downloads go to
   a system temporary directory. Resumable intermediate artefacts go to
   `work/`, which is git-ignored.
5. **The old sibling directories are invisible.** No script, glob, search, or
   build step may enter them.

## 2. Repository layout

```text
mikrotik-manual-mirror/                 # dedicated GitHub repository
├─ .git/
├─ README.md
├─ ARCHITECTURE.md
├─ package.json                         # Docusaurus app + command entry points
├─ package-lock.json
├─ docusaurus.config.ts
├─ sidebars.ts
├─ versions.json                        # ["7.24"] in phase 1
├─ tsconfig.json
│
├─ versioned_docs/
│  └─ version-7.24/                     # English RouterOS 7.24 (canonical)
│     ├─ introduction.md
│     ├─ getting-started/...
│     └─ cli-reference/...
├─ versioned_sidebars/
│  └─ version-7.24-sidebars.json        # generated from the official sidebar
│
├─ hardware/                            # English Hardware Guides (canonical)
├─ blog/                                # English Product news (canonical)
├─ changelog/                           # English Docs Changes (canonical)
│
├─ i18n/                                # translations only; empty in phase 1
│  └─ <locale>/
│     ├─ docusaurus-plugin-content-docs/version-7.24/...
│     ├─ docusaurus-plugin-content-docs-hardware/current/...
│     ├─ docusaurus-plugin-content-blog/...
│     ├─ docusaurus-plugin-content-blog-changelog/...
│     ├─ docusaurus-theme-classic/{navbar,footer}.json
│     └─ code.json
│
├─ src/
│  ├─ pages/index.tsx                   # home page
│  ├─ components/
│  │  ├─ ArgTable/                      # official CLI table component
│  │  └─ CliCompare/                    # official comparison UI
│  ├─ theme/                            # only when an official component needs
│  │  └─ ...                            # a faithful local implementation
│  └─ css/custom.css                    # official custom CSS, if separable
│
├─ static/
│  ├─ img/                              # logo, favicon, shared images
│  ├─ hardware/                         # product images
│  ├─ blog/                             # newsletter images
│  └─ changelog/                        # changelog images, if any
│
├─ data/
│  ├─ sync_state.json                   # authoritative incremental state
│  ├─ manifests/
│  │  ├─ site.json                      # source inventory + hashes
│  │  ├─ docs-7.24.json
│  │  ├─ hardware.json
│  │  ├─ blog.json
│  │  └─ changelog.json
│  ├─ cli/
│  │  └─ 7.24/
│  │     ├─ en.json                     # parsed CLI model
│  │     └─ zh-Hans.json                # future translation
│  └─ schema/                           # JSON schemas for the above
│
├─ pipeline/                            # all fetching/transformation code
│  ├─ archive/                          # DSH session exporter
│  ├─ fetch/                            # HTTP, Playwright, retry, rate limit
│  ├─ transform/                        # .md normalisation, HTML→MDX
│  ├─ assets/                           # download, hash, rewrite references
│  ├─ cli/                              # ArgTable → JSON → diff
│  ├─ state/                            # sync_state read/write/lock
│  └─ verify/                           # link, hash, DOM and screenshot checks
│
├─ vendor/
│  └─ official/
│     └─ 3.10.1/                        # snapshots for fidelity comparison
│        ├─ css/
│        ├─ js/
│        └─ manifest.json               # URL + SHA-256 of every snapshot
│
├─ session-archive/                     # conversation history + retrieval index
│  ├─ index.json
│  ├─ README.md
│  ├─ summaries/
│  ├─ fragments/
│  └─ sessions/
│
├─ reports/
│  ├─ visual/                           # Playwright screenshots + report.html
│  ├─ sync/                             # repair/diff reports
│  └─ build/                            # link and asset audit
│
└─ work/                                # git-ignored, resumable only
   ├─ html/                             # rendered hardware/blog snapshots
   ├─ queue/                            # failed/remaining URLs
   └─ logs/
```

`work/` is never committed. `data/cache/` and `vendor/cache/` are also ignored.
A one-off download should use `mkdtemp()` under the system temporary directory.

## 3. Docusaurus plugin routing

### 3.1 RouterOS docs

```ts
{
  id: 'default',
  path: 'versioned_docs/version-7.24',   // resolved through versioning
  routeBasePath: 'docs',
  sidebarPath: 'versioned_sidebars/version-7.24-sidebars.json',
}
```

- `versions.json`: `["7.24"]`
- `lastVersion: '7.24'`
- `onlyIncludeVersions: ['7.24']`
- Public URLs: `/docs/7.24/...`
- The current (unversioned) docs version is not published in phase 1.

A two-page spike has already proved that Docusaurus 3.10.1 emits
`/docs/7.24/...` with this configuration. The evidence is in
`reports/build/route-spike.md`; `/docs/` is absent as intended.

### 3.2 Hardware Guides

A second `@docusaurus/plugin-content-docs` instance:

```ts
{
  id: 'hardware',
  path: 'hardware',
  routeBasePath: 'hardware',
  sidebarPath: 'sidebars-hardware.ts',
}
```

This is why the official page carries `plugin-id-hardware` and
`docs-version-current`. It is not a blog and not a custom route.

### 3.3 Product news

```ts
{
  id: 'blog',
  routeBasePath: 'blog',
  path: 'blog',
}
```

### 3.4 Docs Changes

A second blog instance:

```ts
{
  id: 'changelog',
  routeBasePath: 'changelog',
  path: 'changelog',
  blogTitle: 'Docs Changes',
}
```

The two instances have separate sidebars, feeds and archive pages. They do not
share route state.

### 3.5 CLI comparison

The official page is an MDX document containing `<CliCompare />`. It exists
only in the current 7.26 docs; `/docs/7.24/cli-reference/compare-versions/`
returns 404 upstream. The comparison data is generated from the versioned CLI
pages, not from RouterOS itself.

In this single-version mirror the page will be reachable at:

```text
/docs/7.24/cli-reference/compare-versions/
```

The navigation label stays **Compare Versions**. The URL decision is recorded
in the session archive; it can be changed without touching the data model.

## 4. Multilingual layout

Docusaurus i18n has one canonical locale (English) and translated overlays.
The repository does **not** keep two parallel content trees.

| Section | English (default) | Translation overlay | URL example |
| --- | --- | --- | --- |
| RouterOS 7.24 | `versioned_docs/version-7.24/` | `i18n/<locale>/docusaurus-plugin-content-docs/version-7.24/` | `/docs/7.24/introduction` |
| Hardware | `hardware/` | `i18n/<locale>/docusaurus-plugin-content-docs-hardware/current/` | `/hardware/netmetal-ax` |
| Product news | `blog/` | `i18n/<locale>/docusaurus-plugin-content-blog/` | `/blog/news135` |
| Docs Changes | `changelog/` | `i18n/<locale>/docusaurus-plugin-content-blog-changelog/` | `/changelog/changelog-2026-11-03` |
| CLI compare data | `data/cli/7.24/en.json` | `data/cli/7.24/<locale>.json` | `/docs/7.24/cli-reference/compare-versions/` |
| Navbar/footer | theme config | `i18n/<locale>/docusaurus-theme-classic/` | locale-prefixed |
| UI strings | source strings | `i18n/<locale>/code.json` | locale-prefixed |

With `defaultLocale: 'en'` and `locales: ['en', 'zh-Hans']`, the translated
routes become `/zh-Hans/docs/7.24/...`, `/zh-Hans/hardware/...`, etc.

Rules:

1. Every translated page keeps the English file path and slug. This keeps
   cross-links, the CLI comparison, and future version diffs stable.
2. Model numbers, CLI tokens and command paths are not translated. Prose,
   headings, table descriptions and UI labels are.
3. A missing translation falls back to English. Partial translations are
   allowed.
4. The CLI comparison reads the locale-specific JSON; if a locale JSON is
   absent, it falls back to English and labels that fact in the report.
5. No language switcher is enabled in phase 1. The directories and config keys
   are prepared, but `locales` may remain `['en']` until phase 2.

The exact `docusaurus-plugin-content-*` folder suffix for a non-default plugin
id is verified during the scaffold step, not guessed in content scripts.

## 5. Official CSS and JavaScript policy

The goal is visual and structural fidelity, not copying a compiled application
that would load the wrong data.

**Reused verbatim where safe**

- `/img/logo.svg`, favicon, fonts, icons, Open Graph images and other static
  assets.
- Standalone third-party assets that do not embed the official route map.
- Custom CSS rules that can be separated from the generated bundle.
- Official favicon and theme colour metadata.

**Regenerated with the same toolchain**

- Docusaurus `main.js` and `runtime~main.js`. The official bundles contain the
  official route/chunk map and the 7.24/7.25/7.26 content manifest. Injecting
  them into this repository would try to load the official site's data.
- CSS Modules with build-hashed class names. The official
  `styles.b36e0801.css` is kept as a comparison baseline; the local build is
  expected to produce equivalent rules from the same Docusaurus version.

**Snapshots**

`vendor/official/3.10.1/manifest.json` records the source URL, byte count and
SHA-256 of every official CSS/JS/static file used for comparison. This makes
"we used the official file" auditable rather than a claim in prose.

The visual verifier compares computed styles and DOM landmarks, not only
screenshots. A byte-identical CSS file is not useful if its hashed class names
do not match the rendered DOM.

## 6. Incremental synchronisation

`data/sync_state.json` is the single source of truth for what has been
mirrored. It is written atomically (temporary file + rename) and is safe to
commit.

```json
{
  "schema": 1,
  "source": "https://manual.mikrotik.com",
  "generated_at": "2026-11-04T23:00:00+08:00",
  "entries": {
    "docs:7.24:introduction": {
      "kind": "docs",
      "section": "routeros",
      "source_url": "https://manual.mikrotik.com/docs/7.24/introduction.md",
      "source_hash": "sha256:...",
      "local_path": "versioned_docs/version-7.24/introduction.md",
      "local_hash": "sha256:...",
      "assets": [],
      "etag": null,
      "last_modified": null,
      "synced_at": "2026-11-04T23:00:00+08:00"
    }
  }
}
```

Pipeline modes:

- `--full`: fetch every inventory item, transform, write, then rebuild state.
- `--check`: compare state, local files and remote validators; write a report
  only.
- `--repair`: for each missing or hash-mismatched local file, re-fetch from its
  recorded source URL, transform, verify, and update state.
- `--only=docs,hardware,blog,changelog,assets`: bounded runs.
- `--dry-run`: report actions without writing content.

A missing local file is always repairable even when the remote page is
byte-identical. That is the behaviour the phase-1 deletion drill tests.

For HTML-only sections (Hardware, Blog, Changelog), the recorded hash is the
hash of the **normalised Markdown**, not the raw HTML. Raw HTML contains
build-specific nonces and navigation that would make every run look changed.
The raw snapshot lives in `work/html/` for audit and can be discarded.

## 7. Build and verification gates

A build is accepted only when:

1. `npm run build` completes with `onBrokenLinks: 'throw'` and
   `onBrokenMarkdownLinks: 'throw'`.
2. every image referenced by content exists under `static/`;
3. `data/sync_state.json` covers every inventory item;
4. Playwright captures local and official pages at the same viewport;
5. the DOM report shows matching navbar order, sidebar hierarchy, article
   landmarks and footer columns;
6. the screenshot report is attached with a list of known visual differences
   (fonts, dynamic dates, external badges).

## 8. Git policy

- Repository root: `mikrotik-manual-mirror/`.
- Branch: `main`.
- No remote is configured during phase 1.
- No GitHub Actions.
- `work/`, build output and caches are ignored.
- Content, manifests, pipeline code, reports and the session archive are
  committed.
- Large media is compressed only when it does not change rendered pixels; if
  the repository approaches GitHub limits, Git LFS is introduced explicitly,
  not silently.
