---
title: "Documentation updates - October 20, 2026"
date: 2026-10-20T00:00:00.000Z
slug: /changelog-2026-10-20
source: https://manual.mikrotik.com/changelog/changelog-2026-10-20
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - October 20, 2026

October 20, 2026

Summary of documentation changes made on October 20, 2026.

## Management Tools

-   **[CMR](/docs/management-tools/cmr/)**: Checked the device-selection, dashboard and WiFi log examples against a CMR server. The [`/cmr/device/dashboard`](/docs/cli-reference/cmr/device/dashboard) and [`/cmr/device/wifi-logs`](/docs/cli-reference/cmr/device/wifi-logs) commands accept `labels`, and `labels` limits the WiFi log entries to the selected devices. The device list filter example uses `~` for labels, because `labels=` matches only the whole label list. The layout link output example is reflowed. The CLI application traffic view shows traffic counters, and the `place-before` note is back after a test showed the argument still adds the rule at the end. Re-checked on a fleet upgraded through CMR: a covered device that is up to date or offline stops a `fail-policy=stop` job before anything is upgraded; the upgrade and reboot log messages come from the new Example rules section; `rebooted` also fires for upgrade and `reboot` command restarts; the WiFi log monitor has a clients view; `as-value` with `labels` in scripts is noted.

## Hardware

-   **[hAP ax²](/hardware/hap-ax-2)**, **[hAP be³ Media](/hardware/hap-be-media)**, **[cAP ax](/hardware/cap-ax)**, **[hAP ac²](/hardware/hap-ac-2)** and 29 other indoor wireless pages: Setup, reset button and safety warnings follow the hardware page template: a heading linked to the product page, the safety warnings as a list, and one Setup section in place of the older "Quickstart", "Connecting" and "First steps" sections. Most Setup sections list the current steps: connect the ISP cable to Ethernet1, connect to another port or to the "MikroTik-..." Wi-Fi network, configure with the mobile app, WebFig or WinBox, and find the device under WinBox Neighbors when 192.168.88.1 does not answer. The pass covers the current hAP, cAP, wAP and Chateau models and the legacy hAP ac, cAP, mAP, wAP, RB951 and RB2011/RB4011 wireless pages.

## Site

-   **Documentation versions**: The older manual versions (7.25 and 7.24) no longer show the default "no longer actively maintained" banner.
