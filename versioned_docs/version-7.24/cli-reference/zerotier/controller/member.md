---
title: "member"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/zerotier/controller/member
captured_at: '2026-11-28T10:19:39.818Z'
pagination_prev: "cli-reference/zerotier/controller"
---

-----------

## zerotier/controller/member 
**Package:** zerotier
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="A" typ="authorized"></ArgTableRow>
<ArgTableRow arg="B" typ="bridge"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="disabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="network" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="zt-address" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="authorized" typ="bool"></ArgTableRow>
<ArgTableRow arg="bridge" typ="bool"></ArgTableRow>
<ArgTableRow arg="ip-address" typ="multi { array-id, addr: address (flags=46)
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="lost" typ="bool"></ArgTableRow>
<ArgTableRow arg="last-seen" typ="time"></ArgTableRow>
</ArgTable>
