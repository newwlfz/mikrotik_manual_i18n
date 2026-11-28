# Adding a new language: maintainer runbook

The human checklist for bringing up a new locale site: which buttons to click, which files to touch, in what order. Nothing here writes credentials for you. The aim is to dodge the two classic mistakes — a non-empty remote repo and a half-substituted skeleton.

## 1. Overview

The hub (`newwlfz/mikrotik_manual_i18n`) owns the English source tree and publishes a locale skeleton as a GitHub Release. Each language lives in its own repository with its own Pages deployment. Three phases:

1. **Manual prep** — create the empty repo, grant the hub's PAT access, set the LLM values and the Pages source, register the locale in `locales.json`.
2. **Skeleton bootstrap** — one command downloads and verifies the Release skeleton, expands the 11 placeholders and prints the first commit/push commands.
3. **Automatic translation and publish** — hub content lands in the new repo; its `pages.yml` translates in resumable batches and publishes only when the gates are green.

For the reasoning see `guides/ARCHITECTURE-MULTISITE.md` and `guides/CI.md`.

## 2. Manual prep (all required)

### 2.1 Create the repository — completely empty

GitHub → *New repository*, using the `owner/name` you will put in `locales.json`; make it public. **Do not** tick *Add a README file*, *Add a .gitignore*, or *Add a license*. Any of those creates an initial commit on `main`, so your first push becomes a non-fast-forward between unrelated histories. An empty repo accepts the skeleton push directly.

### 2.2 Give the hub's PAT access

`CROSS_REPO_TOKEN` is a fine-grained PAT stored as an Actions secret **in the hub**, scoped to the language repositories. Add the new repo to its repository list with `Contents: read and write` (publish pushes content) and `Actions: read and write` (dispatching). Its value never goes into a file, a guide, or a command line here.

### 2.3 Configure the new repository's Actions settings

In the **new** repo: **Settings → Secrets and variables → Actions**. On the *Variables* tab set `LLM_BASE_URL` and `LLM_MODEL`, plus `LLM_TIMEOUT_MS` if the template's `pages.yml` reads it (optional; the tools default to 120000 ms). On the *Secrets* tab set `LLM_API_KEY`. Names only — never paste any value into a guide, an issue or a commit. `guides/LLM.md` explains each name; the translate job maps them in as `vars.*` / `secrets.*` and fails in preflight if absent.

### 2.4 Turn Pages on

**Settings → Pages → Build and deployment → Source: GitHub Actions.** If the source stays "Deploy from a branch", the deploy job has no Pages environment and the new site stays at 404 after a green build.

### 2.5 Register the locale in the hub

Add one entry under `locales` in the hub's root `locales.json`, keyed by the BCP 47 code: `label`, `repo`, `baseUrl` (leading/trailing `/`), `site` (absolute, ending in `baseUrl`), `siteTitle`, `tagline`, `available: true`. Leave `default` as `en`. Check before committing:

```bash
npm run locales:check
npm run content:publish:dry
```

Review the diff and push the hub change yourself. This file is a repository-wide event: every site's dropdown, hreflang and redirect metadata come from it. If you register before the remote repo exists, land the entry with `available: false` and flip it to `true` in a second reviewed commit — a flip rebuilds all sites.

## 3. Skeleton bootstrap (one command)

The §2 prerequisites are already done: the remote repo is empty, the PAT/LLM/Pages settings exist and the locale is registered. Only four values are passed locally — locale, label, repo and slug. Everything else (`baseUrl`, `site`, `site_origin`, `HUB_REPO`, `HUB_BASE_URL`, `ASSET_ORIGIN`) comes from the Release `manifest.hub`; do not repeat those values on the command line. Run this from inside the new, empty repository (or pass `--dir <empty dir>`):

```bash
node <你的 hub checkout 路径>/templates/locale-repo/tools/bootstrap/from-release.mjs \
  --locale zh-Hant --label 繁體中文 --repo newwlfz/mikrotik_manual_zh_hant --slug zh_hant
# from a template checkout instead:
npm run bootstrap:from-release -- --locale zh-Hant --label 繁體中文 \
  --repo newwlfz/mikrotik_manual_zh_hant --slug zh_hant --dir <你的真实空目录>
```

`<你的 hub checkout 路径>` / `<你的真实空目录>` are placeholders: replace them with
real absolute paths on your machine. Real example on this host (illustration only,
not for copying): hub `/home/evan/mikrotik_manual_i18n/mikrotik_manual_i18n`,
empty target `/home/evan/tmp/empty-zh-hant`.

`--dry-run` downloads, verifies and prints the plan without writing to the target. `--version` / `--hub` point at a different Release tag or host repository if needed.

The command is fail-closed: it downloads `<tag>.manifest.json` and `<tag>.tar.gz` from the hub Release, checks `archive.sha256` and every extracted file against `files[].sha256`, rejects a non-empty target, expands all 11 placeholders in contents **and** paths, and re-verifies that zero placeholders remain, that the key values (locale, label, repo, baseUrl, site, asset origin, env prefix) reached the README/workflow, and that no build or VCS artifacts were mixed in. JSX/JS lookalikes, `${{ ... }}` Actions expressions and the documented literal example in `tools/translate/readme.mjs` are preserved byte for byte; unknown or leftover placeholders abort the run. The temporary tree is removed on failure; on success the verified tree is moved into place and the git commands below are printed. Nothing is committed, pushed or written to GitHub.

