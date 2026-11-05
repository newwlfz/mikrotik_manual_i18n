---
sidebar_key: "cli-reference/interface/lte/settings"
sidebar_position: 9
title: "settings"
sidebar_label: 'settings'
source: https://manual.mikrotik.com/docs/cli-reference/interface/lte/settings
captured_at: '2026-11-01T21:27:27+08:00'
---

-----------

## interface/lte/settings 
**Conditions:** !smips
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="mode" typ="enum (auto | serial | mbim | user)"></ArgTableRow>
<ArgTableRow arg="esim-channel" typ="enum (auto | at)"></ArgTableRow>
<ArgTableRow arg="firmware-path" typ="string"></ArgTableRow>
<ArgTableRow arg="log-dir" typ="string" syscap="modemlog"></ArgTableRow>
<ArgTableRow arg="info-polling-interval" typ="num" syscap="tr069-client">info polling interval in seconds</ArgTableRow>
<ArgTableRow arg="link-recovery-timer" typ="num">in seconds</ArgTableRow>
<ArgTableRow arg="sim-slot" typ="enum" syscap="sim-slot"></ArgTableRow>
<ArgTableRow arg="sim-link" typ="enum" syscap="sim-link"></ArgTableRow>
<ArgTableRow arg="external-antenna" typ="enum (auto | main | div | both | none)" syscap="modem-antenna-switch"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="external-antenna-selected" typ="enum (main | div | both | none | none)" syscap="modem-antenna-switch"></ArgTableRow>
</ArgTable>
