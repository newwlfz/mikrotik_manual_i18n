---
sidebar_key: "cli-reference/interface/l2tp-server/server"
sidebar_position: 3
title: "server"
sidebar_label: 'server'
source: https://manual.mikrotik.com/docs/cli-reference/interface/l2tp-server/server
captured_at: '2026-11-01T21:27:23+08:00'
---

-----------

## interface/l2tp-server/server 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="max-mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="max-mru" typ="num"></ArgTableRow>
<ArgTableRow arg="mrru" typ="num"></ArgTableRow>
<ArgTableRow arg="authentication" typ="ubit (pap, chap, mschap1, mschap2)"></ArgTableRow>
<ArgTableRow arg="keepalive-timeout" typ="enum (disabled) { disabled:0 }"></ArgTableRow>
<ArgTableRow arg="max-sessions" typ="num"></ArgTableRow>
<ArgTableRow arg="default-profile" typ="enum"></ArgTableRow>
<ArgTableRow arg="use-ipsec" typ="enum (no | yes | required) { no:0, yes:1, required:2 }"></ArgTableRow>
<ArgTableRow arg="ipsec-secret" typ="string"></ArgTableRow>
<ArgTableRow arg="caller-id-type" typ="enum (ip-address | number) { ip-address:0, number:1 }"></ArgTableRow>
<ArgTableRow arg="one-session-per-host" typ="bool"></ArgTableRow>
<ArgTableRow arg="allow-fast-path" typ="bool"></ArgTableRow>
<ArgTableRow arg="l2tpv3-circuit-id" typ="string"></ArgTableRow>
<ArgTableRow arg="l2tpv3-cookie-length" typ="enum (0 | 4-bytes | 8-bytes) { 0:0, 4-bytes:4, 8-bytes:8 }"></ArgTableRow>
<ArgTableRow arg="l2tpv3-digest-hash" typ="enum (none | md5 | sha1) { none:99, md5:0, sha1:1 }"></ArgTableRow>
<ArgTableRow arg="l2tpv3-ether-interface-list" typ="enum"></ArgTableRow>
<ArgTableRow arg="accept-pseudowire-type" typ="enum (all | ether | ppp) { all:0, ether:5, ppp:7 }"></ArgTableRow>
<ArgTableRow arg="accept-proto-version" typ="enum (all | l2tpv2 | l2tpv3) { all:0, l2tpv2:2, l2tpv3:3 }"></ArgTableRow>
</ArgTable>
