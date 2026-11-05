---
sidebar_key: "cli-reference/tool/sniffer/connection"
sidebar_position: 1
title: "connection"
source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer/connection
captured_at: '2026-11-01T21:30:20+08:00'
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
