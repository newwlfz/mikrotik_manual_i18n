---
sidebar_key: "cli-reference/interface/bridge/msrp"
sidebar_position: 7
title: "msrp"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bridge/msrp
captured_at: '2026-11-02T09:09:00+08:00'
---

-----------

## interface/bridge/msrp 
**Conditions:** MSRP_ENABLE
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="bridge" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="rank" typ="num"></ArgTableRow>
<ArgTableRow arg="stream-id" typ="composite { mac: macAddr
, address: num
 }"></ArgTableRow>
<ArgTableRow arg="talker" typ="iface_enum { none }"></ArgTableRow>
<ArgTableRow arg="listener" typ="iface_enum { none }"></ArgTableRow>
<ArgTableRow arg="dst-mac" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="vid" typ="num"></ArgTableRow>
<ArgTableRow arg="max-frame-size" typ="num"></ArgTableRow>
<ArgTableRow arg="max-interval-frames" typ="num"></ArgTableRow>
<ArgTableRow arg="priority" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="age" typ="time"></ArgTableRow>
<ArgTableRow arg="active-talker" typ="iface_enum { none }"></ArgTableRow>
<ArgTableRow arg="active-listener" typ="iface_enum { none }"></ArgTableRow>
<ArgTableRow arg="debug-info" typ="string"></ArgTableRow>
</ArgTable>
