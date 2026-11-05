---
sidebar_key: "cli-reference/interface/ethernet/switch/shaper"
sidebar_position: 24
title: "shaper"
sidebar_label: 'shaper'
source: https://manual.mikrotik.com/docs/cli-reference/interface/ethernet/switch/shaper
captured_at: '2026-11-01T21:27:19+08:00'
---

-----------

## interface/ethernet/switch/shaper 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="port" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="target" typ="enum (queue0 | queue1 | queue2 | queue3 | queue4 | queue5 | queue6 | queue7 | wrr-group0 | wrr-group1 | port) { queue0:0, queue1:1, queue2:2, queue3:3, queue4:4, queue5:5, queue6:6, queue7:7, wrr-group0:8, wrr-group1:9, port:10 }"></ArgTableRow>
<ArgTableRow arg="meter-unit" typ="enum (bit | packet) { bit:0, packet:1 }"></ArgTableRow>
<ArgTableRow arg="rate" typ="num"></ArgTableRow>
<ArgTableRow arg="burst" typ="num"></ArgTableRow>
</ArgTable>
