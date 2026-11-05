---
sidebar_key: "cli-reference/ip/socks/access"
sidebar_position: 1
title: "access"
description: 'RouterOS directory reference for /ip/socks/access.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/socks/access
captured_at: '2026-11-01T21:28:57+08:00'
---

-----------

## ip/socks/access 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="src-address" typ="super { !
, alt-address: alt { range: ipRange
, src-ipv6: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="src-port" typ="super { !
, min: num [0 .. 65535]
, [max] -num [0 .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="super { !
, alt-address: alt { range: ipRange
, dst-ipv6: ip6Prefix
, dst-domain: string
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="super { !
, min: num [0 .. 65535]
, [max] -num [0 .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (deny | allow) { deny:0, allow:1 }"></ArgTableRow>
</ArgTable>
