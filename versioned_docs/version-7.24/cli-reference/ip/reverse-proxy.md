---
sidebar_key: "cli-reference/ip/reverse-proxy"
sidebar_position: 18
title: "reverse-proxy"
sidebar_label: 'reverse-proxy'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/reverse-proxy
captured_at: '2026-11-01T21:28:55+08:00'
---

-----------

## ip/reverse-proxy 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="sni" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="ip-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="port" typ="num" mandatory="1"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
</ArgTable>