The tool ships inside the skeleton, so a locale repository keeps its own copy. Only the shared English `README.md` is scaffolded; a stale Release's `README.<tag>.md` overrides are reported and skipped. The locale's own `translate:readme` workflow localizes the root README from the English `hub-docs/` source — never add a hand-written localized README to the template.

### 3.1 Manual fallback (troubleshooting only)

If networking or Node is unavailable: download the Release tarball and manifest by hand, check `sha256sum <tag>.tar.gz` against `archive.sha256` (and every file hash against `files[].sha256`), unpack into a clean directory, then use `tools/content/add-locale.mjs`'s strict `substitute()` / `substitutePath()` semantics for the 11 names in contents **and** paths; `i18n/{{LOCALE}}/.gitkeep` must become `i18n/<locale>/.gitkeep`. A leftover `{{NAME}}` is a hard error:

```bash
grep -R -n -E '\{\{(LOCALE|LOCALE_LABEL|SLUG|REPO|BASE_URL|SITE|SITE_ORIGIN|HUB_REPO|HUB_BASE_URL|ASSET_ORIGIN|LOCALE_ENV)\}\}' . --exclude-dir=.git && echo "STOP: placeholders left"
```

Six files use a literal `{{` as a JSX/JS expression (counted in `manifest.checks.placeholders.jsx_lookalike_files`) and must stay untouched.

### 3.2 First commit and push (printed by the command)

```bash
git add -A
git commit -m "init: locale skeleton"
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

Keep the skeleton's `.gitignore`, `.gitattributes`, `.env.local.example` and workflows. A real `.env.local` is never part of the archive.

## 4. The publish chain after your push

1. A push to the hub's `main` runs `pages.yml`; its `publish-content` job also runs when the English build failed. It validates `locales.json`, checks `CROSS_REPO_TOKEN`, then runs `tools/content/publish.mjs`.
2. For every locale it clones the repo and overwrites ten content roots — `docs/`, `versioned_docs/`, `hardware/`, `blog/`, `changelog/`, `data/`, `sidebars.ts`, `sidebars-hardware.ts`, `versioned_sidebars/`, `versions.json` — plus `locales.json`, committing/pushing only on change. `static/` is not shipped; assets come from the hub via `ASSET_ORIGIN`.
3. That push, the 2-hour schedule or a manual dispatch starts the new repo's `pages.yml`: preflight → one batch (TM reuse first, LLM for the rest) → commit `i18n/`, `work/translate/`, `state/` with `[skip ci]` so progress does not retrigger a round. Batches resume from `work/translate/checkpoint.json`.
4. Rounds continue until `pending == 0`. Only then, with `translate:verify`, `verify:deploy` and the release gate green (`release=pass`), does `build` run and `deploy` publish. A failed batch leaves the previous deployment live.
5. Units the model keeps verbatim — identifiers, technical notation, proper nouns — land in `work/translate/keep-english.json` and the planner stops queueing them. That is how a few stubborn blocks stop blocking convergence without shipping arbitrary English prose; `config/force-translate.yml` overrides a lock.

Local rehearsal: `npm run content:publish:dry` in the hub. Full contract: `guides/CONTRACT.md`.

## 5. Day-to-day maintenance

Wording lives in the locale repo: `i18n/<code>/` is generated, `config/` is reviewed. Never hand-edit a content root — the next hub publish overwrites it.

The locale profile (`config/locale-profiles/<code>.md`) and glossary (`config/glossary/<code>.yml`) are maintained by that language's maintainers via PRs in their own repo. A change only guides **new** translation output; existing overlays stay as committed until a refresh (`--refresh-changed`) runs.

Hub `README.md` / `guides/*.md` arrive as the `hub-docs/` tree and are translated into a docs overlay (`docusaurus-plugin-content-hub-docs`): repository documentation with no site route, so they never appear as site pages. Toolchain changes start in `templates/locale-repo/`, go out via `npm run sync:tools`, and are checked by `npm run check:tools-template`.

## 6. Troubleshooting

- **First push rejected (non-fast-forward):** the remote repo was not empty. Recreate it truly empty or port the stray file; do not force-push over a repo someone else may have cloned.
- **Leftover `{{...}}`:** you unpacked but did not expand all 11 names, path segments included. Re-run the bootstrap command (or the §3.1 check for a manual unpack); ignore only the lookalikes the manifest lists.
- **Hub publish fails to clone or authenticate:** the repo is missing from the `CROSS_REPO_TOKEN` whitelist or the PAT lacks `Contents: read and write` / `Actions: read and write`. Fix the PAT and re-run `publish-content`.
- **Green build, 404 site:** Pages source is not *GitHub Actions*. Fix it in Settings → Pages and re-run deployment.
- **`pending` never reaches 0:** check preflight first — 401/402/403/429 are key or quota issues, and `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` live in the new repo, not the hub. Keep the 2-hour schedule or `workflow_dispatch` running; do not fake green with `skip_translate`. For one recurring block, review `keep-english.json` and the glossary. `npm run translate:verify` and `node tools/ci/release-gate.mjs --json` show what is still owed.
