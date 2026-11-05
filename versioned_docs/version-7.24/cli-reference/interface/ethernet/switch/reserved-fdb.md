---
sidebar_key: "cli-reference/interface/ethernet/switch/reserved-fdb"
sidebar_position: 21
title: "reserved-fdb"
description: 'RouterOS directory reference for /interface/ethernet/switch/reserved-fdb.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/reserved-fdb
captured_at: '2026-11-01T21:27:18+08:00'
---

-----------

## interface/ethernet/switch/reserved-fdb 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="mac-address" typ="macAddr" mandatory="1"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (forward | redirect-to-cpu | copy-to-cpu | drop) { forward:0, redirect-to-cpu:1, copy-to-cpu:2, drop:3 }"></ArgTableRow>
<ArgTableRow arg="bypass-ingress-vlan-filter" typ="bool"></ArgTableRow>
<ArgTableRow arg="bypass-ingress-port-policing" typ="bool"></ArgTableRow>
<ArgTableRow arg="qos-group" typ="enum (none) { none:0xffffffff }"></ArgTableRow>
</ArgTable>
