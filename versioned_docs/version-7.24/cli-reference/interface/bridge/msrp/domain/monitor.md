---
sidebar_key: "cli-reference/interface/bridge/msrp/domain/monitor"
sidebar_position: 2
title: "monitor"
description: 'RouterOS command reference for /interface/bridge/msrp/domain/monitor.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/bridge/msrp/domain/monitor
captured_at: '2026-11-02T09:09:04+08:00'
---

-----------

## interface/bridge/msrp/domain/monitor 
**Conditions:** MSRP_ENABLE
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="bridge" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="id" typ="num"></ArgTableRow>
<ArgTableRow arg="priority" typ="num"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="core-ports" typ="multi { array-id, interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="boundary-ports" typ="multi { array-id, interface: iface_enum
 }"></ArgTableRow>
</ArgTable>
