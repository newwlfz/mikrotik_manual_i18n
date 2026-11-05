---
sidebar_key: "storage/ramdisk"
sidebar_position: 8
title: "Ramdisk"
description: 'RAMdisk enables using RAM as a block device for storage, supporting RAID configurations and requiring the Storage package. It is cleared on reboot or power loss, with a configurable size via ramdisk-size property.'
source: https://manual.mikrotik.com/docs/7.24/storage/ramdisk
captured_at: '2026-11-04T11:33:10+08:00'
---

:::info
This feature requires the [Storage](/docs/7.24/storage/) package.
:::

RAMdisk allows using part of RAM as an attached device (block device). Compared to tmpfs, this allows using RAM as part of a RAID, or in any other configuration where a device — rather than a folder — is required.

:::warning

A RAMdisk is cleared on reboot or power loss.

:::

## Properties

| Property | Description |
| :-- | :-- |
| **ramdisk-size** | Size of the block device you want to create |

## Configuration example

```ros
/disk/add type=ramdisk ramdisk-size=500M
```

Format the ramdisk before using it:

```routeros
/disk/format ramdisk1
```
