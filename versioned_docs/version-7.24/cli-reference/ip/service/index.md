---
sidebar_key: "cli-reference/ip/service/index"
sidebar_position: 1
title: "service"
sidebar_label: 'service'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/service
captured_at: '2026-11-01T21:28:56+08:00'
---

-----------

## ip/service 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="c" typ="connection">connection</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="address" typ="object { address: alt { address: ipPrefix
, address: ip6Prefix
 }
 }" deprecated="1"></ArgTableRow>
<ArgTableRow arg="available-from" typ="object { address: alt { address: ipPrefix
, address: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none) { none:0 }"></ArgTableRow>
<ArgTableRow arg="tls-version" typ="enum (any | only-1.2) { any:0, only-1.2:2 }"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="max-sessions" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="container" typ="enum () { :0 }"></ArgTableRow>
<ArgTableRow arg="netns" typ="num"></ArgTableRow>
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="proto" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="local" typ="ip6Addr"></ArgTableRow>
<ArgTableRow arg="remote" typ="composite { ip: ip6Addr
, port: num
 }"></ArgTableRow>
</ArgTable>
