---
sidebar_key: "cli-reference/interface/wireless/info/scan-list"
sidebar_position: 7
title: "scan-list"
sidebar_label: 'scan-list'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wireless/info/scan-list
captured_at: '2026-11-01T21:28:01+08:00'
---

-----------

## interface/wireless/info/scan-list 
**Package:** wireless-rep
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="frequency-mode" typ="enum"></ArgTableRow>
<ArgTableRow arg="country" typ="enum"></ArgTableRow>
<ArgTableRow arg="band" typ="enum (2ghz-b | 2ghz-onlyg | 2ghz-b/g | 5ghz-a | 5ghz-onlyn | 5ghz-a/n | 2ghz-onlyn | 2ghz-b/g/n | 2ghz-g/n | 5ghz-a/n/ac | 5ghz-n/ac | 5ghz-onlyac)"></ArgTableRow>
<ArgTableRow arg="channel-width" typ="enum (20mhz | 40mhz-turbo | 10mhz | 5mhz | 20/40mhz-Ce | 20/40mhz-eC | 20/40/80mhz-Ceee | 20/40/80mhz-eCee | 20/40/80mhz-eeCe | 20/40/80mhz-eeeC)"></ArgTableRow>
<ArgTableRow arg="antenna-gain" typ="num"></ArgTableRow>
<ArgTableRow arg="dfs-mode" typ="enum (none | no-radar-detect | radar-detect) { none:0, no-radar-detect:1, radar-detect:2 }"></ArgTableRow>
<ArgTableRow arg="installation" typ="enum (any | indoor | outdoor)"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="channels" typ="multi { array-id, channel: string
 }"></ArgTableRow>
</ArgTable>
