---
sidebar_key: "cli-reference/interface/l2tp-client/index"
sidebar_position: 1
title: "l2tp-client"
sidebar_label: 'l2tp-client'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/l2tp-client
captured_at: '2026-11-01T21:27:21+08:00'
---

-----------

## interface/l2tp-client 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="R" typ="running">running</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="max-mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="max-mru" typ="num"></ArgTableRow>
<ArgTableRow arg="mrru" typ="num"></ArgTableRow>
<ArgTableRow arg="connect-to" typ="address (flags=D46v)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="user" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
<ArgTableRow arg="profile" typ="enum"></ArgTableRow>
<ArgTableRow arg="keepalive-timeout" typ="enum (disabled) { disabled:0 }"></ArgTableRow>
<ArgTableRow arg="src-address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="use-peer-dns" typ="enum (no | yes | exclusively) { no:0, yes:1, exclusively:2 }"></ArgTableRow>
<ArgTableRow arg="use-ipsec" typ="bool"></ArgTableRow>
<ArgTableRow arg="ipsec-secret" typ="string"></ArgTableRow>
<ArgTableRow arg="allow-fast-path" typ="bool"></ArgTableRow>
<ArgTableRow arg="add-default-route" typ="bool"></ArgTableRow>
<ArgTableRow arg="default-route-distance" typ="num"></ArgTableRow>
<ArgTableRow arg="dial-on-demand" typ="bool"></ArgTableRow>
<ArgTableRow arg="allow" typ="ubit (pap, chap, mschap1, mschap2)"></ArgTableRow>
<ArgTableRow arg="random-source-port" typ="bool"></ArgTableRow>
<ArgTableRow arg="l2tp-proto-version" typ="enum (l2tpv2 | l2tpv3-ip | l2tpv3-udp) { l2tpv2:0, l2tpv3-ip:1, l2tpv3-udp:2 }"></ArgTableRow>
<ArgTableRow arg="l2tpv3-circuit-id" typ="string"></ArgTableRow>
<ArgTableRow arg="l2tpv3-cookie-length" typ="enum (0 | 4-bytes | 8-bytes) { 0:0, 4-bytes:4, 8-bytes:8 }"></ArgTableRow>
<ArgTableRow arg="l2tpv3-digest-hash" typ="enum (none | md5 | sha1) { none:99, md5:0, sha1:1 }"></ArgTableRow>
</ArgTable>
