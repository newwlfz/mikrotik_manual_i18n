---
sidebar_key: "cli-reference/tool/romon/index"
sidebar_position: 2
title: "romon"
sidebar_label: 'romon'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/romon
captured_at: '2026-11-01T21:25:56+08:00'
---

-----------

## tool/romon 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool">Disable or enable the RoMON feature.</ArgTableRow>
<ArgTableRow arg="id" typ="macAddr">MAC address to use as the ID of this router.</ArgTableRow>
<ArgTableRow arg="secrets" typ="multi { array-id, name: string
 }">A list of global secrets used for RoMON message hashing.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="current-id" typ="macAddr">The RoMON ID currently in use, automatically selected from the port MAC address when `id` is not set.</ArgTableRow>
</ArgTable>
