---
title: "interface"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/queue/interface
captured_at: '2026-11-28T10:17:19.424Z'
---

-----------

## queue/interface 
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="queue" typ="enum (no-queue) { no-queue:0 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="default-queue" typ="enum (no-queue) { no-queue:0 }"></ArgTableRow>
<ArgTableRow arg="active-queue" typ="enum (no-queue | queue-tree) { no-queue:0, queue-tree:0xfffffff9 }"></ArgTableRow>
</ArgTable>
