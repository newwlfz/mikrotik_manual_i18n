---
title: "Documentation updates - May 28, 2026"
date: 2026-05-28
slug: /changelog-2026-05-28
source: https://manual.mikrotik.com/changelog/changelog-2026-05-28
captured_at: '2026-11-04T06:07:47+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on May 28, 2026.

## Getting Started

- **[Getting Started](/docs/getting-started/)**: Added a Quickstart block to the landing page with the four steps to reach a new router's admin interface (browser at 192.168.88.1, WinBox, or the MikroTik mobile app). Notes that the admin password is now printed on the sticker on the router, not blank. First Time Configuration is now pinned to the top of the section.

## Storage

- **[Storage](/docs/storage/)**: Storage is now a dedicated top-level documentation section. Content previously scattered under Extended Features is reorganized into individual pages: iSCSI, NFS, NVMe over TCP, SMB (server and client), RAID, encrypted storage, rsync, ramdisk, tmpfs, self-encrypting drives, and DLNA. Old URLs are preserved via redirects so existing links continue to work.
- **[Btrfs](/docs/storage/btrfs/)**: The 860-line Btrfs monolith has been split into four focused pages: [overview](/docs/storage/btrfs/) (intro, features, quickstart), [RAID](/docs/storage/btrfs/raid) (RAID1, RAID10, device replacement, health-check script), [Snapshots](/docs/storage/btrfs/snapshots) (subvolumes, snapshots, transfer), and [Maintenance](/docs/storage/btrfs/maintenance) (periodic scrubbing, balance, snapshot rotation, free-space management).

## Containers

- **[Containers](/docs/containers/)**: Containers is now a top-level section (previously nested under Extended Features). Per-app example guides — FreeRADIUS, HAProxy, Home Assistant, Matrix Synapse, Mosquitto, Postgres, Thingsboard — are grouped under a new Examples subsection, keeping the top-level menu to Apps, VETH, and Examples.

## Hardware

- **[S.M.A.R.T.](/docs/hardware/disks/smart)**: S.M.A.R.T. disk health monitoring documentation moved from Storage to Hardware/Disks, where it sits alongside other disk-related content.
