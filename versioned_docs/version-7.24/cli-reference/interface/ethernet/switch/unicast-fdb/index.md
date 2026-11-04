---
sidebar_key: "cli-reference/interface/ethernet/switch/unicast-fdb/index"
sidebar_position: 2
title: "unicast-fdb"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/unicast-fdb
captured_at: '2026-11-01T21:27:19+08:00'
---

-----------

## interface/ethernet/switch/unicast-fdb 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
<ArgTableRow arg="A" typ="active"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="mac-address" typ="macAddr" mandatory="1"></ArgTableRow>
<ArgTableRow arg="port" typ="alt { port: enum
, trunk: enum
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (forward | src-drop | dst-drop | src-and-dst-drop | ingress-port-policing-bypass | src-redirect-to-cpu | dst-redirect-to-cpu | src-and-dst-redirect-to-cpu) { forward:0, src-drop:1, dst-drop:2, src-and-dst-drop:3, ingress-port-policing-bypass:4, src-redirect-to-cpu:5, dst-redirect-to-cpu:6, src-and-dst-redirect-to-cpu:7 }"></ArgTableRow>
<ArgTableRow arg="mirror" typ="bool"></ArgTableRow>
<ArgTableRow arg="isolation-profile" typ="enum (promiscuous | isolated | community1 | community2) { promiscuous:0, isolated:1, community1:2, community2:3 }"></ArgTableRow>
<ArgTableRow arg="svl" typ="bool"></ArgTableRow>
<ArgTableRow arg="qos-group" typ="enum (none) { none:0xffffffff }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="age" typ="num"></ArgTableRow>
</ArgTable>
