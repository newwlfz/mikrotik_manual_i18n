# Data

Generated and curated data that is not page content.

- `sync_state.json` — authoritative incremental state.
- `manifests/` — inventories per section with source URL and hash.
- `cli/7.24/en.json` — parsed CLI model used by the comparison UI.
- `cli/7.24/<locale>.json` — future locale overlays.
- `schema/` — JSON schemas.

This directory is committed. Caches belong in `data/cache/` (ignored), not here.
