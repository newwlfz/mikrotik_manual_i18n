---
sidebar_key: "cli-reference/interface/list/index"
sidebar_position: 1
title: "list"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/list
captured_at: '2026-11-01T21:27:23+08:00'
---

-----------

## interface/list 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="builtin">builtin</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="include" typ="multi { include-list: enum
 }"></ArgTableRow>
<ArgTableRow arg="exclude" typ="multi { exclude-list: enum
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="dynamic" typ="bool"></ArgTableRow>
</ArgTable>
