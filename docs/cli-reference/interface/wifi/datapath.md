---
sidebar_key: "cli-reference/interface/wifi/datapath"
sidebar_position: 7
title: "datapath"
sidebar_label: 'datapath'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wifi/datapath
captured_at: '2026-11-01T21:27:47+08:00'
---

-----------

## interface/wifi/datapath 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="bridge" typ="iface_enum { none }" unset="1"></ArgTableRow>
<ArgTableRow arg="bridge-cost" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="bridge-horizon" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="openflow-switch" typ="enum" unset="1" syscap="openflow"></ArgTableRow>
<ArgTableRow arg="client-isolation" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="traffic-processing" typ="enum (on-cap | on-capsman | on-capsman-secure)" unset="1"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="interface-list" typ="enum" unset="1"></ArgTableRow>
</ArgTable>
