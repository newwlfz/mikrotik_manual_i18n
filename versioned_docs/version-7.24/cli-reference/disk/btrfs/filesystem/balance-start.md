---
sidebar_key: "cli-reference/disk/btrfs/filesystem/balance-start"
sidebar_position: 3
title: "balance-start"
description: 'RouterOS command reference for /disk/btrfs/filesystem/balance-start.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/disk/btrfs/filesystem/balance-start
captured_at: '2026-11-01T21:26:41+08:00'
---

-----------

## disk/btrfs/filesystem/balance-start 
**Conditions:** !smips
**Syscap:** storage
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="data-profile" typ="enum (single | dup | raid0 | raid1 | raid1c3 | raid1c4 | raid10)"></ArgTableRow>
<ArgTableRow arg="metadata-profile" typ="enum (single | dup | raid0 | raid1 | raid1c3 | raid1c4 | raid10)"></ArgTableRow>
<ArgTableRow arg="system-profile" typ="enum (single | dup | raid0 | raid1 | raid1c3 | raid1c4 | raid10)"></ArgTableRow>
<ArgTableRow arg="data-usage" typ="range"></ArgTableRow>
<ArgTableRow arg="metadata-usage" typ="range"></ArgTableRow>
<ArgTableRow arg="system-usage" typ="range"></ArgTableRow>
</ArgTable>
