---
sidebar_key: "cli-reference/interface/bonding/monitor"
sidebar_position: 2
title: "monitor"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bonding/monitor
captured_at: '2026-11-01T21:26:57+08:00'
---

-----------

## interface/bonding/monitor 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="mode" typ="enum (balance-rr | active-backup | balance-xor | broadcast | 802.3ad | balance-tlb | balance-alb) { balance-rr:0, active-backup:1, balance-xor:2, broadcast:3, 802.3ad:4, balance-tlb:5, balance-alb:6 }"></ArgTableRow>
<ArgTableRow arg="active-ports" typ="multi { array-id, port: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="inactive-ports" typ="multi { array-id, port: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="lacp-system-id" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="lacp-system-priority" typ="num"></ArgTableRow>
<ArgTableRow arg="lacp-partner-system-id" typ="macAddr"></ArgTableRow>
</ArgTable>
