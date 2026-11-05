---
sidebar_key: "cli-reference/routing/filter/community-ext-list"
sidebar_position: 2
title: "community-ext-list"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/routing/filter/community-ext-list
captured_at: '2026-11-01T21:29:30+08:00'
---

-----------

## routing/filter/community-ext-list 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="list" typ="enum" mandatory="1">Reference name.</ArgTableRow>
<ArgTableRow arg="communities" typ="object">
List of extended communities expressed as a **raw** integer value or in the typed format: `type:value`, where type can be:
- `rt` - route-target
- `soo` -  site of origin.

The value depends on the type.
</ArgTableRow>
<ArgTableRow arg="regexp" typ="string">Regexp matcher to match communities. The community set with only the regexp parameter cannot be used to append/delete communities.</ArgTableRow>
</ArgTable>
