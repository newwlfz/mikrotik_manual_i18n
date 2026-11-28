---
title: "discover"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/romon/discover
captured_at: '2026-11-28T10:17:19.424Z'
pagination_prev: "cli-reference/tool/romon"
---

-----------

## tool/romon/discover 
**Type:** Command

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="A" typ="active">active</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="cost" typ="num"></ArgTableRow>
<ArgTableRow arg="hops" typ="num"></ArgTableRow>
<ArgTableRow arg="path" typ="multi { array-id, path-hop: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="l2mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="identity" typ="string"></ArgTableRow>
<ArgTableRow arg="version" typ="string"></ArgTableRow>
<ArgTableRow arg="board" typ="string"></ArgTableRow>
<ArgTableRow arg="uptime" typ="time"></ArgTableRow>
</ArgTable>
