---
sidebar_key: "cli-reference/iot/lora/joineui"
sidebar_position: 2
title: "joineui"
sidebar_label: 'joineui'
source: https://manual.mikrotik.com/docs/cli-reference/iot/lora/joineui
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## iot/lora/joineui 
**Package:** iot
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="logging" typ="bool"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (whitelist | blacklist) { whitelist:1, blacklist:2 }"></ArgTableRow>
<ArgTableRow arg="joineuis" typ="object { range: composite { min: string
, max: string
 }
 }"></ArgTableRow>
</ArgTable>
