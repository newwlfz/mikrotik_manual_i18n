---
sidebar_key: "cli-reference/routing/table"
sidebar_position: 19
title: "table"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/routing/table
captured_at: '2026-11-01T21:29:43+08:00'
---

-----------

## routing/table 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="U" typ="used">used</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Name of the routing table.</ArgTableRow>
<ArgTableRow arg="fib" typ="switch" unset="1">Flag indicating whether routes in this table will be installed in the [FIB](/docs/7.24/user-guides/routing-and-networking-protocols/routing-decision#forwarding-information-base).</ArgTableRow>
</ArgTable>
