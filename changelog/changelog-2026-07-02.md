---
title: "Documentation updates - July 2, 2026"
date: 2026-07-02T00:00:00.000Z
slug: /changelog-2026-07-02
source: https://manual.mikrotik.com/changelog/changelog-2026-07-02
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - July 2, 2026

July 2, 2026

Summary of documentation changes made on July 2, 2026.

## Authentication & AAA

-   **[Certificates](/docs/authentication-authorization-accounting/certificates)**: Added a "Manual ACME renewal" section documenting the `/certificate/acme-renew` command with usage examples. Also clarified that PKCS12 export is encrypted using AES, and that PKCS12 import supports both AES and 3DES decryption.

## System

-   **[Wake on LAN](/docs/system-information-and-utilities/wake-on-lan)**: Restructured the page — the property table was replaced by a link to the CLI reference, wording was tightened, and a WinBox screenshot of the Wake on LAN tool was added. The `interface` and `mac` arguments are now described in the CLI reference.

## Diagnostics & Monitoring

-   **[Ping](/docs/diagnostics-monitoring-and-troubleshooting/ping)**: Added a cross-link to the CLI reference, where every ping argument now has a description — `address`, `interval`, `size`, `ttl`, `dscp`, `do-not-fragment`, `src-address`, `arp-ping`, `count`, `interface`, and `vrf`, plus all read-only result fields such as `packet-loss`, `min-rtt`, `avg-rtt`, and `max-rtt`.
