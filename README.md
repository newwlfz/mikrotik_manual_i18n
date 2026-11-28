# MikroTik Manual Mirror · English hub repository

The English site is built here: <https://newwlfz.github.io/mikrotik_manual_i18n/>. It is also the source of truth for all three sites: content is synced in from <https://manual.mikrotik.com/>, corrected, and then pushed to the Simplified and Traditional Chinese translation repositories.

The Simplified and Traditional sites are not built in this repository. Each has its own repository (`mikrotik_manual_zh_hans`, `mikrotik_manual_zh_hant`) holding only its translations. The `locales.json` at this repository's root is the language registry shared by all three sites: the navbar language dropdown, the `hreflang` tags on every page, and the first-visit redirect for Chinese browsers are all generated from it.

## What happens every day

1. `.github/workflows/sync.yml` first sends a conditional, ETag-based request at 03:00 UTC (11:00 Asia/Shanghai) every day. If the official site has not changed, the run ends with no commit and no build.
2. Only when the official site has changed does the sync run (in CI: `node tools/sync/index.mjs --update`; the local equivalent is `npm run sync`): it fetches new content, switches versions, rebuilds the sidebars and CLI data, commits the result back to `main`, and then explicitly dispatches `pages.yml`.
3. `pages.yml` builds the English site, runs `npm run verify:deploy`, and publishes it.
4. The `publish-content` job in the same workflow uses `CROSS_REPO_TOKEN` to push content to the two language repositories and fires `content-fanout`; on receiving the event, they translate, build, and deploy.

A failed sync commits nothing and only opens a `sync failed:` issue; the live site stays on the previous version. See `guides/CI.md` and `guides/ARCHITECTURE-MULTISITE.md` for details.

## What to edit, and what not to edit

| Path | What it is | What to do |
| --- | --- | --- |
| `docs/`, `versioned_docs/`, `hardware/`, `blog/`, `changelog/`, `data/` | Sync outputs | Do not edit by hand. The next sync replaces the whole tree. To make a change, edit the upstream source or `tools/sync/`. |
| `sidebars.ts`, `sidebars-hardware.ts`, `versioned_sidebars/`, `versions.json` | Sync outputs | Same as above; they are also pushed to the language repositories. |
| `upstream/`, `build/`, `.docusaurus/` | Fetch caches and build outputs | Do not edit or commit. |
| `tools/`, `config/`, `src/`, `docusaurus.config.ts` | Pipeline and configuration | This is where real changes go. Sync rules live in `config/mirror.yml`; the site shell lives in `src/`. |
| `.github/workflows/`, `guides/` | CI and documentation | Edit here when changing the workflow. |
| `locales.json` | Language registry | Editable, but one edit affects all three sites (see below). |

