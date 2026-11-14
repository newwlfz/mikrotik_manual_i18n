---
sidebar_key: "cli-reference/routing/ospf/lsa"
sidebar_position: 5
title: "lsa"
sidebar_label: 'lsa'
source: https://manual.mikrotik.com/docs/cli-reference/routing/ospf/lsa
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## routing/ospf/lsa 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="S" typ="self-originated">Whether the LSA originated from the router itself.</ArgTableRow>
<ArgTableRow arg="F" typ="flushing">flushing</ArgTableRow>
<ArgTableRow arg="W" typ="wraparound">wraparound</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="instance" typ="enum"></ArgTableRow>
<ArgTableRow arg="area" typ="enum">The area this LSA belongs to.</ArgTableRow>
<ArgTableRow arg="link" typ="address (flags=4i)"></ArgTableRow>
<ArgTableRow arg="link-instance-id" typ="num"></ArgTableRow>
<ArgTableRow arg="type" typ="string"></ArgTableRow>
<ArgTableRow arg="originator" typ="ipAddr">An originator of the LSA record.</ArgTableRow>
<ArgTableRow arg="id" typ="ipAddr">LSA record ID</ArgTableRow>
<ArgTableRow arg="sequence" typ="num">A number of times the LSA for a link has been updated.</ArgTableRow>
<ArgTableRow arg="age" typ="num">How long ago (in seconds) the last update occurred.</ArgTableRow>
<ArgTableRow arg="checksum" typ="num"></ArgTableRow>
<ArgTableRow arg="body" typ="string"></ArgTableRow>
</ArgTable>
