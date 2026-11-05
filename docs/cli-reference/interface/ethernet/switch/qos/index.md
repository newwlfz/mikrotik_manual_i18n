---
sidebar_key: "cli-reference/interface/ethernet/switch/qos/index"
sidebar_position: 1
title: "qos"
sidebar_label: 'qos'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/ethernet/switch/qos
captured_at: '2026-11-01T21:22:37+08:00'
---

-----------

## interface/ethernet/switch/qos 
**Syscap:** rbswitch and crs_prestera
**Type:** Directory

The entire QoS hardware configuration is located under `/in/eth/sw/qos`. This centralized approach allows you to store all QoS-related configuration items in one place, making it easy to monitor and export settings using `/in/eth/sw/qos/export`.

QoS entries have two major flag indicators:

- **H** - Hardware-offloaded entry.
- **I** - Inactive entry.
