---
sidebar_key: "cli-reference/interface/bonding/index"
sidebar_position: 1
title: "bonding"
sidebar_label: 'bonding'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bonding
captured_at: '2026-11-01T21:26:59+08:00'
---

-----------

## interface/bonding 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="R" typ="running">running</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="forced-mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="arp" typ="enum (disabled | enabled | proxy-arp | reply-only | local-proxy-arp) { disabled:0, enabled:1, proxy-arp:2, reply-only:3, local-proxy-arp:4 }"></ArgTableRow>
<ArgTableRow arg="arp-timeout" typ="alt { arp-timeout: enum (auto) { auto:0 }
, arp-timeout: time
 }"></ArgTableRow>
<ArgTableRow arg="slaves" typ="multi { array-id, slave: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="mode" typ="enum (balance-rr | active-backup | balance-xor | broadcast | 802.3ad | balance-tlb | balance-alb) { balance-rr:0, active-backup:1, balance-xor:2, broadcast:3, 802.3ad:4, balance-tlb:5, balance-alb:6 }"></ArgTableRow>
<ArgTableRow arg="primary" typ="iface_enum { none:0 }"></ArgTableRow>
<ArgTableRow arg="link-monitoring" typ="enum (none | arp | mii) { none:0, arp:1, mii:2 }"></ArgTableRow>
<ArgTableRow arg="arp-interval" typ="time"></ArgTableRow>
<ArgTableRow arg="arp-ip-targets" typ="multi { array-id, arp-target: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="mii-interval" typ="time"></ArgTableRow>
<ArgTableRow arg="down-delay" typ="time"></ArgTableRow>
<ArgTableRow arg="up-delay" typ="time"></ArgTableRow>
<ArgTableRow arg="lacp-rate" typ="enum (30secs | 1sec) { 30secs:0, 1sec:1 }"></ArgTableRow>
<ArgTableRow arg="transmit-hash-policy" typ="enum (layer-2 | layer-3-and-4 | layer-2-and-3 | encap-2-and-3 | encap-3-and-4) { layer-2:0, layer-3-and-4:1, layer-2-and-3:2, encap-2-and-3:3, encap-3-and-4:4 }"></ArgTableRow>
<ArgTableRow arg="min-links" typ="num"></ArgTableRow>
<ArgTableRow arg="mlag-id" typ="num"></ArgTableRow>
<ArgTableRow arg="lacp-user-key" typ="num"></ArgTableRow>
<ArgTableRow arg="lacp-mode" typ="enum (passive | active) { passive:0, active:1 }"></ArgTableRow>
<ArgTableRow arg="lacp-system-id" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="lacp-system-priority" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
</ArgTable>
