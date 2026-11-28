---
title: "mode-button"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/routerboard/mode-button
captured_at: '2026-11-28T10:19:39.818Z'
pagination_prev: "cli-reference/system/routerboard"
---

-----------

## system/routerboard/mode-button 
**Conditions:** !i386
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="hold-time" typ="composite { min: time [0 .. 60]
, max: time [0 .. 60]
 }"></ArgTableRow>
<ArgTableRow arg="on-event" typ="alt { script: string
 }"></ArgTableRow>
</ArgTable>
