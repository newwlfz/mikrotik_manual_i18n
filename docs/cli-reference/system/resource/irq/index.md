---
sidebar_key: "cli-reference/system/resource/irq/index"
sidebar_position: 1
title: "irq"
sidebar_label: 'irq'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/resource/irq
captured_at: '2026-11-01T21:25:40+08:00'
---

-----------

## system/resource/irq 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="o" typ="read-only"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="cpu" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="irq" typ="num"></ArgTableRow>
<ArgTableRow arg="users" typ="object { user: alt { interface: iface_enum
, other: string
 }
 }"></ArgTableRow>
<ArgTableRow arg="active-cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="count" typ="num"></ArgTableRow>
<ArgTableRow arg="per-cpu-count" typ="multi { count: num
 }"></ArgTableRow>
</ArgTable>
