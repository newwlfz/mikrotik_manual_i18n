---
sidebar_key: "cli-reference/tool/traffic-monitor"
sidebar_position: 26
title: "traffic-monitor"
sidebar_label: 'traffic-monitor'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/traffic-monitor
captured_at: '2026-11-01T21:30:27+08:00'
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
