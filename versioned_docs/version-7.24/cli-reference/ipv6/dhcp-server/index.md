---
sidebar_key: "cli-reference/ipv6/dhcp-server/index"
sidebar_position: 2
title: "dhcp-server"
description: 'RouterOS directory reference for /ipv6/dhcp-server.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ipv6/dhcp-server
captured_at: '2026-11-01T21:29:05+08:00'
---

-----------

## ipv6/dhcp-server 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="prefix-pool" typ="alt { prefix-pool-static: enum (static-only) { static-only:0xffffffff }
, prefix-pool-name: enum
 }">Pool from which dynamic prefix bindings will acquire prefixes</ArgTableRow>
<ArgTableRow arg="address-pool" typ="alt { address-pool-static: enum (static-only) { static-only:0xffffffff }
, address-pool-name: enum
 }">Pool from which dynamic address bindings will acquire addresses (pool prefix length must be 128)</ArgTableRow>
<ArgTableRow arg="lease-time" typ="time">Duration of the newly created and extended bindings</ArgTableRow>
<ArgTableRow arg="rapid-commit" typ="bool">Append Rapid Commit option to use two packet Solicit-Reply exchange</ArgTableRow>
<ArgTableRow arg="use-radius" typ="enum (no | yes | accounting)">Use RADIUS server for authentication</ArgTableRow>
<ArgTableRow arg="preference" typ="num">Advertise message preference, the highest server preference value is preferred over all others</ArgTableRow>
<ArgTableRow arg="binding-script" typ="alt { script: string
 }"></ArgTableRow>
<ArgTableRow arg="dhcp-option" typ="multi { array-id, option: alt { option: enum
, option-set: enum
 }
 }"></ArgTableRow>
<ArgTableRow arg="insert-queue-before" typ="enum (first | bottom) { first:0, bottom:0xffffffff }"></ArgTableRow>
<ArgTableRow arg="parent-queue" typ="enum (none) { none:0 }"></ArgTableRow>
<ArgTableRow arg="route-distance" typ="num">distance for issued client bindings in routing table</ArgTableRow>
<ArgTableRow arg="allow-dual-stack-queue" typ="bool"></ArgTableRow>
<ArgTableRow arg="use-reconfigure" typ="bool"></ArgTableRow>
<ArgTableRow arg="address-lists" typ="multi { array-id, address-list: string
 }">Address lists to which the binding prefix/address will be added (can be overridden by binding address-lists parameter)</ArgTableRow>
<ArgTableRow arg="ignore-ia-na-bindings" typ="bool">Server will ignore IA_NA options in the messages sent by the client and will act as if the message didn't contain them</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="duid" typ="string"></ArgTableRow>
</ArgTable>
