---
sidebar_key: "cli-reference/system/clock/index"
sidebar_position: 1
title: "clock"
description: 'RouterOS settings reference for /system/clock.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/clock
captured_at: '2026-11-01T21:29:46+08:00'
---

-----------

## system/clock 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="time" typ="date"></ArgTableRow>
<ArgTableRow arg="date" typ="date"></ArgTableRow>
<ArgTableRow arg="time-zone-autodetect" typ="bool"></ArgTableRow>
<ArgTableRow arg="time-zone-name" typ="enum"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="gmt-offset" typ="timezone"></ArgTableRow>
<ArgTableRow arg="dst-active" typ="bool"></ArgTableRow>
</ArgTable>
