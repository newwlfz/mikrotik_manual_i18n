---
sidebar_key: "cli-reference/tool/bandwidth-server/session"
sidebar_position: 1
title: "session"
sidebar_label: 'session'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/bandwidth-server/session
captured_at: '2026-11-01T21:30:13+08:00'
---

-----------

## tool/bandwidth-server/session 
**Type:** Directory

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="client" typ="alt { ip: ipAddr
, ipv6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="protocol" typ="enum (udp | tcp) { udp:0, tcp:1 }"></ArgTableRow>
<ArgTableRow arg="direction" typ="enum (receive | send | both) { receive:0x00000100, send:0x00000200, both:0x00000300 }"></ArgTableRow>
<ArgTableRow arg="user" typ="string"></ArgTableRow>
<ArgTableRow arg="random-data" typ="bool"></ArgTableRow>
<ArgTableRow arg="tx-current" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-10-second-average" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-total-average" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-current" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-10-second-average" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-total-average" typ="num"></ArgTableRow>
<ArgTableRow arg="lost-packets" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-size" typ="range"></ArgTableRow>
<ArgTableRow arg="rx-size" typ="range"></ArgTableRow>
<ArgTableRow arg="tcp-connection-count" typ="num"></ArgTableRow>
<ArgTableRow arg="local-tx-speed" typ="num"></ArgTableRow>
<ArgTableRow arg="remote-tx-speed" typ="num"></ArgTableRow>
</ArgTable>
