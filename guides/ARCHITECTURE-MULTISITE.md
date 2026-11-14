# Multi-site architecture: one hub, one repository per language

This document describes how the English hub publishes content to the language
sites, how each site is built and deployed, what fails independently, and how
the model differs from the older single-repository bilingual setup.

Related documents:

- [`README.md`](../README.md) — the short version and the daily commands.
- [`guides/CI.md`](CI.md) — workflows, deployment gate and shared assets.
- [`guides/DECISIONS.md`](DECISIONS.md) — the decisions this design rests on.

## 1. Roles

| Component | Repository / location | Owns |
| --- | --- | --- |
| **Hub** | `newwlfz/mikrotik_manual_i18n` | Corrected English source (`docs/`, `versioned_docs/`, `hardware/`, `blog/`, `changelog/`), generated data (`data/`), navigation and version manifests (`sidebars.ts`, `sidebars-hardware.ts`, `versioned_sidebars/`, `versions.json`), shared assets (`static/`), the locale registry (`locales.json`), the shared `docusaurus.config.ts`, and the publish job |
| **Language site** | e.g. `newwlfz/mikrotik_manual_zh_hans` | Translation overlays (`i18n/<tag>/`), site-specific configuration (`config/`), local caches (`work/`), tooling (`tools/`, `src/`), its own build/deploy workflow |
| **GitHub Pages** | one project site per repository | The deployed site; each repository deploys only its own locale |
| **Fine-grained PAT** | `CROSS_REPO_TOKEN` secret in the hub | `Contents: Read and write` on the language repositories; used only by the publish job |

The hub builds English only. A language repository builds exactly one locale
(`SITE_LOCALE=<tag>`) and never builds English pages.

```text
                    locales.json (single source of truth)
                            │
        ┌───────────────────┴────────────────────┐
        │                                        │
  docusaurus.config.ts                     tools/lib/site-config.mjs
  i18n.locales / localeConfigs             baseUrl / siteUrl for build tools
  (dropdown, hreflang, alternate)          and deploy assertions
        │                                        │
        └──────────────► one build per repo ◄───┘
                            │
                 tools/content/publish.mjs
                            │  every CONTENT_ROOTS root + locales.json
                            ▼
                 language repository (git commit + push)
                            │
                 its pages.yml: translate → build → deploy
```

## 2. Repository layout

```text
hub (newwlfz/mikrotik_manual_i18n)
├── locales.json                    # the language registry (this design's core)
├── docusaurus.config.ts            # shared, byte-identical with every language repo
├── docs/                           # corrected English documentation        (published)
├── versioned_docs/                 # archived documentation versions        (published)
├── hardware/  blog/  changelog/    # hardware guides, news, docs changes    (published)
├── data/                           # CLI model, manifests, version routing  (published)
├── sidebars.ts  sidebars-hardware.ts
├── versioned_sidebars/  versions.json   # navigation + version manifests     (published)
├── static/                         # shared assets: /img, /assets, /videos, /official (never published)
├── tools/content/
│   ├── locales.js                  # read / validate / resolve the registry
│   ├── check-locales.mjs           # npm run locales:check
│   └── publish.mjs                 # cross-repository content publisher
└── .github/workflows/pages.yml     # build + deploy + publish-content

language site (newwlfz/mikrotik_manual_zh_hans)
├── locales.json                    # synced from the hub
├── docusaurus.config.ts            # same file (tooling is updated deliberately)
├── docs/  versioned_docs/  hardware/  blog/  changelog/  data/
├── sidebars.ts  sidebars-hardware.ts  versioned_sidebars/  versions.json
│                                   # every content root above is synced and git-tracked
├── i18n/zh-Hans/                   # translation overlays — owned here, never published
├── config/                         # per-site configuration — owned here
├── work/                           # local caches — owned here
├── tools/  src/                    # site tooling — owned here, never published
└── .github/workflows/pages.yml     # translate + build + deploy
```

`i18n/`, `config/`, `work/`, `tools/`, `src/` and `.github/` are the language
repository's own state. The publisher replaces the content directories
wholesale, overwrites the content files and writes `locales.json`; it does not
delete or rewrite anything else.

## 3. The locale registry (`locales.json`)

