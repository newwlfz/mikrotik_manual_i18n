# Templates

`templates/locale-repo/` is the scaffold for one language repository. The hub
(`repo_en`, the English site) owns the content and this template; every locale
repository is a copy of the template plus the overlays the hub publishes into it.

```bash
npm run locale:add -- --code ru-RU --label Русский   # copy the template, register the locale
```

## The template is the canonical copy

**`templates/locale-repo/tools/` is the single authoritative copy of the shared
toolchain.** Editing a file there and scaffolding a repository is the only
supported way to change what every locale repository runs:

| Directory | What it is |
| --- | --- |
| `templates/locale-repo/tools/build/` | `npm run build` chain (CLI model → Docusaurus → Pagefind) and `build:slim` |
| `templates/locale-repo/tools/sync/` | upstream inventory, fetch, materialise, sidebars, version cut |
| `templates/locale-repo/tools/translate/` | **the whole translation toolchain**: overlay apply/derive, harvest, the offline batch commands, the LLM provider, the translation memory, `selftest`, `verify`, and the shared Markdown libraries |
| `templates/locale-repo/tools/verify/` | link / asset / label / table / browser assertions |
| `templates/locale-repo/tools/pipeline/` | `sync`, `translate`, `build`, `verify`, `report` wrappers over the stage lists |
| `templates/locale-repo/tools/content/` | content fetch (`fetch-local.mjs`) for a standalone locale checkout |
| `templates/locale-repo/tools/ci/` | helpers the locale workflow uses to read a translate batch summary |

The hub keeps only a subset of `tools/translate/` — the libraries its own
`sync/`, `verify/` and `build/` tools import. It carries no translation command:
the hub publishes English and never generates an overlay. Which files it keeps is
listed in `repo_en/tools/README.md` ("Translation toolchain").

## Changing a shared tool

1. **Edit the template.** `templates/locale-repo/tools/...` is the file that
   matters; a change made only in a locale repository (or in the hub) is a local
   fork and the next scaffold will not have it.
2. **New repositories get it for free** — `npm run locale:add` copies the whole
   template, substitutes the `{{PLACEHOLDER}}` values and `git init`s the result.
3. **Existing repositories get it through `npm run sync:tools`.** The command
   copies `templates/locale-repo/tools/` into a locale checkout:

   ```bash
   npm run sync:tools -- --to ../repo_zh_hans --dry-run   # plan, write nothing
   npm run sync:tools -- --to ../repo_zh_hans             # copy the missing files
   npm run sync:tools -- --all                            # every ../repo_* with a pages.yml
   ```

   It reports `copied` / `updated` / `unchanged` / `conflicts` / `protected`. A
   file that is missing in the target is copied; an identical file is skipped; a
   file that **differs is not touched** — it is reported as a conflict with the
   first differing line, because a locale repository may carry a local fix, and
   only `--force` overwrites one. The exit code is `1` while conflicts remain, so
   a wrapper or a human has to confirm them. `protected` paths are never
   written at all: `tools/translate/lib/paths.mjs` (each repository has its own
   `DEFAULT_TARGET_LOCALE`), `tools/bootstrap/**`,
   `tools/translate/localize-zh-hant.mjs`, and `tools/content/**` / `tools/ci/**`
   (content acquisition and CI helpers follow each repository's own workflow).
   Review the diff and commit in the target repository afterwards.

`npm run check:tools-template` (in the hub) reports how `repo_en/tools` differs
from this template, file by file. Differences that are expected — the hub-only
publishing tools, the hub's `--with-translation` rejection, and hub sync/build
fixes not yet backported here — are whitelisted with a reason in
`repo_en/tools/verify/tools-template.mjs`; everything else is a failure. The
`tools/translate/` libraries the hub keeps are byte-identical to this template,
which is the point: there is one copy of that code.

## What the template does not own

Copied content is the hub's, not the template's: the content roots (`docs/`,
`versioned_docs/`, `hardware/`, `blog/`, `changelog/`, `data/`, `sidebars*.ts`,
`versioned_sidebars/`, `versions.json`, `locales.json`) are written into the
locale repository by the hub's `content:publish` job and are replaced wholesale on
the next publish. Wording belongs in `i18n/<locale>/` (generated) or in `config/`
(the locale's own policy files).

## Placeholders

Replaced in every text file when a repository is scaffolded from the template:

| Placeholder | Value | Source |
| --- | --- | --- |
| `{{LOCALE}}` | BCP 47 tag, e.g. `ru-RU` | `--code` |
| `{{LOCALE_LABEL}}` | display label, e.g. `Русский` | `--label` |
| `{{SLUG}}` | file / repository slug, e.g. `ru_ru` | derived from `--code` |
| `{{REPO}}` | `owner/name` of the new repository | `--repo` |
| `{{BASE_URL}}` | path prefix, starts and ends with `/` | `--base-url` |
| `{{SITE}}` | absolute site address (origin + baseUrl) | `--site` |
| `{{SITE_ORIGIN}}` | origin of `{{SITE}}` | derived |
| `{{HUB_REPO}}` | the hub's `owner/name` | `locales.json` `en` |
| `{{HUB_BASE_URL}}` | the hub's `baseUrl` | `locales.json` `en` |
| `{{ASSET_ORIGIN}}` | shared asset host (the hub's site) | derived |
| `{{LOCALE_ENV}}` | environment-variable prefix, e.g. `RU` | derived |

The scaffolder does not create the GitHub repository, extend the cross-repo
token, or set the Actions variables/secrets — those are permissions and
production side effects it prints as a checklist instead.