Editing `locales.json` is a repository-wide event. The hub publishes it to both language repositories; the shared key fields (`default`, each locale's `repo` / `baseUrl` / `site` / `available`) must agree, while `tagline` / `label` / `siteTitle` stay localized per site and are deliberately not byte-identical. Whenever an `available` flag is flipped from `false` to `true`, or an address changes, the hub and both sites must be rebuilt so that the language dropdown, `hreflang`, and the redirect metadata stay consistent. After an edit, run `npm run locales:check` and `npm run content:publish:dry` in that order, confirm the plan, and only then run `npm run content:publish`. The registry's `default` must be `en`.

Add a locale with `npm run locale:add`. Look at the plan first:

```bash
npm run locale:add -- --code ru-RU --label Русский --dry-run
```

It only scaffolds the directory and registers the locale in `locales.json`; it does not create a GitHub repository or write any secrets. After that you still need to create the repository by hand, grant `CROSS_REPO_TOKEN` access, configure the LLM variables in the new repository, and run publish once more. See `--help` for command arguments and `guides/DECISIONS.md` for the reasoning (D7, and D9 for the README policy).

To bootstrap from the published Release instead of the local template, run one command from inside the new, empty repository:

```bash
node <你的 hub checkout 路径>/templates/locale-repo/tools/bootstrap/from-release.mjs \
  --locale zh-Hant --label 繁體中文 --repo newwlfz/mikrotik_manual_zh_hant --slug zh_hant
```

Replace `<你的 hub checkout 路径>` with the real absolute path of your hub checkout;
a real example on this machine is `/home/evan/mikrotik_manual_i18n/mikrotik_manual_i18n` (example only — do not copy it verbatim).

From a checkout of the template the same command is `npm run bootstrap:from-release -- --locale ... --dir <empty target>`. It downloads the Release tarball and manifest, verifies `archive.sha256` and every per-file SHA-256, expands the 11 placeholders in contents *and* paths, re-checks that none remain, and only then writes the tree and prints the copyable `git init` / `add` / `commit` / `push` commands. It makes no commit, no push and no credential changes; `--dry-run` only verifies and prints the plan. The human prerequisites still apply: create the empty repository, grant `CROSS_REPO_TOKEN` access, set the LLM variables/secret and Pages source, and register the locale in `locales.json`. Full steps: `guides/ONBOARDING.md` (and `guides/ZH_HANT_RUNBOOK.md` for zh-Hant).

The template holds one shared English `README.md`. The scaffold always expands its 11 placeholders and writes it as the new repository's root `README.md`; there are no per-locale README files in the template. A language repository's own README is localized by that repository's `translate` workflow from the English `hub-docs/` source published by this hub — it is a translation product, not a template variant. Maintainers should not hand-edit a scaffolded README or add language-specific README files to the template. This hub's own README stays in English and carries no private addresses.

## Common commands

```bash
npm ci                          # install dependencies first
npm run sync:probe              # only ask the official site "have you changed?", writes nothing
npm run build                   # CLI data -> Docusaurus -> Pagefind -> llms.txt
npm run verify:deploy           # verify the deploy shape
npm run serve                   # single-site Docusaurus preview (not the three-site server below)
npm run locales:check           # validate locales.json
npm run content:publish:dry     # print what would be pushed, write nothing remote
npm run content:publish         # real push; requires CROSS_REPO_TOKEN
```

Build with `npm run build`, not `npx docusaurus build` directly: the npm script runs Pagefind and the llms rewrite after Docusaurus, and the navbar search depends on that step.

## Local preview (all three sites together)

The three repositories are checkouts that live side by side under one working
root; each produces a `build/`. Build whichever site you want to view; sites that
have not been built return 404. The deployed sites are public:

- English <https://newwlfz.github.io/mikrotik_manual_i18n/>
- Simplified Chinese <https://newwlfz.github.io/mikrotik_manual_zh_hans/>
- Traditional Chinese <https://newwlfz.github.io/mikrotik_manual_zh_hant/>

For a local preview, build the sites from the working root (the directory that
contains the three checkouts and `work/`), then run the shared static server:

```bash
(cd mikrotik_manual_i18n && npm ci && \
  SITE_LOCALE=en SITE_URL=https://newwlfz.github.io BASE_URL=/mikrotik_manual_i18n/ \
  ASSET_HOST=true npm run build)
(cd mikrotik_manual_zh_hans && npm ci && \
  SITE_LOCALE=zh-Hans SITE_URL=https://newwlfz.github.io BASE_URL=/mikrotik_manual_zh_hans/ \
  ASSET_ORIGIN=https://newwlfz.github.io/mikrotik_manual_i18n npm run build)
(cd mikrotik_manual_zh_hant && npm ci && \
  SITE_LOCALE=zh-Hant SITE_URL=https://newwlfz.github.io BASE_URL=/mikrotik_manual_zh_hant/ \
  ASSET_ORIGIN=https://newwlfz.github.io/mikrotik_manual_i18n npm run build)
node work/serve-multi-i18n.mjs
```

`work/serve-multi-i18n.mjs` is a plain Node static server that mounts the three
`build/` trees. It listens on port `3030` by default; set `PORT` to use a
different one. Both the mount paths and the directory names are read from
`locales.json`; `/` redirects to the English site. `npm run serve` is only
Docusaurus' single-site preview, not this shared server.

Variables used:

| Variable | Value in the example | Meaning |
| --- | --- | --- |
| `SITE_URL` | `https://newwlfz.github.io` | This site's origin, used for canonical / hreflang |
| `BASE_URL` | `/mikrotik_manual_i18n/` etc. | Each site's path prefix, with a leading and a trailing `/` |
| `SITE_LOCALE` | `en` / `zh-Hans` / `zh-Hant` | Only one locale is built at a time |
| `ASSET_ORIGIN` | `https://newwlfz.github.io/mikrotik_manual_i18n` | Chinese sites load images, PDFs and videos from the English site; no trailing slash |
| `ASSET_HOST` | `true` | Hub only: keeps the complete `build/img` in the slim build |
| `BUILD_HEAP_MB` | `6144` in all three CI workflows | Node heap set in each `.github/workflows/pages.yml` env (hub, Simplified and Traditional are all 6144); the bare tool falls back to 4 GiB locally unless the variable is set |

`CROSS_REPO_TOKEN` is the name of a secret, not a value to write into documentation: locally it comes from an environment variable or `.env.local`, in CI from GitHub Secrets (this repository's Settings → Secrets and variables → Actions). Publish fails with an explicit error when it is missing; a dry run does not need it.

For more design notes, see `ARCHITECTURE.md`, `TRANSLATION.md`, and `guides/`.
