---
sidebar_key: "cli-reference/interface/mesh/traceroute"
sidebar_position: 4
title: "traceroute"
sidebar_label: 'traceroute'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/mesh/traceroute
captured_at: '2026-11-01T21:22:53+08:00'
---

-----------

## interface/mesh/traceroute 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="mesh" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="hoplimit" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="time" typ="num"></ArgTableRow>
<ArgTableRow arg="status" typ="enum (success | ttl-exceeded | no-route | timeout) { success:1, ttl-exceeded:2, no-route:3, timeout:4 }"></ArgTableRow>
</ArgTable>
