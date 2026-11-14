---
title: "Documentation updates - October 20, 2026"
date: 2026-10-20
slug: /changelog-2026-10-20
source: https://manual.mikrotik.com/changelog/changelog-2026-10-20
captured_at: '2026-11-04T06:09:05+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 20, 2026.

## Management Tools

- **[CMR](/docs/management-tools/cmr)**: Checked the device-selection, dashboard and WiFi log examples against a CMR server. The [/cmr/device/dashboard](/docs/cli-reference/cmr/device/dashboard) and [/cmr/device/wifi-logs](/docs/cli-reference/cmr/device/wifi-logs) commands accept labels, and labels limits the WiFi log entries to the selected devices. The device list filter example uses ~ for labels, because labels= matches only the whole label list. The layout link output example is reflowed. The CLI application traffic view shows traffic counters, and the place-before note is back after a test showed the argument still adds the rule at the end. Re-checked on a fleet upgraded through CMR: a covered device that is up to date or offline stops a fail-policy=stop job before anything is upgraded; the upgrade and reboot log messages come from the new Example rules section; rebooted also fires for upgrade and reboot command restarts; the WiFi log monitor has a clients view; as-value with labels in scripts is noted.
