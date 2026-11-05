---
sidebar_key: "storage/nfs"
sidebar_position: 5
title: "NFS"
sidebar_label: 'NFS'
description: 'NFS enables network directory sharing in RouterOS using NFS v4, requiring the Storage package. It uses port 2049 and includes configuration properties like nfs-address, nfs-share, and nfs-sharing. Example configurations show enabling NFS on a host device and mounting an NFS share from a Linux client.'
tags:
  - 'nfs'
  - 'storage'
source: https://manual.mikrotik.com/docs/storage/nfs
captured_at: '2026-11-04T11:33:03+08:00'
---

:::info
This feature requires the [Storage](/docs/storage/) package.
:::

NFS allows sharing local directories over a network. RouterOS currently supports NFS v4-only mode.

:::warning

NFS uses port TCP/2049. If the port is not available, in `disk print detail` you will see the state stuck at `nfs-state="mounting"`.

:::

## Properties

| Property | Description |
| :-- | :-- |
| **nfs-address** | IP address of the NFS target. (host device IP) |
| **nfs-share** | Specify the folder to mount (client parameter) |
| **nfs-sharing** | Disable/enable NFS on the host device |

## Configuration example

Host

```ros
/disk
set pcie1-nvme1 nfs-sharing=yes
```

Client

```ros
/disk
add type=nfs nfs-address=192.168.1.1
```

Linux client

```bash
mkdir /mnt/files
mount -t nfs 192.168.1.1:/ /mnt/files
```
