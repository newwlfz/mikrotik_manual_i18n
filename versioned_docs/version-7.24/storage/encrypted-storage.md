---
sidebar_key: "storage/encrypted-storage"
sidebar_position: 3
title: "Encrypted storage (dm-crypt)"
description: 'Encrypted storage (dm-crypt) enables transparent disk encryption using dmcrypt for block devices, with properties like slot name, encryption key, and backend drive. Examples show creating encrypted file systems on...'
source: https://manual.mikrotik.com/docs/7.24/storage/encrypted-storage
captured_at: '2026-11-04T11:33:05+08:00'
---

:::info
This feature requires the [Storage](/docs/7.24/storage/) package.
:::

Drive or device used together with `type=crypted` to make `dm_crypt` encrypted storage. `dm-crypt` is a transparent disk encryption subsystem designed to provide encryption of block devices.

## Properties

| Property | Description |
| :-- | :-- |
| **slot** *(string;* Default: ) | Name of the  file system |
| **encryption-key** *(string;* Default: ) | key used to decrypt |
| **crypted-backend** *(string;* Default: ) | Drive or partition to encrypt |

## Examples

### Simple crypted file system

To create an encrypted file-system:

```ros
/disk
add crypted-backend=usb1 encryption-key=<secret_key> slot=crypted-usb1 type=crypted
```

After it's created, format the file system and it's ready to go.

```ros
/disk/format crypted-usb1 file-system=ext4 
```

### Crypted RAID1 array with integrity check

Create a RAID1 array and create a encrypted-file system on top of it:

```routeros
/disk
add raid-device-count=2 raid-type=1 slot=raid1 type=raid
set nvme3 raid-master=raid1 raid-role=0
set nvme4 raid-master=raid1 raid-role=1
add crypted-backend=raid1 encryption-key=<secret_key> slot=crypted-raid1 type=crypted  crypt-mode=encryption-and-integrity

```

Format the encrypted file-system to Btrfs:

```routeros
/disk
 format crypted-raid1 file-system=btrfs  
```
