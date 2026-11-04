---
sidebar_key: "cli-reference/interface/bridge/mdb"
sidebar_position: 5
title: "mdb"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bridge/mdb
captured_at: '2026-11-01T21:26:59+08:00'
---

-----------

## interface/bridge/mdb 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="group" typ="address (flags=46m)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="interface" typ="multi { array-id, interface: iface_enum
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="bridge" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="vid" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="on-interface" typ="multi { array-id, interface: iface_enum
 }"></ArgTableRow>
</ArgTable>
