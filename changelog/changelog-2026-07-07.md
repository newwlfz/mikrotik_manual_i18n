---
title: "Documentation updates - July 7, 2026"
date: 2026-07-07
slug: /changelog-2026-07-07
source: https://manual.mikrotik.com/changelog/changelog-2026-07-07
captured_at: '2026-11-04T06:08:08+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 7, 2026.

## Getting Started

- **[Default Configuration Passwords](/docs/getting-started/configuration-management/default-configuration-passwords)**: New page explaining where to find a device's unique factory default password (serial-number stickers, packaging, Quick Guide, product-information compartment on some indoor wireless devices) and what to do if it cannot be located.
- **[RouterOS configuration reset](/docs/getting-started/configuration-management/routeros-configuration-reset)**: Expanded with salvaged knowledge-base material.
- **[Upgrade server](/docs/getting-started/installation-and-upgrade/upgrade#standard-upgrade)** and **[CHR on AWS](/docs/getting-started/installation-and-upgrade/install/chr-installation/aws)**: New pages added.

## Diagnostics & Monitoring

- **[Downgrading RouterOS](/docs/diagnostics-monitoring-and-troubleshooting/downgrading-routeros)**: New page covering the factory-software floor, a pre-downgrade checklist (binary backup plus export), and a step-by-step downgrade procedure using /system/package/downgrade.

## Hardware

- **[Try before RMA](/docs/hardware/try-before-rma)**: New page added from knowledge-base salvage.

## Wireless

- **[WiFi](/docs/wireless/wifi/)**: Added a "Network" section documenting the /interface/wifi/network menu, which bundles SSID, security, datapath, and radio settings into a single configuration entity applied to interfaces matching its labels, with configuration examples including Multi-Link Operation (MLO).

## Site-wide

- **Property tables**: Fixed fenced code blocks that the Confluence→Docusaurus migration had flattened into single table cells (showing as raw ```ros&lt;br/&gt; text) across 11 pages, including Disks, Scripting, Log, LTE/5G, NTP, L2TP, PPPoE, and WiFi interworking. They now render as inline code.