```json
{
  "default": "en",
  "locales": {
    "en": {
      "label": "English",
      "repo": "newwlfz/mikrotik_manual_i18n",
      "baseUrl": "/mikrotik_manual_i18n/",
      "site": "https://newwlfz.github.io/mikrotik_manual_i18n/"
    },
    "zh-Hans": {
      "label": "简体中文",
      "repo": "newwlfz/mikrotik_manual_zh_hans",
      "baseUrl": "/mikrotik_manual_zh_hans/",
      "site": "https://newwlfz.github.io/mikrotik_manual_zh_hans/"
    }
  }
}
```

| Field | Meaning | Rules |
| --- | --- | --- |
| `default` | Locale the hub builds | Must be `en`; the hub is the English site |
| `locales.<tag>.label` | Navbar language-dropdown label | Non-empty string |
| `locales.<tag>.repo` | Repository that builds this locale | `owner/name`; unique per locale |
| `locales.<tag>.baseUrl` | GitHub Pages path prefix | Must start and end with `/` |
| `locales.<tag>.site` | Absolute site address | Absolute http(s) URL; must end with `baseUrl` |
| `locales.<tag>.direction` | Optional `ltr` / `rtl` | Defaults to `ltr` |
| `locales.<tag>.htmlLang` | Optional `<html lang>` override | Defaults to the locale key |

`npm run locales:check` enforces all of the above and exits non-zero on any
problem. It never touches the network.

The registry is read by three consumers, always through
`tools/content/locales.js`:

1. `docusaurus.config.ts` — generates `i18n.locales`, `i18n.localeConfigs`, the
   head-script redirect target and the `docusaurus-zh-home` /
   `docusaurus-en-home` meta tags.
2. `tools/lib/site-config.mjs` — resolves `siteUrl`/`baseUrl` for the build
   wrapper, `llms.txt`, `slim` and every deploy assertion.
3. `tools/content/publish.mjs` — decides which repositories to push to.

Environment overrides still win, so local previews and forks never need to edit
the registry:

| Variable | Overrides |
| --- | --- |
| `SITE_LOCALE` | Which locale this build produces (default: `default`) |
| `SITE_URL` / `BASE_URL` | The build's own origin / path prefix |
| `LOCALE_<PRIMARY_SUBTAG>_URL` / `_BASE_URL` | That locale's origin / path prefix (`zh-Hans` → `ZH`) |

## 4. Build-time data flow

1. `tools/build/index.mjs` reads `SITE_LOCALE` and runs
   `docusaurus build --locale <tag> --out-dir build`. There is no
   `build/<locale>/` layer: the produced locale is the site root.
2. `docusaurus.config.ts` resolves every locale through `resolveSites()`. The
   build's own locale gets `SITE_URL`/`BASE_URL` and `translate: true`; every
   other locale gets its declared `site`/`baseUrl` and `translate: false`.
   Docusaurus therefore generates the language dropdown, per-page `hreflang`
   and `og:locale:alternate` for sites that are not built here, while never
   reading another repository's `i18n/` overlays.
