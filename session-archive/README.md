# Session archive

This directory stores the human-visible history of the project conversations so
that a later session can recover decisions without replaying the whole chat.

## Layers

```text
session-archive/
├─ index.json                 # machine-readable entry point
├─ README.md                  # this file
├─ summaries/                 # one short brief per session
├─ fragments/                 # topic-sized extracts, safe to load alone
└─ sessions/
   └─ <date>-<session>/
      ├─ transcript.md        # every human prompt + visible assistant text
      ├─ tool-log.md          # every tool call + complete result
      └─ meta.json            # ids, counts, source log, timestamps
```

`transcript.md` is the narrative source. `tool-log.md` is the audit trail.
Hidden model reasoning is intentionally not copied. The raw DSH session log
remains under `~/.dsh/sessions/` and is referenced by `meta.json`; it is not
committed.

## How a later session should read this

1. Read `index.json`.
2. Read the matching `summaries/*.md`.
3. Load only the `fragments/*.md` whose `topics` or `keywords` match the task.
4. If exact wording matters, open the `transcript.md` anchor named in the
   fragment.
5. If a command or its output matters, open the matching `tool-NNN` anchor in
   `tool-log.md`.

This keeps a new context small while preserving the complete source.

## Adding a new session

```bash
python3 pipeline/archive/export_session.py \
  --session-id "$DSH_SESSION_ID" \
  --out session-archive/sessions/<date>-<session>
```

Then add a summary and fragments, and append an entry to `index.json`.
