---
sidebar_key: "storage/btrfs"
title: "Btrfs"
description: 'Btrfs is a stable copy-on-write file system with features like bitrot protection, subvolumes, and snapshots. It is available with the Storage package and supports RAID configurations, subvolume management, and snapshot transfers.'
tags:
  - 'btrfs'
  - 'storage'
  - 'file-system'
source: https://manual.mikrotik.com/docs/storage/btrfs
captured_at: '2026-11-28T10:14:44.799Z'
---

:::info
This feature requires the `rose-storage` package; see [Storage](/docs).
:::

Btrfs is a feature-rich copy-on-write file system. It is the default file system of some popular Linux distributions, such as [Fedora](https://en.wikipedia.org/wiki/Fedora_Linux). The most significant features are:

- Bitrot protection (when used in Btrfs-RAID mode).
- Subvolumes.
- Snapshots.
- Snapshot transfer between devices.

## Quickstart: format a disk as Btrfs

Format a single disk to Btrfs and use it under the default mount point:

```routeros
/disk/print
/disk/format <disk-name> file-system=btrfs
/disk/btrfs/filesystem/print
```

Once formatted, the disk appears with a new Btrfs filesystem entry under `/disk/btrfs/filesystem/print`, labelled `<disk-name>-fs` by default (the label can be changed with `/disk/btrfs/filesystem/set <label> label=MyLabel`). The disk mounts like any other drive and is accessible in `/file`. From here you can label the file system, create [subvolumes and snapshots](/docs/storage/btrfs/snapshots), combine several disks into a [Btrfs RAID](/docs/storage/raid), or set up routine [maintenance](/docs/storage/btrfs/maintenance).

The Btrfs functionality lives under three menus:

- [`/disk/btrfs/filesystem`](../../cli-reference/disk/btrfs/filesystem/) - one entry per formatted Btrfs file system: labels, device membership ([`add-device`](../../cli-reference/disk/btrfs/filesystem/add-device), [`remove-device`](../../cli-reference/disk/btrfs/filesystem/remove-device), [`replace-device`](../../cli-reference/disk/btrfs/filesystem/replace-device)), RAID profiles and maintenance jobs ([`balance-start`](../../cli-reference/disk/btrfs/filesystem/balance-start), [`scrub-start`](../../cli-reference/disk/btrfs/filesystem/scrub-start), [`reset-counters`](../../cli-reference/disk/btrfs/filesystem/reset-counters)).
- [`/disk/btrfs/subvolume`](../../cli-reference/disk/btrfs/subvolume) - subvolumes and snapshots of a file system.
- [`/disk/btrfs/transfer`](../../cli-reference/disk/btrfs/transfer) - send and receive of snapshots to and from other devices.

## See also

- [Btrfs RAID](/docs/storage/raid) - RAID1 and RAID10 setups, disk replacement, and the Braid check scripts.
- [Btrfs subvolumes and snapshots](/docs/storage/btrfs/snapshots) - creating subvolumes, taking snapshots, transferring snapshots between devices.
- [Btrfs maintenance](/docs/storage/btrfs/maintenance) - periodic scrubbing, balancing, automated snapshot rotation, and free-space management.
