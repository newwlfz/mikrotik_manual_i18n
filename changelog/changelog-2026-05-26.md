---
title: "Documentation updates - May 26, 2026"
date: 2026-05-26
slug: /changelog-2026-05-26
source: https://manual.mikrotik.com/changelog/changelog-2026-05-26
captured_at: '2026-11-04T06:07:46+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on May 26, 2026.

## Wireless

- **[WiFi](/docs/wireless/wifi): Wi-Fi 7 MLO parameters documented** — new mld-interface and mld-name parameters enable Multi-Link Operation on Wi-Fi 7 (802.11be) hardware. CAPsMAN provisioning gains multi-link-mode and supported-hw-caps. supported-bands extended with 6ghz-ax, 6ghz-be, 2ghz-be.
- **[IS-IS](/docs/user-guides/routing-and-networking-protocols/unicast/is-is) documentation updated** — corrections, additions, and improved grammar throughout the IS-IS routing protocol page.

## Authentication & AAA

- **[RADIUS](/docs/authentication-authorization-accounting/radius): RadSec behavior clarified** — RADIUS server must use radsec as shared secret; RouterOS overrides both the shared secret and port to TCP 2083 when RadSec is enabled, regardless of manual settings.

## Network Management

- **[SOCKS](/docs/network-management/socks): user authentication documented** — /socks/users menu is now fully documented (previously "Work in Progress"). Covers enabling password-based auth (auth-method=password) and managing credentials.
- **[VRF](/docs/user-guides/routing-and-networking-protocols/vrf) documentation updated** — VRF page significantly revised with improved structure and cross-reference links.

## IP Services

- **[DNS](/docs/network-management/dhcp): new parameters documented** — add-dns-entries and add-dns-entries-suffix added to the DHCP and IPv6 Neighbor Discovery pages.

## Mobile Networking

- **[LTE](/docs/mobile-networking/lte-5g): two parameters documented** — esim-channel (auto/AT control channel for eSIM) and link-recovery-timer (seconds before LTE interface reconfigures if not running). Placeholder entries for unreleased features removed.

## Getting Started

- **[Getting Started](/docs/getting-started) section reorganized** — images moved, broken links fixed, and cross-references added throughout the Getting Started section.

## CLI Reference

- **IPv4/IPv6 address and neighbor parameters added** — [/ip/address](/docs/cli-reference/ip/address), [/ipv6/address](/docs/cli-reference/ipv6/address), [/ipv6/nd](/docs/cli-reference/ipv6/nd), and /ipv6/pool now have full parameter descriptions in the CLI Reference.
- **Routing articles: CLI cross-reference links added** — all routing documentation pages now link to corresponding CLI Reference entries.
