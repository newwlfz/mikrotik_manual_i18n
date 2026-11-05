---
sidebar_key: "cli-reference/ip/kid-control/device/index"
sidebar_position: 1
title: "device"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/kid-control/device
captured_at: '2026-11-01T21:28:49+08:00'
---

-----------

## ip/kid-control/device 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="B" typ="blocked">blocked</ArgTableRow>
<ArgTableRow arg="L" typ="limited">limited</ArgTableRow>
<ArgTableRow arg="I" typ="inactive">inactive</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="all" typ="switch"></ArgTableRow>
<ArgTableRow arg="static" typ="switch"></ArgTableRow>
<ArgTableRow arg="dynamic" typ="switch"></ArgTableRow>
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr" mandatory="1"></ArgTableRow>
<ArgTableRow arg="user" typ="enum () { :0xffffffff }" mandatory="1"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="ip-address" typ="object { server: alt { ip: ipAddr
, ipv6: ip6Addr
 }
 }"></ArgTableRow>
<ArgTableRow arg="activity" typ="string"></ArgTableRow>
<ArgTableRow arg="rate-down" typ="num"></ArgTableRow>
<ArgTableRow arg="rate-up" typ="num"></ArgTableRow>
<ArgTableRow arg="bytes-down" typ="num"></ArgTableRow>
<ArgTableRow arg="bytes-up" typ="num"></ArgTableRow>
<ArgTableRow arg="idle-time" typ="time"></ArgTableRow>
</ArgTable>
