---
title: "Documentation updates - November 6, 2026"
date: 2026-11-06T00:00:00.000Z
slug: /changelog-2026-11-06
source: https://manual.mikrotik.com/changelog/changelog-2026-11-06
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 6, 2026

November 6, 2026

Summary of documentation changes made on November 6, 2026.

## Authentication & AAA

-   **[Certificates](/docs/authentication-authorization-accounting/certificates)**: A certificate or private key can be pasted directly instead of imported from a file, with the `pem` parameter. `/certificate/add` accepts only unencrypted private keys, while `/certificate/import` also accepts an encrypted key when `passphrase` is supplied. The CLI reference describes the new parameter.

## Bridging & Switching

-   **[VLAN](/docs/bridging-and-switching/vlan), [MACVLAN](/docs/bridging-and-switching/macvlan), [VXLAN](/docs/bridging-and-switching/vxlan)**: Documented `arp-accept`, which controls whether a gratuitous ARP frame creates a new ARP entry (default: `no`).

## Getting Started

-   **[Securing your router](/docs/getting-started/securing-your-router)**: The router-as-DNS-server case now comes first in the DNS cache section, followed by the case where another device handles DNS and `allow-remote-requests` can be turned off.

## User Guides

-   **[BGP route leak prevention](/docs/user-guides/routing-and-networking-protocols/unicast/bgp/route-leak-prevention)**: Corrected the notification that a peer sends on a role mismatch: Error Code 2 (OPEN Message Error) with Error Subcode 11 (Role Mismatch).
