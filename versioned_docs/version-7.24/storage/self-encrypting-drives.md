---
sidebar_key: "storage/self-encrypting-drives"
sidebar_position: 10
title: "Self-encrypting drives (SED)"
description: 'This page documents MikroTik RouterOS''s Self-Encrypting Drive (SED) support, requiring the Storage package. It explains Opal compliance, displays supported drives with flags (o/O), and provides commands to set or...'
source: https://manual.mikrotik.com/docs/7.24/storage/self-encrypting-drives
captured_at: '2026-11-04T11:33:14+08:00'
---

:::info
This feature requires the [Storage](/docs/7.24/storage/) package.
:::

For using SED - drives have to be [Opal](https://en.wikipedia.org/wiki/Opal_Storage_Specification)-compliant. Please consult drive manufacturers' documentation to find out if a particular drive supports this feature before buying drives.

RouterOS adds **o (supported inactive)** or **O (supported active)** flags for supported drives:

```ros
/disk/print
Flags: B - BLOCK-DEVICE; M, F - FORMATTING; o - TCG-OPAL-SELF-ENCRYPTION-SUPPORTED (inactive); O - TCG-OPAL-SELF-ENCRYPTION-SUPPORTED (active)
Columns: SLOT, MODEL, SERIAL, INTERFACE, SIZE, FREE, FS, RAID-MASTER
#     SLOT   MODEL                  SERIAL           INTERFACE                   SIZE             FREE  FS    RAID
0 BMo sata1  Samsung SSD 860 2.5in  S3Z9NX0N414510L  SATA 6.0 Gbps  1 000 204 886 016  983 351 111 680  ext4  none
1 BMo sata2  Samsung SSD 860        S5GENG0N307602J  SATA 6.0 Gbps  1 000 204 886 016  983 351 128 064  ext4  none
2 BMO sata3  Samsung SSD 860        S5GENG0N307604H  SATA 6.0 Gbps  1 000 204 886 016  983 351 128 064  ext4  none
3 BMO sata4  Samsung SSD 860 2.5in  S4CSNX0N838150B  SATA 6.0 Gbps  1 000 204 886 016  983 351 128 064  ext4  none
```

To set TCG-OPAL-SELF-ENCRYPTION:

```ros
/disk
/disk/set sata1 self-encryption-password=securepassword
```

to unset:

```ros
/disk
/disk/unset sata1 self-encryption-password
```

or

```ros
/disk
/disk/set sata1 !self-encryption-password

```
