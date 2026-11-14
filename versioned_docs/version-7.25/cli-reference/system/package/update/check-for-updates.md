---
sidebar_key: "cli-reference/system/package/update/check-for-updates"
sidebar_position: 2
title: "check-for-updates"
sidebar_label: 'check-for-updates'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/package/update/check-for-updates
captured_at: '2026-11-01T21:25:38+08:00'
---

-----------

## system/package/update/check-for-updates 
**Type:** Command

Check the MikroTik download server for a newer RouterOS version in the selected release channel.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="fetch-changelog" typ="switch">Whether to fetch the changelog along with the update check.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="changelog" typ="string">Changelog text for the latest available version.</ArgTableRow>
</ArgTable>
