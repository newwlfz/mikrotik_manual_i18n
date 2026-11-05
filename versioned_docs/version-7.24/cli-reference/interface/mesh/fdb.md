---
sidebar_key: "cli-reference/interface/mesh/fdb"
sidebar_position: 1
title: "fdb"
sidebar_label: 'fdb'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/mesh/fdb
captured_at: '2026-11-01T21:27:31+08:00'
---

-----------

## interface/mesh/fdb 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="A" typ="active">active</ArgTableRow>
<ArgTableRow arg="R" typ="root">root</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="mesh" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (local | outsider | direct | mesh | neighbor | larval | unknown) { local:1, outsider:2, direct:3, mesh:4, neighbor:5, larval:6, unknown:7 }"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="on-interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="lifetime" typ="time"></ArgTableRow>
<ArgTableRow arg="age" typ="time"></ArgTableRow>
<ArgTableRow arg="metric" typ="num"></ArgTableRow>
<ArgTableRow arg="seq-number" typ="num"></ArgTableRow>
</ArgTable>
