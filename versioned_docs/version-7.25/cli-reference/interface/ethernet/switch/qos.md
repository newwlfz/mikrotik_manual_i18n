---
title: "qos"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/ethernet/switch/qos
captured_at: '2026-11-28T10:17:19.424Z'
---

-----------

## interface/ethernet/switch/qos 
**Syscap:** rbswitch and crs_prestera
**Type:** Directory

The entire QoS hardware configuration is located under `/in/eth/sw/qos`. This centralized approach allows you to store all QoS-related configuration items in one place, making it easy to monitor and export settings using `/in/eth/sw/qos/export`.

QoS entries have two major flag indicators:

- **H** - Hardware-offloaded entry.
- **I** - Inactive entry.
