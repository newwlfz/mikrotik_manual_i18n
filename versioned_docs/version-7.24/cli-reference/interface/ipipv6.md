---
title: "ipipv6"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ipipv6
captured_at: '2026-11-28T10:19:39.818Z'
pagination_next: "cli-reference/interface/l2tp-client"
---

-----------

## interface/ipipv6 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="R" typ="running">running</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="local-address" typ="ip6Addr"></ArgTableRow>
<ArgTableRow arg="remote-address" typ="address (flags=6Dvi)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="keepalive" typ="super { keepalive-interval: time [1 .. ]
, [keepalive-retries] [ ,num [1 .. ]]
 }"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="clamp-tcp-mss" typ="bool"></ArgTableRow>
<ArgTableRow arg="dont-fragment" typ="bool"></ArgTableRow>
<ArgTableRow arg="ipsec-secret" typ="string" syscap="security"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="actual-mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="current-remote-address" typ="ip6Addr"></ArgTableRow>
</ArgTable>