3. Asset references: the hub publishes `static/`; a language site sets
   `ASSET_ORIGIN` to the hub's site base address and ships no `static/`. The
   rewrite happens in `tools/build/remark-prefix-root-refs.mjs` (raw HTML/JSX
   and Markdown destinations), `customFields.assetBaseUrl`, `llms.mjs` and the
   CLI data path. See [`guides/CI.md`](CI.md#shared-assets-asset_origin).
4. The hub sets `ASSET_HOST=true` on its build job so `slim` keeps the full
   `build/img` tree (~99 MiB). Language sites load Markdown images from
   `/img/<hash>` on the hub; pruning it would 404 every translated image.
5. `npm run verify:deploy` is the deployment gate: `slim` → `asset-refs` →
   `base-url-refs` → `orphan-assets` → `llms-links`. A language site runs the
   same gate before uploading its Pages artifact.

## 5. Publish-time data flow

`publish-content` in the hub's `pages.yml` runs after `build` on `main`, and can
be started alone with **Actions → Build and deploy site → Run workflow →
publish_only**. The `publish_only` path skips the 13–14 minute build.

```
for each locale in locales.json, except default:
  git clone --depth=1 https://x-access-token:$CROSS_REPO_TOKEN@github.com/<repo>.git <tmp>
  replace <tmp>/<dir> for every directory root:
      docs/ versioned_docs/ hardware/ blog/ changelog/ data/ versioned_sidebars/
      (destination-only files are deleted)
  overwrite <tmp>/<file> for every file root:
      sidebars.ts sidebars-hardware.ts versions.json
  write  <tmp>/locales.json
  assert git ignores none of those roots (`git check-ignore -v`, every rule reported)
  git add -A
  if `git status --porcelain` is empty: skip this locale (idempotent)
  git -c user.name=… -c user.email=… commit -m "content: sync from hub <hub-sha>"
  git push origin HEAD:<destination branch>
  remove <tmp>
```

- The commit identity defaults to `mikrotik-manual-hub
  <hub@users.noreply.github.com>` (`PUBLISH_GIT_NAME` / `PUBLISH_GIT_EMAIL`
  override it).
- `--message` replaces the commit subject; `{sha}`, `{locale}` and `<hub-sha>`
  expand.
- The push triggers the language repository's `pages.yml` because it listens
  for `push` on its default branch.
- An unchanged locale produces no commit and no push — a nightly run with no
  content change is silent.
- `node tools/content/publish.mjs --dry-run` prints the plan without cloning,
  committing, pushing or using the network. It lists each target repository and,
  for each of the ten content roots, whether it replaces a directory tree or
  overwrites a file, with the file count and byte size; the last line totals
  them.
- The `.gitignore` assertion runs after the copies and **before** staging. Every
  ignored root is reported with the matching rule (`git check-ignore -v`), so a
  partially ignored destination fails instead of committing a silently partial
  sync.
- Exit codes: `0` all selected locales published or already up to date; `1`
  registry/argument/token errors or at least one locale failed.

**What is published:** the ten entries in `CONTENT_ROOTS` — the directories
`docs/`, `versioned_docs/`, `hardware/`, `blog/`, `changelog/`, `data/`,
`versioned_sidebars/` and the files `sidebars.ts`, `sidebars-hardware.ts`,
`versions.json` — plus `locales.json`. Adding or removing a root is a deliberate
change to `CONTENT_ROOTS` in `tools/content/publish.mjs`, and only after the
destination site's build tolerates the replaced tree. Both repositories must
track every root: the publisher fails before the commit if the destination
`.gitignore` covers one, and the language site's `pages.yml` asserts the same
list before translating and before building.

## 6. Failure isolation

| Failure | Build / deploy | Publish | Reader impact |
| --- | --- | --- | --- |
| Hub build fails | English deploy is skipped (last successful deployment stays) | **Still runs** — content publishing is independent of the English artifact | Hub serves the previous build; language sites receive new content if it is valid |
| Registry invalid | Fails immediately (`docusaurus.config.ts` throws, `locales:check` fails) | Fails before clone | Nothing changes |
| `CROSS_REPO_TOKEN` missing | — | Job fails with an explicit `::error::` annotation and setup steps; never a silent skip | Nothing changes; the error is visible in Actions |
| Token expired / lacks permission | — | Clone or push fails; output is redacted; other locales still run; job exits non-zero | That locale stays on its last content |
| One locale fails | Other locales still publish (per-locale `try/catch`) | Summary lists `N published, M unchanged, K failed` | Only the failed site is stale |
| Destination ignores a content root | — | Fails **before** commit, listing every ignored root with the matching `.gitignore` rule | Prevents a false "success" with stale or missing content |
| Destination branch protection rejects push | — | Push fails, job exits non-zero | That locale stays on its last content |
| Language-site build fails after a sync | Its deployment is skipped; GitHub Pages keeps the last successful deployment | Hub job already succeeded | The language site serves the previous build until fixed forward (or the sync commit is reverted) |
| Concurrent runs | `concurrency.group: pages`, `cancel-in-progress: false` serialises the workflow | Same group | No interleaved deploys |

Reverting a bad sync is a normal git operation in the language repository
(`git revert <sync commit>` + push) or a re-run of the hub's publish job after
fixing the hub content; it is never a force-push.

## 7. Security model

- `CROSS_REPO_TOKEN` is a **fine-grained** PAT: repository access limited to
  the language repositories, permission `Contents: Read and write` only. It
  cannot modify the hub, workflows, or settings.
- It is stored as an Actions secret in the **hub** repository only. The
  `publish-content` job declares `permissions: contents: read`; the PAT is not
  bounded by the hub workflow's `GITHUB_TOKEN` permissions.
- The token is passed only in the clone URL given to `git`, and the script
  redacts the exact token and every `https://…@github.com` userinfo pattern
  from all captured git output before printing. `--dry-run` never reads it.
- `GIT_TERMINAL_PROMPT=0` and `GIT_ASKPASS=echo` prevent credential prompts
  from hanging a runner.
- Rotate by creating a new PAT, updating the secret, then deleting the old
  token. No repository change is needed.
- A fork cannot publish: it has no secret, and a missing secret is a hard error.

## 8. Differences from the old single-repository bilingual model

| Aspect | Old: one repository, two locales | New: hub + one repository per locale |
| --- | --- | --- |
| Locale list | Hand-maintained in `docusaurus.config.ts` | `locales.json`, validated by `locales:check` |
| Build output | `build/` + `build/<locale>/`; static assets duplicated per locale | One locale per repository, at the site root; no locale subdirectory |
| Language switch | Relative path inside one site | Absolute URL to the other Pages site (`localeConfigs.url`) |
| Translations | `i18n/<locale>/` next to the English source | Language repository owns its overlays; hub never sees them |
| Content sync | Manual copies / release tarball | `publish-content` pushes every content root + `locales.json` and triggers the language workflow |
| Assets | Copied into every locale tree | Hub is the asset host (`ASSET_HOST`); sites use `ASSET_ORIGIN` |
| Deploy | One artifact for both languages | One artifact per site; a failure is contained to one site |
| Secret | None needed | `CROSS_REPO_TOKEN` (fine-grained PAT) in the hub |
| Coupling | Shared config and build | Shared config, tools and registry; **tooling changes must be applied to both repositories deliberately** (the publish job only ships content) |

## 9. Adopting an existing language repository

The published content only takes effect when the language repository tracks it.
Before the first successful sync:

1. Remove every ignore rule that covers a content root from the language
   repository's `.gitignore`: `/docs/`, `/versioned_docs/`, `/hardware/`,
   `/blog/`, `/changelog/`, `/data/`, `/versioned_sidebars/`, `/sidebars.ts`,
   `/sidebars-hardware.ts`, `/versions.json`, `/locales.json`. Keep `/work/`,
   `/static/`, `/build/`, `/node_modules/` and the local caches ignored. Both
   the publisher and the site's `pages.yml` assert this list; `git
   check-ignore -v <root>` names the rule to delete.
2. Remove the old "Fetch content release" step from its `pages.yml` (and its
   `CONTENT_URL`), so the build uses the committed content roots. If the release
   is kept for other sections, stop it from overwriting any published root.
3. Apply the same `docusaurus.config.ts`, `tools/lib/site-config.mjs`,
   `tools/content/locales.js` and package scripts in one coordinated change, so
   the site reads the registry and resolves the same addresses as the hub.
4. Run the hub's publish job (`publish_only`), confirm the commit lands and the
   language repository's `pages.yml` starts, then confirm its deployment.
5. From then on, content changes flow from the hub only; edit overlays in the
   language repository and English content in the hub.

Until step 1 is done, `node tools/content/publish.mjs` fails before the commit
with the offending `.gitignore` rules instead of reporting a successful sync
that staged nothing.

## 10. Operations runbook

```bash
# Validate the registry (no network)
npm run locales:check

# Show what a publish would do (no network, token not needed)
npm run content:publish:dry

# Publish every non-default locale (local; needs CROSS_REPO_TOKEN)
CROSS_REPO_TOKEN=… npm run content:publish

# Publish one locale with a custom subject
CROSS_REPO_TOKEN=… npm run content:publish -- --only=zh-Hans \
  --message="content: sync RouterOS 7.26 corrections"
```

- **Add a language**: create its repository, add a `locales.json` entry, run
  `npm run locales:check`, dry-run, then publish once (`--only=<tag>`). The
  first publish needs the repository to track every content root and
  `locales.json` (see §9).
- **Change a site's address**: update that locale's `baseUrl`/`site`, then
  update the deployment variables in the affected repository (`SITE_URL`,
  `BASE_URL`, and every `ASSET_ORIGIN` that points at a moved asset host).
- **Move the asset host**: change the hub's repository name/domain/path, then
  update `ASSET_ORIGIN` in every language repository in the same change.
- **Rotate the token**: new PAT → update the hub secret → delete the old PAT.
- **Emergency content rollback**: revert the sync commit in the language
  repository (or fix the hub and re-run `publish_only`); do not force-push.
- **Verify a publish without pushing**: `--dry-run` for the file plan, and the
  language repository's own `verify:deploy` as the final gate.
