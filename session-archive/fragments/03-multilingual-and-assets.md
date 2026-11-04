# Multilingual and asset layout

Source anchor: `transcript.md#turn-2`.

## Rule

English is the canonical locale and lives in the normal Docusaurus content
directories. Every other locale is a Docusaurus i18n overlay with the same
relative path. There is no second full content tree.

| Section | English | Translation overlay | Route |
| --- | --- | --- | --- |
| RouterOS 7.24 | `versioned_docs/version-7.24/` | `i18n/<locale>/docusaurus-plugin-content-docs/version-7.24/` | `/<locale>/docs/7.24/...` |
| Hardware | `hardware/` | `i18n/<locale>/docusaurus-plugin-content-docs-hardware/current/` | `/<locale>/hardware/...` |
| Product news | `blog/` | `i18n/<locale>/docusaurus-plugin-content-blog/` | `/<locale>/blog/...` |
| Docs Changes | `changelog/` | `i18n/<locale>/docusaurus-plugin-content-blog-changelog/` | `/<locale>/changelog/...` |
| CLI compare | `data/cli/7.24/en.json` | `data/cli/7.24/<locale>.json` | `/<locale>/docs/7.24/cli-reference/compare-versions/` |
| Navbar / footer | theme config | `i18n/<locale>/docusaurus-theme-classic/` | locale-prefixed |
| UI strings | source strings | `i18n/<locale>/code.json` | locale-prefixed |

The default English route has no locale prefix. A Chinese example would be
`/zh-Hans/docs/7.24/introduction`.

## Translation rules

- Same file names and slugs as English.
- Model numbers, CLI tokens, command paths and type names stay unchanged.
- Prose, headings, table descriptions, navigation labels and compare legend
  are translated.
- Missing translations fall back to English; partial locales are valid.
- No language switcher is enabled in phase 1. The config and folders are
  prepared but `locales` stays `['en']` until phase 2.

## Official CSS/JS policy

- Reuse official static assets verbatim: logo, favicon, fonts, icons, images.
- Snapshot official CSS/JS under `vendor/official/3.10.1/` with URL and SHA-256.
- Do **not** inject the official compiled `main.js` or `runtime~main.js`: they
  embed the official route/chunk map and would load official data.
- Regenerate runtime code with the same Docusaurus 3.10.1 version.
- Use official CSS as the comparison baseline; reuse separable custom rules
  verbatim. Do not force a CSS file whose build-hashed class names do not match
  the local DOM.
- Verify with computed styles and DOM landmarks, not screenshots alone.

## Incremental and temporary files

- `data/sync_state.json` is the authoritative state; atomic writes only.
- Modes: `--full`, `--check`, `--repair`, `--only`, `--dry-run`.
- HTML-only sections hash the normalised Markdown, not raw HTML.
- `work/` is git-ignored and holds resumable snapshots/queues/logs.
- One-off downloads use the system temp directory.
- No temp file is written inside a content directory.
