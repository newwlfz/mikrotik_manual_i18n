---
title: "Documentation updates - November 13, 2026"
date: 2026-11-13T00:00:00.000Z
slug: /changelog-2026-11-13
source: https://manual.mikrotik.com/changelog/changelog-2026-11-13
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 13, 2026

November 13, 2026

Summary of documentation changes made on November 13, 2026.

## Firewall & QoS

-   **[Queues](/docs/firewall-and-quality-of-service/queues/)**: Rewrote the queue documentation with tested examples: HTB, PCQ, burst, queue size and every queue type, plus the simple queue and queue tree CLI reference pages (target upload/download direction, priority, parent, packet marks).
-   **[CAKE](/docs/firewall-and-quality-of-service/queues/queue-types/cake)**: `cake-memlimit` on the CAKE queue type bounds its memory use. A CAKE queue can buffer more traffic in a simple queue than in an equivalent queue tree, so the queues index and the queue size page point at it.
-   **[RAW](/docs/firewall-and-quality-of-service/firewall/raw)**: Added the stateless warning for notracked traffic, the warning that filter rules must accept untracked packets, and filtered check outputs.
-   **[Layer7](/docs/firewall-and-quality-of-service/firewall/layer7)**: Overhauled the page. Layer7 inspection matches a regular expression against the payload of IPv4 ICMP, TCP and UDP streams only — not IPv6 and not in RAW. The page covers the inspection window, the regexp syntax (hex escapes with a doubled backslash; no POSIX classes or octal escapes), RDP and Telnet examples, and the cost of the matcher.

## High Availability Solutions

-   **[VRRP](/docs/high-availability-solutions/vrrp)**: Overhauled the page and the [configuration examples](/docs/high-availability-solutions/user-guides/vrrp-configuration-examples). All CLI rows are described, including `group-authority` (one interface controls the state of the group), `vrid`, `priority` and the ARP settings.

## VPN

-   **[PPTP](/docs/virtual-private-networks/pptp)**: Overhauled the page and filled the client and server CLI reference: new client entries are disabled, `max-mtu` and `max-mru` are 1450 by default, and the server settings are described.
-   **[IPIP](/docs/virtual-private-networks/ipip)**: Overhauled the page and the `ipip` and `ipipv6` CLI reference. The firewall matches the outer packets as `protocol=ipencap`, `mtu=auto` subtracts 20 bytes for the outer IPv4 header, and keepalive uses the `interval,retries` format.

## Bridging & Switching

-   **[MACVLAN](/docs/bridging-and-switching/macvlan)**: Overhauled the page: when to use a MACVLAN instead of a VLAN, the parent requirements, VLAN precedence, private and bridge modes, MTU, and troubleshooting. All interface properties are described in the CLI reference.

## Management Tools

-   **[SSH](/docs/management-tools/ssh)**: The known-hosts section covers the key format, one key per router address, and how to replace a key.

## Hardware

-   **[LtAP LTE12 ax](/hardware/ltap-lte12-ax)**: Updated the page for the LTE Category 12, dual-band Wi-Fi 6 access point with eSIM and GPS, including the specification and safety sections.
