---
title: "range"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/routing/ospf/area/range
captured_at: '2026-11-28T10:17:19.424Z'
pagination_prev: "cli-reference/routing/ospf/area"
---

-----------

## routing/ospf/area/range 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="inactive">inactive</ArgTableRow>
<ArgTableRow arg="A" typ="advertise">advertise</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="area" typ="enum" mandatory="1">The OSPF area associated with this range.</ArgTableRow>
<ArgTableRow arg="prefix" typ="address (flags=46/)" mandatory="1">The network prefix of this range.</ArgTableRow>
<ArgTableRow arg="advertise" typ="bool">Whether to create a summary LSA and advertise it to the adjacent areas.</ArgTableRow>
<ArgTableRow arg="cost" typ="num" unset="1">The cost of the summary LSA this range will create. Default - use the largest cost of all routes used (i.e. routes that fall within this range).</ArgTableRow>
</ArgTable>
