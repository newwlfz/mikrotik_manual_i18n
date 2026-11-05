---
sidebar_key: "cli-reference/routing/filter/community-large-list"
sidebar_position: 3
title: "community-large-list"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/routing/filter/community-large-list
captured_at: '2026-11-01T21:29:29+08:00'
---

-----------

## routing/filter/community-large-list 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="list" typ="enum" mandatory="1">Reference name.</ArgTableRow>
<ArgTableRow arg="communities" typ="object">List of large communities expressed in the following format: `admin:value1:value2`, where each section can be an integer [0..4294967295].</ArgTableRow>
<ArgTableRow arg="regexp" typ="string">Regexp matcher to match communities. The community set with only the regexp parameter cannot be used to append/delete communities.</ArgTableRow>
</ArgTable>
