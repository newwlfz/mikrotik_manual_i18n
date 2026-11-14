---
title: "Documentation updates - July 1, 2026"
date: 2026-07-01
slug: /changelog-2026-07-01
source: https://manual.mikrotik.com/changelog/changelog-2026-07-01
captured_at: '2026-11-04T06:08:05+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 1, 2026.

## Diagnostics & Monitoring

- **[Netwatch](/docs/diagnostics-monitoring-and-troubleshooting/netwatch)**: The probe-type list (Simple, ICMP, TCP-conn, HTTP-GET, HTTPS-GET, DNS) is now bolded for readability, and several spelling and wording issues were corrected. Every ICMP, TCP-conn, and HTTP/S-GET parameter in the CLI reference now links directly to the matching probe-type section on this page.

## Network Management

- **[Socksify](/docs/network-management/socks/socksify)**: Added a cross-link to the CLI reference, and documented descriptions and defaults for all Socksify arguments — connection-timeout (60s), port (952), socks5-server (0.0.0.0, IPv4 only), socks5-port (1080), socks5-user, and socks5-password. The X flag is now noted as set by default.

## CLI Reference

- **[/app](/docs/cli-reference/app/)**: Added descriptions for the container app flags (X, R, c, s) and for all arguments, including container-command-lines, auto-update, use-https, network, network-pvid, network-outgoing-access, firewall-redirects, yaml, and required-mounts.
- **[/beep](/docs/cli-reference/beep) and [/blink](/docs/cli-reference/blink)**: Added command descriptions and argument details — frequency (Hz) and length for beep, duration for blink. Beep is noted as supported only on devices with a beeper.
