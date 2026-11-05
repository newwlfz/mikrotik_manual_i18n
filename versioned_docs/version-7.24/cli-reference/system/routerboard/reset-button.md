---
sidebar_key: "cli-reference/system/routerboard/reset-button"
sidebar_position: 3
title: "reset-button"
sidebar_label: 'reset-button'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/routerboard/reset-button
captured_at: '2026-11-01T21:30:04+08:00'
---

-----------

## system/routerboard/reset-button 
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
