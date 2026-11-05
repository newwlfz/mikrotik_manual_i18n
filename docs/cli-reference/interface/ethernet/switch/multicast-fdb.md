---
sidebar_key: "cli-reference/interface/ethernet/switch/multicast-fdb"
sidebar_position: 12
title: "multicast-fdb"
sidebar_label: 'multicast-fdb'
source: https://manual.mikrotik.com/docs/cli-reference/interface/ethernet/switch/multicast-fdb
captured_at: '2026-11-01T21:27:14+08:00'
---

-----------

## interface/ethernet/switch/multicast-fdb 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { mac-address: macAddr
, ip-address: ipAddr
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="ports" typ="multi { array-id }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="svl" typ="bool"></ArgTableRow>
<ArgTableRow arg="bypass-vlan-filter" typ="bool"></ArgTableRow>
<ArgTableRow arg="qos-group" typ="enum (none) { none:0xffffffff }"></ArgTableRow>
</ArgTable>
