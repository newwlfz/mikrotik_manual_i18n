---
sidebar_key: "storage/tmpfs"
sidebar_position: 12
title: "Tmpfs"
sidebar_label: 'Tmpfs'
description: 'Tmpfs enables using RAM as a filesystem, with configurable maximum size but cleared on reboot or power loss.'
tags:
  - 'storage'
  - 'tmpfs'
source: https://manual.mikrotik.com/docs/7.24/storage/tmpfs
captured_at: '2026-11-04T11:33:20+08:00'
---

:::info
This feature requires the [Storage](/docs/7.24/storage/) package.
:::

Tmpfs allows using part of RAM as a filesystem. It cannot be used as a block device.

:::warning

A tmpfs is cleared on reboot or power loss.

:::

## Properties

| Property | Description |
| :-- | :-- |
| **tmpfs-max-size** | Maximum size of the tmpfs filesystem |

## Configuration example

```ros
add type=tmpfs tmpfs-max-size=10G
```
