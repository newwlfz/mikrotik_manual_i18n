---
title: "monitor"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/gps/monitor
captured_at: '2026-11-28T10:17:19.424Z'
pagination_prev: "cli-reference/system/gps"
pagination_next: "cli-reference/system/health"
---

-----------

## system/gps/monitor 
**Package:** gps
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="date-and-time" typ="date"></ArgTableRow>
<ArgTableRow arg="latitude" typ="string"></ArgTableRow>
<ArgTableRow arg="longitude" typ="string"></ArgTableRow>
<ArgTableRow arg="altitude" typ="string"></ArgTableRow>
<ArgTableRow arg="speed" typ="string"></ArgTableRow>
<ArgTableRow arg="destination-bearing" typ="string"></ArgTableRow>
<ArgTableRow arg="true-bearing" typ="string"></ArgTableRow>
<ArgTableRow arg="magnetic-bearing" typ="string"></ArgTableRow>
<ArgTableRow arg="valid" typ="bool"></ArgTableRow>
<ArgTableRow arg="satellites" typ="num"></ArgTableRow>
<ArgTableRow arg="fix-quality" typ="num"></ArgTableRow>
<ArgTableRow arg="horizontal-dilution" typ="num"></ArgTableRow>
<ArgTableRow arg="data-age" typ="alt { never: enum (never) { never:0 }
, time: time
 }"></ArgTableRow>
</ArgTable>
