# Session archive exporter

`export_session.py` reads the current DSH session log (multi-frame Zstandard)
and writes:

- `transcript.md`: human prompts and visible assistant text;
- `tool-log.md`: every tool call with its complete result;
- `meta.json`: session identity, counts and source log path.

Usage:

```bash
python3 pipeline/archive/export_session.py \
  --session-id "$DSH_SESSION_ID" \
  --out session-archive/sessions/2026-11-04-session-01
```

The exporter deliberately omits hidden model reasoning. It does not modify the
session log and does not copy images.
