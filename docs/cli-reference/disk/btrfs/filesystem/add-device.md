---
sidebar_key: "cli-reference/disk/btrfs/filesystem/add-device"
sidebar_position: 1
title: "add-device"
sidebar_label: 'add-device'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/disk/btrfs/filesystem/add-device
captured_at: '2026-11-01T21:22:06+08:00'
---

-----------

## disk/btrfs/filesystem/add-device 
**Conditions:** !smips
**Syscap:** storage
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="device" typ="enum">Disk slot to add to the Btrfs file system, for example `nvme9`. After adding a device, run [`balance-start`](/docs/cli-reference/disk/btrfs/filesystem/balance-start) with the desired profiles (for example `data-profile=raid1`) to actually use it for storage redundancy; otherwise the device is only listed under `devs`.</ArgTableRow>
</ArgTable>
