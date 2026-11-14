# State (committed)

Workflow state that must survive between GitHub Actions runs.

- `sync_state.json` — source URL, source hash, local hash, assets and last
  successful sync for every mirrored item.

`translation_state.json` lives in the Chinese repository
(`mikrotik_manual_zh_hans`): this repository builds English only and has no
`i18n/` overlays, so it has no per-locale translation state to track.

These files are committed so the scheduled workflow can detect changes without
a database. Writes must be atomic (temporary file + rename) and deterministic
(JSON keys sorted) to keep diffs reviewable.
