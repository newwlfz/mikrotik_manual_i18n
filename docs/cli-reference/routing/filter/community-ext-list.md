---
sidebar_key: "cli-reference/routing/filter/community-ext-list"
sidebar_position: 2
title: "community-ext-list"
sidebar_label: 'community-ext-list'
source: https://manual.mikrotik.com/docs/cli-reference/routing/filter/community-ext-list
captured_at: '2026-11-09T11:35:47.715Z'
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
<ArgTableRow arg="regexp" typ="string">Regexp matcher to match communities. Regexp entries are used for matching and by `delete`/`filter`. Only concrete community values are used by `append`/`set`.</ArgTableRow>
</ArgTable>
