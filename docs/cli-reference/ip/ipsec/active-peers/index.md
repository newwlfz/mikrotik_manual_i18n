---
sidebar_key: "cli-reference/ip/ipsec/active-peers/index"
sidebar_position: 1
title: "active-peers"
source: https://manual.mikrotik.com/docs/cli-reference/ip/ipsec/active-peers
captured_at: '2026-11-01T21:28:43+08:00'
---

-----------

## ip/ipsec/active-peers 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="R" typ="responder">responder</ArgTableRow>
<ArgTableRow arg="N" typ="natt-peer">natt-peer</ArgTableRow>
<ArgTableRow arg="P" typ="ppk">ppk</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="id" typ="string"></ArgTableRow>
<ArgTableRow arg="local-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="remote-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="state" typ="enum (spawning | starting | message-1-received | message-1-sent | message-2-received | message-2-sent | message-3-received | message-3-sent | message-4-received | established | expired | no-phase1 | eap | crypto | qkd) { spawning:0, starting:1, message-1-received:2, message-1-sent:3, message-2-received:4, message-2-sent:5, message-3-received:6, message-3-sent:7, message-4-received:8, established:9, expired:10, no-phase1:11 }"></ArgTableRow>
<ArgTableRow arg="side" typ="enum (initiator | responder)"></ArgTableRow>
<ArgTableRow arg="dynamic-address" typ="alt { ip: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="uptime" typ="time"></ArgTableRow>
<ArgTableRow arg="last-seen" typ="time"></ArgTableRow>
<ArgTableRow arg="ph2-total" typ="num"></ArgTableRow>
<ArgTableRow arg="spii" typ="string"></ArgTableRow>
<ArgTableRow arg="spir" typ="string"></ArgTableRow>
<ArgTableRow arg="rx-packets" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-packets" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-bytes" typ="num"></ArgTableRow>
</ArgTable>
