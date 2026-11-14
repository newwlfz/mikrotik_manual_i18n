---
sidebar_key: "cli-reference/disk/btrfs/filesystem/replace-device"
sidebar_position: 6
title: "replace-device"
sidebar_label: 'replace-device'
source: https://manual.mikrotik.com/docs/cli-reference/disk/btrfs/filesystem/replace-device
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## disk/btrfs/filesystem/replace-device 
**Conditions:** !smips
**Syscap:** storage
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="device-to-remove" typ="enum">Disk slot of the device to replace in the Btrfs file system.</ArgTableRow>
<ArgTableRow arg="device-to-remove-id" typ="num">Numeric device ID of the device to replace; use this instead of `device-to-remove` when the device is missing from the system (the `I - MISSING-DEVS` flag), as the slot is then no longer available.</ArgTableRow>
<ArgTableRow arg="device-to-add" typ="enum">Disk slot of the new device that takes over the data of the removed device.</ArgTableRow>
</ArgTable>
