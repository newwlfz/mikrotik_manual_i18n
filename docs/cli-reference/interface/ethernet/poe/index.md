---
sidebar_key: "cli-reference/interface/ethernet/poe/index"
sidebar_position: 1
title: "poe"
sidebar_label: 'poe'
source: https://manual.mikrotik.com/docs/cli-reference/interface/ethernet/poe
captured_at: '2026-11-01T21:27:05+08:00'
---

-----------

## interface/ethernet/poe 
**Syscap:** (poe or poe-in)
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="poe-out" typ="enum (off | auto-on | forced-on) { off:0, auto-on:1, forced-on:2 }" syscap="(!poe-4p-power and poe)"></ArgTableRow>
<ArgTableRow arg="poe-voltage" typ="enum (auto | low | high) { auto:0, low:1, high:2 }" syscap="poe"></ArgTableRow>
<ArgTableRow arg="poe-priority" typ="num" syscap="poe"></ArgTableRow>
<ArgTableRow arg="power-cycle-ping-enabled" typ="bool" syscap="poe"></ArgTableRow>
<ArgTableRow arg="power-cycle-ping-address" typ="alt { ip: ipAddr
, ipv6: ip6Addr
, mac: macAddr
 }" syscap="poe"></ArgTableRow>
<ArgTableRow arg="power-cycle-ping-timeout" typ="time" syscap="poe"></ArgTableRow>
<ArgTableRow arg="power-cycle-interval" typ="alt { symbolic-names: enum (none) { none:0 }
, time-interval: time
 }" syscap="poe"></ArgTableRow>
</ArgTable>
