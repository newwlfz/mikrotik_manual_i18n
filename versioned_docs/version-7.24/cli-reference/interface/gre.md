---
sidebar_key: "cli-reference/interface/gre"
sidebar_position: 10
title: "gre"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/gre
captured_at: '2026-11-01T21:27:22+08:00'
---

-----------

## interface/gre 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="R" typ="running">running</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="local-address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="remote-address" typ="address (flags=4Dv)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="keepalive" typ="super { keepalive-interval: time [1 .. ]
, [keepalive-retries] [ ,num [1 .. ]]
 }"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="clamp-tcp-mss" typ="bool"></ArgTableRow>
<ArgTableRow arg="dont-fragment" typ="bool"></ArgTableRow>
<ArgTableRow arg="ipsec-secret" typ="string" syscap="security"></ArgTableRow>
<ArgTableRow arg="allow-fast-path" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="actual-mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="current-remote-address" typ="ipAddr"></ArgTableRow>
</ArgTable>
