---
sidebar_key: "cli-reference/interface/bridge/monitor"
sidebar_position: 6
title: "monitor"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bridge/monitor
captured_at: '2026-11-01T21:26:59+08:00'
---

-----------

## interface/bridge/monitor 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="state" typ="enum (disabled | disabled | enabled | enabled)"></ArgTableRow>
<ArgTableRow arg="current-mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="bridge-id" typ="composite { prio: num
, mac: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="root-bridge" typ="bool"></ArgTableRow>
<ArgTableRow arg="root-bridge-id" typ="composite { prio: num
, mac: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="regional-root-bridge-id" typ="composite { prio: num
, mac: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="root-path-cost" typ="num"></ArgTableRow>
<ArgTableRow arg="root-port" typ="iface_enum { none:0 }"></ArgTableRow>
<ArgTableRow arg="port-count" typ="num"></ArgTableRow>
<ArgTableRow arg="designated-port-count" typ="num"></ArgTableRow>
<ArgTableRow arg="mst-config-digest" typ="string"></ArgTableRow>
<ArgTableRow arg="fast-forward" typ="bool"></ArgTableRow>
<ArgTableRow arg="multicast-router" typ="bool"></ArgTableRow>
<ArgTableRow arg="igmp-querier" typ="composite { interface: iface_enum { none:0 }
, ip-address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="mld-querier" typ="composite { interface: iface_enum { none:0 }
, ipv6-address: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="declared-vlan-ids" typ="multi { vlan-range: range
 }"></ArgTableRow>
<ArgTableRow arg="registered-vlan-ids" typ="multi { vlan-range: range
 }"></ArgTableRow>
<ArgTableRow arg="mlag-state" typ="string"></ArgTableRow>
<ArgTableRow arg="mlag-active-role" typ="enum (primary | secondary)"></ArgTableRow>
</ArgTable>
