---
title: "connection"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/sniffer/connection
captured_at: '2026-11-28T10:19:39.818Z'
pagination_prev: "cli-reference/tool/sniffer"
---

-----------

## tool/sniffer/connection 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="A" typ="active">active</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="src-address" typ="composite { address: ipAddr
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="composite { address: ipAddr
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="bytes" typ="composite { in: num
, out: num
 }"></ArgTableRow>
<ArgTableRow arg="resends" typ="composite { in: num
, out: num
 }"></ArgTableRow>
<ArgTableRow arg="mss" typ="composite { in: num
, out: num
 }"></ArgTableRow>
</ArgTable>
