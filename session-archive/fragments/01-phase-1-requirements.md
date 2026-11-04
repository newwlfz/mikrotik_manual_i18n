# Phase 1 requirements and red lines

Source anchors: `transcript.md#turn-1` (initial brief), `transcript.md#turn-2`
(workspace clarification).

## Scope

- Full mirror of the four public sections:
  1. RouterOS documentation, version **7.24 only**;
  2. Hardware Guides;
  3. Product news (`/blog/`);
  4. Docs Changes (`/changelog/`).
- Plus a CLI Reference comparison page. In phase 1, 7.24 is compared against
  itself and must report zero differences.
- Docusaurus build must work locally and be visually compared with the official
  site through Playwright.

## Hard constraints

- The two old directories are **not** inputs:
  - `mikrotik-docs-i18n/`
  - `mikrotik_manual_i18n/`
- Do not invent routes, versioning, plugin separation, or a custom replacement
  for Docusaurus mechanisms. Use the official architecture.
- No translation work in phase 1.
- No language switcher in phase 1.
- No GitHub Actions in phase 1.
- Do not link the old Git remote.
- Official CSS, JavaScript and static assets should be reused as far as is
  technically sound.
- The synchroniser must be incremental-ready from the first version.
- Temporary files belong in a system temp directory or a dedicated ignored
  directory.
- Conversation history must be persisted with a summary index and extractable
  fragments.

## Acceptance evidence

- All four sections exist locally and render.
- No image depends on the official CDN.
- Three deliberately deleted files (docs, hardware, blog) are detected and
  restored by the sync command.
- `npm run build` passes with broken-link checks enabled.
- Playwright screenshots and DOM reports compare local pages with official
  pages.
- `sync_state.json` records every mirrored file and its hash.
