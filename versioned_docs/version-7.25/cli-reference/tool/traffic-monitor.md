---
title: "traffic-monitor"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/traffic-monitor
captured_at: '2026-11-28T10:17:19.424Z'
---

-----------

## tool/traffic-monitor 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="traffic" typ="enum (transmitted | received) { transmitted:1, received:2 }"></ArgTableRow>
<ArgTableRow arg="trigger" typ="enum (above | below | always) { above:1, below:2, always:3 }"></ArgTableRow>
<ArgTableRow arg="threshold" typ="num"></ArgTableRow>
<ArgTableRow arg="on-event" typ="alt { script: string
 }"></ArgTableRow>
</ArgTable>
