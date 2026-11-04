# Pipeline

All fetching and transformation code lives here. Nothing in this directory is
imported by the browser bundle.

Planned modules:

- `archive/` — DSH session exporter (already present).
- `fetch/` — HTTP client, Playwright renderer, retry/backoff, rate limit.
- `transform/` — docs `.md` normalisation, HTML→MDX, frontmatter.
- `assets/` — image download, hashing, reference rewriting.
- `cli/` — `<ArgTable>` parsing, JSON model, comparison.
- `state/` — atomic `sync_state.json` reads/writes and locking.
- `verify/` — inventory, links, hashes, Playwright DOM/screenshot reports.

Rules:

- Idempotent writes.
- No temporary file inside a content directory.
- Resumable state under `work/`.
- A failed item never corrupts `sync_state.json`.
- Every network fetch records its source URL and SHA-256.
