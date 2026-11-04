---
sidebar_key: "cli-reference/interface/bridge/msrp/attributes"
sidebar_position: 1
title: "attributes"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bridge/msrp/attributes
captured_at: '2026-11-02T09:09:01+08:00'
---

-----------

## interface/bridge/msrp/attributes 
**Conditions:** MSRP_ENABLE
**Type:** Directory

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="bridge" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="port" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (TLKA | TLKF | LSTN-I | LSTN-AF | LSTN-R | LSTN-RF) { TLKA:1, TLKF:2, LSTN-I:3, LSTN-AF:4, LSTN-R:5, LSTN-RF:6 }"></ArgTableRow>
<ArgTableRow arg="registrar-state" typ="enum (IN | LV | MT) { IN:1, LV:2, MT:3 }"></ArgTableRow>
<ArgTableRow arg="applicant-state" typ="enum (Very anxious Observer | Very anxious Passive | Very anxious New | Anxious New | Anxious Active | Quiet Active | Leaving Active | Anxious Observer | Quiet Observer | Anxious Passive | Quiet Passive | Leaving Observer) { Very anxious Observer:1, Very anxious Passive:2, Very anxious New:3, Anxious New:4, Anxious Active:5, Quiet Active:6, Leaving Active:7, Anxious Observer:8, Quiet Observer:9, Anxious Passive:10, Quiet Passive:11, Leaving Observer:12 }"></ArgTableRow>
<ArgTableRow arg="last-event" typ="enum (New | JoinIn | In | JoinEmpty | Empty | Leave) { New:0, JoinIn:1, In:2, JoinEmpty:3, Empty:4, Leave:5 }"></ArgTableRow>
<ArgTableRow arg="stream-id" typ="composite { mac: macAddr
, address: num
 }"></ArgTableRow>
<ArgTableRow arg="dst-mac" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="vid" typ="num"></ArgTableRow>
<ArgTableRow arg="max-frame-size" typ="num"></ArgTableRow>
<ArgTableRow arg="max-interval-frames" typ="num"></ArgTableRow>
<ArgTableRow arg="priority" typ="num"></ArgTableRow>
<ArgTableRow arg="rank" typ="num"></ArgTableRow>
<ArgTableRow arg="code" typ="num"></ArgTableRow>
</ArgTable>
