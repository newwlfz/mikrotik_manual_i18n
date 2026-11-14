---
sidebar_key: "storage"
title: "Storage"
sidebar_label: 'Storage'
description: 'This page documents RouterOS storage features including disk encryption, RAID configurations, Btrfs/XFS filesystems, network protocols like iSCSI and NFS, media sharing via DLNA, file synchronization with rsync, and the Storage package that adds enterprise-level storage management.'
tags:
  - 'storage'
  - 'filesystems'
  - 'smb'
source: https://manual.mikrotik.com/docs/storage
captured_at: '2026-11-09T11:35:47.715Z'
---

This section covers RouterOS storage features: disk-level options (encryption, RAID, filesystems such as Btrfs), network storage protocols (iSCSI, NFS, SMB, NVMe over TCP), media sharing (DLNA), and file synchronization (rsync).

<DocCardList />

:::info

While regular drives are supported, for reliability purposes we recommend using drives that have Power Loss Protection (PLP).

:::

The **Storage package** (shown as `rose-storage` under `/system/package/print`) adds data-center functionality to RouterOS - disk monitoring with S.M.A.R.T., the Btrfs and XFS file systems, RAID, rsync, iSCSI, NVMe over TCP, NFS, and an SMB client. It is currently supported on **arm, arm64, x86** and **tile** platforms.

The built-in SMB **server** and DLNA media server are part of the base system and do not require the Storage package - see the [SMB](/docs/storage/smb) and [DLNA Media Server](/docs/storage/dlna) pages.
