---
title: "Documentation updates - October 14, 2026"
date: 2026-10-14T00:00:00.000Z
slug: /changelog-2026-10-14
source: https://manual.mikrotik.com/changelog/changelog-2026-10-14
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - October 14, 2026

October 14, 2026

Summary of documentation changes made on October 14, 2026.

## System

-   **[Device mode](/docs/system-information-and-utilities/device-mode)**: Rewritten and tested on RouterOS 7.26beta1. All examples and outputs refreshed, with verified mechanics: confirmation with the reset or mode button or a power cycle (a regular reboot does not confirm), mode replacement versus per-feature updates, `print config` showing only non-default settings, the update-attempt counter and its reset window (`activation-timeout`), and configuration for a disabled feature being created inactivated.

## CLI Reference

-   **[`/system/device-mode`](/docs/cli-reference/system/device-mode)**, **[`/system/device-mode/update`](/docs/cli-reference/system/device-mode/update)**: Menu intros and all parameter descriptions filled in, including which tools and menus each feature switch controls (`speed-test` under `bandwidth-test`, `ping-speed` under `traffic-gen`) and the attempt-counter reset window.

## Management Tools

-   **[WinBox](/docs/management-tools/winbox)**: Some fields in the Resources section are interactive: clicking a field opens the related section of the configuration interface.
