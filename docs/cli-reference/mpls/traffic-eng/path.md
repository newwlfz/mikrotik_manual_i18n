---
sidebar_key: "cli-reference/mpls/traffic-eng/path"
sidebar_position: 4
title: "path"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/mpls/traffic-eng/path
captured_at: '2026-11-01T21:24:50+08:00'
---

-----------

## mpls/traffic-eng/path 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="use-cspf" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="setup-priority" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="holding-priority" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="record-route" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="affinity-include-all" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="affinity-include-any" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="affinity-exclude" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="reoptimize-interval" typ="time" unset="1"></ArgTableRow>
<ArgTableRow arg="hops" typ="multi { array-id, array-id, hop: super { address: address (flags=46)
, [strict] /enum (loose | strict)
 }
 }" unset="1"></ArgTableRow>
</ArgTable>
