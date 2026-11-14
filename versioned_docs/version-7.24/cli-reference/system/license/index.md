---
sidebar_key: "cli-reference/system/license/index"
sidebar_position: 2
title: "license"
sidebar_label: 'license'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/license
captured_at: '2026-11-01T21:29:53+08:00'
---

-----------

## system/license 
**Type:** Settings Directory

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="software-id" typ="string" syscap="nochr"></ArgTableRow>
<ArgTableRow arg="old-software-id" typ="string" syscap="nochr"></ArgTableRow>
<ArgTableRow arg="nlevel" typ="num" syscap="nochr"></ArgTableRow>
<ArgTableRow arg="features" typ="ubit (AP, synchronous, radiolan, wireless, extra-channels, , , )" syscap="nochr"></ArgTableRow>
<ArgTableRow arg="expires-in" typ="time" syscap="nochr"></ArgTableRow>
<ArgTableRow arg="system-id" typ="string" syscap="chr"></ArgTableRow>
<ArgTableRow arg="level" typ="enum (free | p1 | p10 | p-unlimited) { free:0, p1:1, p10:2, p-unlimited:3 }" syscap="chr"></ArgTableRow>
<ArgTableRow arg="limited-upgrades" typ="bool" syscap="chr"></ArgTableRow>
<ArgTableRow arg="next-renewal-at" typ="date" syscap="chr"></ArgTableRow>
<ArgTableRow arg="deadline-at" typ="date" syscap="chr"></ArgTableRow>
</ArgTable>
