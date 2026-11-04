#!/usr/bin/env python3
"""Export a DSH session log into a readable transcript plus a full tool audit.

The archive intentionally keeps two layers:

* ``transcript.md`` contains every human prompt and every visible assistant
  text block.  It is the file a future session should read first.
* ``tool-log.md`` contains every tool call and its complete result, linked to
  the transcript by stable ``tool-NNN`` anchors.

Hidden model reasoning is not copied into either file.  The session log itself
remains the authoritative source if an exact raw event is ever needed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Shanghai")


def find_session_log(session_id: str, dsh_home: Path) -> Path:
    sessions = dsh_home / "sessions"
    if not sessions.is_dir():
        raise SystemExit(f"DSH sessions directory not found: {sessions}")
    candidates = sorted(sessions.glob(f"*/{session_id}/session.v*.jsonl.zstd"))
    if not candidates:
        raise SystemExit(f"no session.v*.jsonl.zstd found for {session_id}")
    # Highest format version wins.
    def version(path: Path) -> int:
        match = re.search(r"session\.v(\d+)\.jsonl\.zstd$", path.name)
        return int(match.group(1)) if match else -1

    return max(candidates, key=version)


def decode(path: Path) -> list[dict]:
    proc = subprocess.run(
        ["zstd", "-dc", str(path)],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        raise SystemExit(f"zstd failed: {proc.stderr.decode('utf-8', 'replace')}")
    events: list[dict] = []
    for line in proc.stdout.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"invalid JSONL event: {exc}") from exc
    return events


def stamp(ms: int | None) -> str:
    if not ms:
        return "未知时间"
    return datetime.fromtimestamp(ms / 1000, TZ).strftime("%Y-%m-%d %H:%M:%S %Z")


def fence(text: str, language: str = "") -> str:
    longest = 2
    for match in re.finditer(r"`+", text):
        longest = max(longest, len(match.group(0)))
    ticks = "`" * (longest + 1)
    return f"{ticks}{language}\n{text}\n{ticks}"


def text_blocks(message: dict) -> list[str]:
    out: list[str] = []
    for item in message.get("content", []):
        if item.get("type") == "text" and item.get("text"):
            out.append(item["text"])
    return out


def human_prompt(event: dict) -> str | None:
    data = event.get("data", {})
    source = data.get("source") or {}
    if data.get("role") != "user":
        return None
    if source.get("kind") not in (None, "user"):
        return None
    text = "\n\n".join(text_blocks(data))
    return text or None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--dsh-home", type=Path, default=Path(os.environ.get("DSH_HOME", "~/.dsh")).expanduser())
    args = parser.parse_args()

    log_path = find_session_log(args.session_id, args.dsh_home)
    events = decode(log_path)
    events.sort(key=lambda item: item.get("seq", -1))

    session = next((e for e in events if e.get("type") == "session"), {})
    title_event = next((e for e in events if e.get("type") == "session/title"), {})
    title = (title_event.get("data") or {}).get("title") or "未命名会话"
    title = re.sub(r"^#+\s*", "", title).strip() or "未命名会话"

    # Pair calls with results by call id.
    calls: dict[str, dict] = {}
    order: list[str] = []
    for event in events:
        if event.get("type") == "tool/call":
            data = event.get("data", {})
            call_id = data.get("callId")
            if not call_id:
                continue
            calls[call_id] = {
                "call": event,
                "result": None,
                "name": data.get("name", "unknown"),
                "arguments": data.get("arguments", ""),
                "turn": data.get("turn"),
                "step": data.get("step"),
            }
            order.append(call_id)
        elif event.get("type") == "tool/result":
            data = event.get("data", {})
            call_id = data.get("toolCallId") or (data.get("message", {}).get("source") or {}).get("callId")
            if call_id and call_id in calls:
                calls[call_id]["result"] = event

    # Number tools in session order for stable anchors.
    for index, call_id in enumerate(order, start=1):
        calls[call_id]["anchor"] = f"tool-{index:03d}"

    turns: dict[int, list[dict]] = {}
    turn_order: list[int] = []
    current_turn = 0
    for event in events:
        data = event.get("data", {})
        if event.get("type") == "turn/start":
            current_turn = data.get("turn", current_turn)
        if event.get("type") not in ("user/message", "assistant/message"):
            continue
        # user/message has no turn field, so inherit the surrounding turn.
        turn = data.get("turn", current_turn)
        if turn is None:
            continue
        if turn not in turns:
            turns[turn] = []
            turn_order.append(turn)
        turns[turn].append(event)

    # Tools grouped by turn.
    tools_by_turn: dict[int, list[dict]] = {}
    for call_id in order:
        info = calls[call_id]
        turn = info.get("turn")
        if turn is None:
            continue
        tools_by_turn.setdefault(turn, []).append(info)

    args.out.mkdir(parents=True, exist_ok=True)
    transcript_path = args.out / "transcript.md"
    tools_path = args.out / "tool-log.md"

    lines: list[str] = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append("> 由 `pipeline/archive/export_session.py` 从 DSH 会话日志导出。只保留人类可见内容；隐藏推理不落盘。")
    lines.append("")
    lines.append("| 项 | 内容 |")
    lines.append("| --- | --- |")
    lines.append(f"| Session | `{session.get('id', args.session_id)}` |")
    lines.append(f"| 工作目录 | `{session.get('cwd', '')}` |")
    lines.append(f"| 创建时间 | {stamp(session.get('createdAt'))} |")
    lines.append(f"| 导出时间 | {stamp(int(datetime.now(TZ).timestamp() * 1000))} |")
    lines.append(f"| 轮次 | {len(turn_order)} |")
    lines.append(f"| 工具调用 | {len(order)} |")
    lines.append(f"| 工具审计 | [tool-log.md](tool-log.md) |")
    lines.append("")

    for turn in turn_order:
        turn_start = next((e for e in events if e.get("type") == "turn/start" and (e.get("data") or {}).get("turn") == turn), None)
        lines.append(f'<a id="turn-{turn}"></a>')
        lines.append("")
        lines.append(f"## 回合 {turn} · {stamp((turn_start or {}).get('time'))}")
        lines.append("")
        for event in turns[turn]:
            kind = event.get("type")
            data = event.get("data", {})
            if kind == "user/message":
                prompt = human_prompt(event)
                if not prompt:
                    continue
                lines.append("### 用户")
                lines.append("")
                lines.append(f"_时间：{stamp(event.get('time'))}_")
                lines.append("")
                lines.append(prompt.replace("\r\n", "\n").strip())
                lines.append("")
            elif kind == "assistant/message":
                blocks = text_blocks(data.get("message", {}))
                if not blocks:
                    continue
                lines.append(f"### 助手 · 步骤 {data.get('step', '?')}")
                lines.append("")
                lines.append(f"_时间：{stamp(event.get('time'))}_")
                lines.append("")
                for block in blocks:
                    lines.append(block.replace("\r\n", "\n").strip())
                    lines.append("")
        turn_tools = tools_by_turn.get(turn, [])
        if turn_tools:
            lines.append(f"> 本回合工具调用：{len(turn_tools)} 次，完整审计见 [tool-log.md#turn-{turn}](tool-log.md#turn-{turn})。")
            lines.append("")

    transcript_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

    tool_lines: list[str] = []
    tool_lines.append(f"# 工具审计 · {title}")
    tool_lines.append("")
    tool_lines.append("> 每次工具调用的参数与完整结果。与 `transcript.md` 中的回合一一对应。")
    tool_lines.append("")
    tool_lines.append(f"- Session：`{session.get('id', args.session_id)}`")
    tool_lines.append(f"- 工具调用：{len(order)}")
    tool_lines.append("")
    for turn in turn_order:
        turn_tools = tools_by_turn.get(turn, [])
        if not turn_tools:
            continue
        tool_lines.append(f'<a id="turn-{turn}"></a>')
        tool_lines.append("")
        tool_lines.append(f"## 回合 {turn}")
        tool_lines.append("")
        for info in turn_tools:
            call = info["call"]
            call_data = call.get("data", {})
            result_event = info.get("result")
            result_text = ""
            is_error = False
            if result_event:
                result_data = result_event.get("data", {})
                is_error = bool(result_data.get("message", {}).get("isError"))
                result_text = "\n\n".join(text_blocks(result_data.get("message", {})))
            args_text = info.get("arguments") or ""
            try:
                parsed_args = json.loads(args_text)
                args_text = json.dumps(parsed_args, ensure_ascii=False, indent=2)
            except (json.JSONDecodeError, TypeError):
                pass
            tool_lines.append(f'<a id="{info["anchor"]}"></a>')
            tool_lines.append("")
            tool_lines.append(f'### {info["anchor"]} · `{info["name"]}` · {stamp(call.get("time"))}')
            tool_lines.append("")
            tool_lines.append("**参数**")
            tool_lines.append("")
            tool_lines.append(fence(args_text, "json"))
            tool_lines.append("")
            tool_lines.append("**结果**" + ("（错误）" if is_error else ""))
            tool_lines.append("")
            tool_lines.append(fence(result_text.rstrip(), "text"))
            tool_lines.append("")

    tools_path.write_text("\n".join(tool_lines).rstrip() + "\n", encoding="utf-8")

    meta = {
        "session_id": session.get("id", args.session_id),
        "cwd": session.get("cwd"),
        "created_at": session.get("createdAt"),
        "created_at_local": stamp(session.get("createdAt")),
        "title": title,
        "turns": len(turn_order),
        "tool_calls": len(order),
        "transcript": "transcript.md",
        "tool_log": "tool-log.md",
        "source_log": str(log_path),
        "source_bytes": log_path.stat().st_size,
        "exported_at": stamp(int(datetime.now(TZ).timestamp() * 1000)),
    }
    (args.out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"wrote {transcript_path} ({transcript_path.stat().st_size} bytes)")
    print(f"wrote {tools_path} ({tools_path.stat().st_size} bytes)")
    print(f"wrote {args.out / 'meta.json'}")


if __name__ == "__main__":
    main()
