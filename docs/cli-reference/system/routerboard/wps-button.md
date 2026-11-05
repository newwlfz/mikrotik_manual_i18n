---
sidebar_key: "cli-reference/system/routerboard/wps-button"
sidebar_position: 7
title: "wps-button"
sidebar_label: 'wps-button'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/routerboard/wps-button
captured_at: '2026-11-01T21:25:45+08:00'
---

-----------

## system/routerboard/wps-button 
**Conditions:** !i386
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool">Enables or disables the button.</ArgTableRow>
<ArgTableRow arg="hold-time" typ="composite { min: time [0 .. 60]
, max: time [0 .. 60]
 }">Triggers the button action only when the button is held for a duration within the specified range.</ArgTableRow>
<ArgTableRow arg="on-event" typ="alt { script: string
 }">The name of the script to run when the button is pressed. You must create and name the script in the [Script](/docs/developer-guides/scripting) menu. WPS buttons is executed with `read,write,reboot,ftp,romon,test` permissions.</ArgTableRow>
</ArgTable>
