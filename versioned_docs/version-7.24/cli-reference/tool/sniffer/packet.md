---
sidebar_key: "cli-reference/tool/sniffer/packet"
sidebar_position: 4
title: "packet"
description: 'RouterOS directory reference for /tool/sniffer/packet.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/sniffer/packet
captured_at: '2026-11-01T21:30:22+08:00'
---

-----------

## tool/sniffer/packet 
**Type:** Directory

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="time" typ="num"></ArgTableRow>
<ArgTableRow arg="num" typ="num"></ArgTableRow>
<ArgTableRow arg="direction" typ="enum (rx | tx) { rx:0, tx:1 }"></ArgTableRow>
<ArgTableRow arg="src-mac" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="dst-mac" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="vlan" typ="object { vlan: composite { id: num
, prio: [ num]
 }
 }"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="src-address" typ="composite { address: alt { ip: ipAddr
, ipv6: ip6Addr
 }
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="composite { address: alt { ip: ipAddr
, ipv6: ip6Addr
 }
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="protocol" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="ip-protocol" typ="enum (ip) { ip:0 }"></ArgTableRow>
<ArgTableRow arg="size" typ="num"></ArgTableRow>
<ArgTableRow arg="cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="ip-packet-size" typ="num"></ArgTableRow>
<ArgTableRow arg="ip-header-size" typ="num"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="ecn" typ="num"></ArgTableRow>
<ArgTableRow arg="identification" typ="num"></ArgTableRow>
<ArgTableRow arg="fragment-offset" typ="num"></ArgTableRow>
<ArgTableRow arg="ttl" typ="num"></ArgTableRow>
<ArgTableRow arg="tcp-flags" typ="multi { array-id, flag: enum (fin | syn | rst | psh | ack | urg | ece | cwr) { fin:0, syn:1, rst:2, psh:3, ack:4, urg:5, ece:6, cwr:7 }
 }"></ArgTableRow>
<ArgTableRow arg="data" typ="string"></ArgTableRow>
</ArgTable>
