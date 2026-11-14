---
sidebar_key: "cli-reference/disk/format"
sidebar_position: 6
title: "format"
sidebar_label: 'format'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/disk/format
captured_at: '2026-11-01T21:26:45+08:00'
---

-----------

## disk/format 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="file-system" typ="enum (fat32 | ext4 | btrfs | xfs | wipe | wipe-quick | exfat | discard | discard-secure)"></ArgTableRow>
<ArgTableRow arg="label" typ="string"></ArgTableRow>
<ArgTableRow arg="mbr-partition-table" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="output" typ="string"></ArgTableRow>
</ArgTable>
