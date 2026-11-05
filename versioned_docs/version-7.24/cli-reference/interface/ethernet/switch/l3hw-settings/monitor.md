---
sidebar_key: "cli-reference/interface/ethernet/switch/l3hw-settings/monitor"
sidebar_position: 3
title: "monitor"
description: 'RouterOS command reference for /interface/ethernet/switch/l3hw-settings/monitor.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/l3hw-settings/monitor
captured_at: '2026-11-01T21:27:13+08:00'
---

-----------

## interface/ethernet/switch/l3hw-settings/monitor 
**Syscap:** rbswitch and crs_prestera
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="state" typ="enum (ok | stopping | starting | fib-failure | net-failure | switch-failure | fasttrack-failure | out-of-memory) { ok:0, stopping:1, starting:2, fib-failure:3, net-failure:4, switch-failure:5, fasttrack-failure:6, out-of-memory:0xFFFFFFF4 }"></ArgTableRow>
<ArgTableRow arg="ipv4-routes-total" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-routes-hw" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-routes-cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-shortest-hw-prefix" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-hosts" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-routes-total" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-routes-hw" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-routes-cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-shortest-hw-prefix" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-hosts" typ="num"></ArgTableRow>
<ArgTableRow arg="route-queue-size" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="nexthop-cap" typ="num"></ArgTableRow>
<ArgTableRow arg="nexthop-usage" typ="num"></ArgTableRow>
<ArgTableRow arg="vxlan-mtu-packet-drop" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-ipv4-conns" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-hw-min-speed" typ="num" syscap="prestera-bc2"></ArgTableRow>
</ArgTable>
