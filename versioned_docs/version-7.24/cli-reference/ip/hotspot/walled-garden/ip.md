---
sidebar_key: "cli-reference/ip/hotspot/walled-garden/ip"
sidebar_position: 1
title: "ip"
sidebar_label: 'ip'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/hotspot/walled-garden/ip
captured_at: '2026-11-01T21:28:41+08:00'
---

-----------

## ip/hotspot/walled-garden/ip 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="server" typ="super { !
, server: enum
 }"></ArgTableRow>
<ArgTableRow arg="src-address" typ="super { !
, range: ipRange
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="super { !
, range: ipRange
 }"></ArgTableRow>
<ArgTableRow arg="dst-host" typ="string"></ArgTableRow>
<ArgTableRow arg="protocol" typ="super { !
, protocol: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="super { !
, min: num [0 .. 65535]
, [max] -num [0 .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="src-address-list" typ="super { !
, address-list: enum
 }"></ArgTableRow>
<ArgTableRow arg="dst-address-list" typ="super { !
, address-list: enum
 }"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (accept | drop | reject) { accept:0, drop:10, reject:11 }"></ArgTableRow>
</ArgTable>
