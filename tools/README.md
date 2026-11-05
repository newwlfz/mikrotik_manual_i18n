# Tools

The production automation lives here so the GitHub repository is a complete
site + workflow project, not just build output.

Planned CLI surface:

```bash
npm run sync -- --check          # detect remote changes, no writes
npm run sync -- --update         # fetch normalise and write content
npm run sync -- --repair         # restore missing or changed local files
npm run sync -- --only=docs,hardware,blog,changelog
# Phase 2 only:
# npm run translate -- --changed
# npm run translate -- --locale=zh-Hans --force
npm run verify                   # link, asset and inventory checks
```

Version pipeline:

```bash
# Snapshot the current docs/ tree and generate the native versioned sidebar.
node tools/sync/snapshot-version.mjs --version 7.24

# Install a newer version as docs/ (structure normalisation + link rewrite).
node tools/sync/install-version.mjs --version 7.25 --source <dir>

# Crawl the official sidebar for a version and write sidebars.ts or the
# versioned sidebar JSON.
node tools/sync/crawl-sidebar.mjs --version 7.25 --out data/manifests/docs-7.25-sidebar.json
node tools/sync/build-sidebars.mjs --version 7.25 --compare

# Regenerate metadata, tags, labels, categories and CLI data for every version.
npm run metadata:build

# Re-fetch pages that a strict build reported as broken-link sources.
node tools/sync/repair-doc-links.mjs --version 7.25 --docs docs --log <build.log>
```

Directories:

- `sync/` — inventory, HTTP fetch, Playwright render, transform, state,
  version cut, sidebar generation and metadata extraction.
- `cli/` — per-version CLI model and the multi-version comparison index.
- `translate/` — phase 2 only; config-driven Markdown translation. Not
  implemented or invoked in phase 1.
- `verify/` — link/asset/state checks used by CI.

Implementation rules:

- No generated file is written without a state entry.
- Missing local files are always repairable.
- A failed locale translation never blocks the English build.
- Translation preserves frontmatter keys, code fences, URLs and MDX names.
- All CLI commands support `--dry-run`.
