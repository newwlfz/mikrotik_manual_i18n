---
sidebar_key: "storage/encrypted-storage"
sidebar_position: 3
title: "Encrypted storage (dm-crypt)"
sidebar_label: 'Encrypted storage (dm-crypt)'
description: 'Encrypted storage (dm-crypt) enables transparent disk encryption for block devices in RouterOS, configured with type=crypted and an encryption key. Examples show creating encrypted file systems on USB drives or on top of RAID1 arrays.'
tags:
  - 'dm-crypt'
  - 'encryption'
  - 'storage'
source: https://manual.mikrotik.com/docs/7.25/storage/encrypted-storage
captured_at: '2026-11-04T11:21:25+08:00'
---

:::info
This feature requires the [Storage](/docs/storage/) package.
:::

RouterOS supports transparent block device encryption with `dm-crypt`. Add a disk item with `type=crypted` and point `crypted-backend` at the drive or partition to encrypt; decryption is done with `encryption-key`.

## Examples

### Simple crypted file system

To create an encrypted file system:

```ros
/disk/add crypted-backend=usb1 encryption-key=<secret_key> slot=crypted-usb1 type=crypted
```

After it's created, format the file system and it's ready to go:

```ros
/disk/format crypted-usb1 file-system=ext4
```

### Crypted RAID1 array with integrity check

Create a RAID1 array and put an encrypted file system on top of it:

```routeros
/disk/add raid-device-count=2 raid-type=1 slot=raid1 type=raid
/disk/set nvme3 raid-master=raid1 raid-role=0
/disk/set nvme4 raid-master=raid1 raid-role=1
/disk/add crypted-backend=raid1 encryption-key=<secret_key> slot=crypted-raid1 type=crypted
```

Format the encrypted device to Btrfs:

```routeros
/disk/format crypted-raid1 file-system=btrfs
```
