---
sidebar_key: "cli-reference/tool/torch"
sidebar_position: 23
title: "torch"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/torch
captured_at: '2026-11-01T21:30:24+08:00'
---

-----------

## tool/torch 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="src-address" typ="super { !
, src-address: ipPrefix
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="super { !
, dst-address: ipPrefix
 }"></ArgTableRow>
<ArgTableRow arg="src-address6" typ="super { !
, src-address6: ip6Prefix
 }"></ArgTableRow>
<ArgTableRow arg="dst-address6" typ="super { !
, dst-address6: ip6Prefix
 }"></ArgTableRow>
<ArgTableRow arg="mac-protocol" typ="enum (any) { any:3 }"></ArgTableRow>
<ArgTableRow arg="ip-protocol" typ="enum (any) { any:256 }"></ArgTableRow>
<ArgTableRow arg="port" typ="enum (any) { any:0 }"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="alt { number: num [ .. 4095]
, enum: enum (any) { any:0xffff }
 }"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="cpu" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="mac-protocol" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="ip-protocol" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="src-address" typ="alt { ip: ipAddr
, ipv6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="src-port" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="alt { ip: ipAddr
, ipv6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="tx" typ="num"></ArgTableRow>
<ArgTableRow arg="rx" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-packets" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-packets" typ="num"></ArgTableRow>
</ArgTable>
