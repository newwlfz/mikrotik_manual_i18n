---
sidebar_key: "cli-reference/system/routerboard/mode-button"
sidebar_position: 1
title: "mode-button"
sidebar_label: 'mode-button'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/routerboard/mode-button
captured_at: '2026-11-01T21:25:41+08:00'
---

-----------

## system/routerboard/mode-button 
**Conditions:** !i386
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool">Enables or disables the button.</ArgTableRow>
<ArgTableRow arg="hold-time" typ="composite { min: time [0 .. 60]
, max: time [0 .. 60]
 }">Triggers the button action only when the button is held for a duration within the specified range.</ArgTableRow>
<ArgTableRow arg="on-event" typ="alt { script: string
 }">The name of the script to run when the button is pressed. You must create and name the script in the [Script](/docs/7.25/developer-guides/scripting/) menu.</ArgTableRow>
</ArgTable>
