---
sidebar_key: "cli-reference/iot/lora/netid"
sidebar_position: 4
title: "netid"
sidebar_label: 'netid'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/iot/lora/netid
captured_at: '2026-11-01T21:28:20+08:00'
---

-----------

## iot/lora/netid 
**Package:** iot
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="logging" typ="bool"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (whitelist | blacklist) { whitelist:1, blacklist:2 }"></ArgTableRow>
<ArgTableRow arg="netids" typ="object { range: composite { min: string
, max: string
 }
 }"></ArgTableRow>
</ArgTable>
