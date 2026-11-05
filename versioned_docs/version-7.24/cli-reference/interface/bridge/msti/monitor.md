---
sidebar_key: "cli-reference/interface/bridge/msti/monitor"
sidebar_position: 2
title: "monitor"
sidebar_label: 'monitor'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bridge/msti/monitor
captured_at: '2026-11-01T21:27:01+08:00'
---

-----------

## interface/bridge/msti/monitor 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="state" typ="enum (disabled | disabled | enabled | enabled)"></ArgTableRow>
<ArgTableRow arg="identifier" typ="num"></ArgTableRow>
<ArgTableRow arg="current-mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="bridge-id" typ="composite { prio: num
, mac: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="root-bridge" typ="bool"></ArgTableRow>
<ArgTableRow arg="regional-root-bridge-id" typ="composite { prio: num
, mac: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="root-path-cost" typ="num"></ArgTableRow>
<ArgTableRow arg="root-port" typ="iface_enum { none:0 }"></ArgTableRow>
<ArgTableRow arg="port-count" typ="num"></ArgTableRow>
<ArgTableRow arg="designated-port-count" typ="num"></ArgTableRow>
</ArgTable>
