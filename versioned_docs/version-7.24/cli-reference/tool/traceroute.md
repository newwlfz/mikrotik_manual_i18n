---
sidebar_key: "cli-reference/tool/traceroute"
sidebar_position: 24
title: "traceroute"
sidebar_label: 'traceroute'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/traceroute
captured_at: '2026-11-01T21:30:24+08:00'
---

-----------

## tool/traceroute 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="address (flags=46viD)"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="size" typ="num"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="do-not-fragment" typ="switch"></ArgTableRow>
<ArgTableRow arg="use-dns" typ="bool"></ArgTableRow>
<ArgTableRow arg="count" typ="num"></ArgTableRow>
<ArgTableRow arg="max-hops" typ="num"></ArgTableRow>
<ArgTableRow arg="protocol" typ="enum (icmp | udp)"></ArgTableRow>
<ArgTableRow arg="src-address" typ="alt { ipv6-address: ip6Addr
, ip-address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="timeout" typ="time"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="object { address: alt { name: string
, address: ip6Addr
 }
 }"></ArgTableRow>
<ArgTableRow arg="loss" typ="num"></ArgTableRow>
<ArgTableRow arg="sent" typ="num"></ArgTableRow>
<ArgTableRow arg="last" typ="num"></ArgTableRow>
<ArgTableRow arg="avg" typ="num"></ArgTableRow>
<ArgTableRow arg="best" typ="num"></ArgTableRow>
<ArgTableRow arg="worst" typ="num"></ArgTableRow>
<ArgTableRow arg="std-dev" typ="num"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
<ArgTableRow arg="error" typ="string"></ArgTableRow>
</ArgTable>
