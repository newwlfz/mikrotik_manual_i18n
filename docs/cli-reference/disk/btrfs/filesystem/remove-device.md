---
sidebar_key: "cli-reference/disk/btrfs/filesystem/remove-device"
sidebar_position: 5
title: "remove-device"
sidebar_label: 'remove-device'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/disk/btrfs/filesystem/remove-device
captured_at: '2026-11-01T21:22:08+08:00'
---

-----------

## disk/btrfs/filesystem/remove-device 
**Conditions:** !smips
**Syscap:** storage
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="device" typ="enum">Disk slot of the device to remove from the file system, for example `nvme9`. The data on the device is first migrated to the remaining devices; removal fails if the current profiles cannot be kept with fewer devices (for example `data,raid1` cannot be kept when the device count drops below two).</ArgTableRow>
<ArgTableRow arg="device-id" typ="num">Numeric device ID of the device to remove (see `dev-ids` in [`filesystem`](/docs/cli-reference/disk/btrfs/filesystem)); needed when the device is missing and has no slot anymore.</ArgTableRow>
</ArgTable>
