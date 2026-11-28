---
title: "profile"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/profile
captured_at: '2026-11-28T10:19:39.818Z'
pagination_next: "cli-reference/tool/romon"
---

-----------

## tool/profile 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="cpu" typ="enum (all | total) { all:0xfffffffe, total:0xfffffffd }" syscap="smp"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="cpu" typ="num" syscap="smp"></ArgTableRow>
<ArgTableRow arg="usage" typ="num"></ArgTableRow>
</ArgTable>
