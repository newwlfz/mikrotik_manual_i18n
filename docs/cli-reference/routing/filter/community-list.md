---
sidebar_key: "cli-reference/routing/filter/community-list"
sidebar_position: 4
title: "community-list"
sidebar_label: 'community-list'
source: https://manual.mikrotik.com/docs/cli-reference/routing/filter/community-list
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## routing/filter/community-list 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="list" typ="enum" mandatory="1">Reference name.</ArgTableRow>
<ArgTableRow arg="communities" typ="object">
List of communities expressed either as a **well-known** name or in the following format: `as:number`, where each section can be integer [0..65535].
Accepted **well-known** names:
- `accept-own`
- `graceful-shutdown`
- `no-advertise`
- `no-llgr`
- `route-filter-6`
- `accept-own-nh`
- `internet`
- `no-export`
- `no-peer`
- `route-filter-xlate-4`
- `blackhole`
- `llgr-stale`
- `local-as`
- `route-filter-4`
- `route-filter-xlate-6`
</ArgTableRow>
<ArgTableRow arg="regexp" typ="string">Regexp matcher to match communities. Regexp entries are used for matching and by `delete`/`filter`. Only concrete community values are used by `append`/`set`.</ArgTableRow>
</ArgTable>
