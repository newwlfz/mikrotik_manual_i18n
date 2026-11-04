---
sidebar_key: "cli-reference/interface/pppoe-server/server"
sidebar_position: 3
title: "server"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/pppoe-server/server
captured_at: '2026-11-01T21:27:34+08:00'
---

-----------

## interface/pppoe-server/server 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="service-name" typ="string"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum { <l2tp>:0xfffffffe }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="max-mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="max-mru" typ="num"></ArgTableRow>
<ArgTableRow arg="mrru" typ="num"></ArgTableRow>
<ArgTableRow arg="authentication" typ="ubit (pap, chap, mschap1, mschap2)"></ArgTableRow>
<ArgTableRow arg="keepalive-timeout" typ="enum (disabled) { disabled:0 }"></ArgTableRow>
<ArgTableRow arg="one-session-per-host" typ="bool"></ArgTableRow>
<ArgTableRow arg="max-sessions" typ="num"></ArgTableRow>
<ArgTableRow arg="pado-delay" typ="num"></ArgTableRow>
<ArgTableRow arg="default-profile" typ="enum"></ArgTableRow>
<ArgTableRow arg="accept-empty-service" typ="bool">Accept PADI with empty service name if no matching pppoe service is available</ArgTableRow>
<ArgTableRow arg="pppoe-over-vlan-range" typ="multi { vlan-range: range [1 .. 4094]
 }"></ArgTableRow>
<ArgTableRow arg="accept-untagged" typ="bool"></ArgTableRow>
</ArgTable>
