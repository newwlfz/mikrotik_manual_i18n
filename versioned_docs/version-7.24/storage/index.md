---
sidebar_key: "storage/index"
sidebar_position: 13
title: "Storage"
sidebar_label: 'Storage'
description: 'This page documents RouterOS storage features including disk encryption, RAID configurations, Btrfs/XFS filesystems, network protocols like iSCSI and NFS, media sharing via DLNA, file synchronization with rsync, and ROSE package enhancements for enterprise-level storage management across multiple platforms.'
tags:
  - 'storage'
  - 'filesystems'
  - 'smb'
source: https://manual.mikrotik.com/docs/7.24/storage
captured_at: '2026-11-04T11:32:50+08:00'
---

This section covers RouterOS storage features: disk-level options (encryption, RAID, filesystems such as Btrfs), network storage protocols (iSCSI, NFS, SMB, NVMe over TCP), media sharing (DLNA), and file synchronization (rsync).

<DocCardList />

:::info

While regular drives are supported, for reliability purposes we recommend using drives that have Power Loss Protection (PLP).

:::

The **ROSE (RouterOS Enterprise)** package adds data center functionality to RouterOS — supporting disk monitoring, improved formatting with BTRFS and XFS file systems, RAIDs, rsync, iSCSI, NVMe over TCP, NFS, and an SMB client. This functionality is currently supported on **arm, arm64, x86** and **tile** platforms.

The built-in SMB **server** and DLNA media server are part of the base system and do not require the ROSE package — see the [SMB](/docs/7.24/storage/smb) and [DLNA Media Server](/docs/7.24/storage/dlna) pages.
