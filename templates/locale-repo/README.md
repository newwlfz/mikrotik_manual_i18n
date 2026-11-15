# MikroTik RouterOS Manual — {{LOCALE_LABEL}} ({{LOCALE}})

**This repository builds the `{{LOCALE}}` site only.** The English site is a
different repository ([`{{HUB_REPO}}`](https://github.com/{{HUB_REPO}})) and a
different GitHub Pages deployment; both share the same `docusaurus.config.ts`
and the same root `locales.json` (the locale registry, pushed here by the hub).
Everything that differs between the sites comes from the registry plus
environment variables — no site address is written into the config.

Repository <https://github.com/{{REPO}}> · deployed at <{{SITE}}>.

## What this repository owns

| Owner | Content | Where |
| --- | --- | --- |
| **This repository** | Translation overlays `i18n/{{LOCALE}}/**` (the only copy of the `{{LOCALE_LABEL}}` wording) | committed |
| **This repository** | Translation policy: `config/translation.yml`, `config/glossary/`, `config/translation-patches/`, `config/english-only-blocks.yml` | committed |
| **This repository** | Translation progress: `work/translate/*.json` and `state/translation-state.json` | committed |
| **This repository** | Site code and site-level configuration: `src/`, `tools/`, `docusaurus.config.ts`, `.github/workflows/pages.yml` | committed |
| Hub `{{HUB_REPO}}` | English content: `docs/`, `versioned_docs/`, `hardware/`, `blog/`, `changelog/`, `data/`, `sidebars.ts`, `sidebars-hardware.ts`, `versioned_sidebars/`, `versions.json`, and `locales.json` | **committed here, written by the hub's `publish-content` job** |
| Hub `{{HUB_REPO}}` | Assets `static/` (images, PDFs, video) | **not in this repository** (referenced from the hub at build time) |
| Shared | Build-time rewrite of asset references to `ASSET_ORIGIN` (the hub's base address) | — |

Never edit a content root by hand: the hub replaces those trees wholesale on the
next publish, and a hand edit is lost without a warning. Wording belongs in
`i18n/{{LOCALE}}/` (generated) or in `config/`.

## Translation pipeline

`.github/workflows/pages.yml` runs one translate batch per push (or on manual
dispatch, with a time budget), commits its progress back to `main`, and only
builds and deploys when `pending` reaches 0. A failed batch leaves the previous
deployment live. The endpoint, model and API key are **not** in this repository:

| Kind | Name | Purpose |
| --- | --- | --- |
| Actions variable | `LLM_BASE_URL` | OpenAI-compatible endpoint |
| Actions variable | `LLM_MODEL` | model name |
| Actions secret | `LLM_API_KEY` | API key |

Set them under *Settings → Secrets and variables → Actions*. Without them the
translate job fails fast on its preflight request and nothing is published.

```bash
npm ci
npm run translate:pending -- --json     # how many units are left
npm run verify:llm -- --quick           # preflight (max_tokens=8)
npm run translate:batch -- --budget-minutes=5 --json   # one short local batch
npm run translate:verify                # overlay structure check
npm run build                           # CLI model + Docusaurus + Pagefind
```

The pipeline in depth is documented in [`TRANSLATION.md`](TRANSLATION.md); the
tools in [`tools/README.md`](tools/README.md).

## Deployment variables

`pages.yml` sets these; the defaults below are what a new site starts from.

| Variable | Value | Meaning |
| --- | --- | --- |
| `SITE_LOCALE` | `{{LOCALE}}` | The single locale this build produces |
| `SITE_URL` | `{{SITE_ORIGIN}}` | This site's origin (`canonical`, `hreflang`) |
| `BASE_URL` | `{{BASE_URL}}` | This site's path prefix |
| `ASSET_ORIGIN` | `{{ASSET_ORIGIN}}` | Shared asset origin (the hub's base address, no trailing slash) |
| `BUILD_HEAP_MB` | `6144` | Node heap for the build |

The other locales' addresses come from `locales.json`; do not hardcode them.
`LOCALE_<PRIMARY_SUBTAG>_URL` / `_BASE_URL` exist for local previews only
(`{{LOCALE}}` → `{{LOCALE_ENV}}`).

## First run

The repository is scaffolded by the hub's `npm run locale:add` and contains no
content yet. Until the hub publishes for the first time, `pages.yml` stops at
its "verify content roots" step (there is no `docs/` yet); that is expected.
Run the hub's publish (`npm run content:publish -- --only={{LOCALE}}`) and the
next run has content to translate and build.
