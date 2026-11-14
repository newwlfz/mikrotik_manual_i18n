---
sidebar_key: "getting-started/installation-and-upgrade/install/chr-installation/hyperv"
sidebar_position: 4
title: "CHR: Hyper-V Installation"
sidebar_label: 'CHR: Hyper-V Installation'
description: 'This page documents the installation of MikroTik RouterOS CHR on Microsoft Hyper-V, detailing supported network adapters (synthetic and legacy) and disk controllers (IDE for system disks, SCSI for secondary ones), with a link to Hyper-V documentation.'
source: https://manual.mikrotik.com/docs/getting-started/installation-and-upgrade/install/chr-installation/hyperv
captured_at: '2026-11-09T11:35:47.715Z'
---

## Supported Network and Disk Interfaces

### Microsoft Hyper-V

**Network adapter:**

- Network adapter (synthetic)
- Legacy Network adapter

**Disk controller:**

- IDE
- SCSI

> **Note:** On Hyper-V, SCSI controllers types are supported only for secondary disks. The system disk image must be attached to an IDE controller.

#### Hyper-V

**Hyper-V documentation:**

- https://technet.microsoft.com/en-us/library/cc816585(v=ws.10).aspx#Anchor_2
