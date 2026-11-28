---
title: "Setting a hot spare disk"
description: 'This page explains how to configure a hot spare disk for a RAID array in RouterOS, enabling automatic rebuild on disk failure by assigning a spare disk to the RAID setup.'
tags:
  - 'raid'
  - 'storage'
  - 'backup'
source: https://manual.mikrotik.com/docs/7.24/storage/raid/hot-spare
captured_at: '2026-11-28T10:19:39.818Z'
pagination_prev: "storage/raid"
---

It's possible to assign a hot spare disk for your RAID array. In case of a disk failure - the rebuild immediately begins on the assigned spare disk.

Add the RAID array with the desired number of disks:

```ros
/disk/add raid-device-count=4 raid-type=5 type=raid slot=raid5
```

Afterwards, add the disks as well as the spare to the RAID. In this case we will add NVMe5 as the spare.

```ros
/disk/set raid-master=raid5 raid-role=0 nvme1
/disk/set raid-master=raid5 raid-role=1 nvme2
/disk/set raid-master=raid5 raid-role=2 nvme3
/disk/set raid-master=raid5 raid-role=3 nvme4

/disk/set raid-master=raid5 raid-role=spare nvme5
```
