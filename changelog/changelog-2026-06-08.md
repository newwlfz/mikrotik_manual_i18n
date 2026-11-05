---
title: "Documentation updates - June 8, 2026"
date: 2026-06-08
slug: /changelog-2026-06-08
source: https://manual.mikrotik.com/changelog/changelog-2026-06-08
captured_at: '2026-11-04T06:07:54+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 8, 2026.

## CLI Reference

- **[IPv6 Address](/docs/cli-reference/ipv6/address)**: Improved the from-pool-policy option descriptions with clearer formatting and better examples. Rewrote the auto-link-local description to more clearly explain that manually adding a link-local address overrides the automatically generated one.
- **[IPv6 Mangle](/docs/cli-reference/ipv6/firewall/mangle)**: Reformatted the action parameter's long inline description into a proper bullet list for each action value. Improved dnpt and snpt descriptions to specify "destination IPv6 network prefix translation" and "source IPv6 network prefix translation" respectively.
- **[IPv6 Neighbor Discovery](/docs/cli-reference/ipv6/nd)**: Fixed the RFC section reference for ra-lifetime (6.2.3 → 6.2.1). Expanded the advertise-dns parameter options with proper descriptions for all three values (no, yes, self). Improved the ra-preference description to use the correct parameter name.
- **[IPv6 ND Prefix](/docs/cli-reference/ipv6/nd/prefix)**: Added a proper RFC 9762 link to the dhcp6-pd-preferred parameter description.
- **[IPv6 ND Settings](/docs/cli-reference/ipv6/nd/settings)**: Improved the menu description and rewrote the router-advertisement-ignored-options description for clarity.
- **[IPv6 Neighbor](/docs/cli-reference/ipv6/neighbor)**: Clarified the stale neighbor status description ("Will continue sending traffic" instead of "Send traffic").
- **[IPv6 Pool](/docs/cli-reference/ipv6/pool)**: Updated the description to clarify that the menu deals with IPv6 prefixes (rather than IP addresses).
- **[IPv6 Settings](/docs/cli-reference/ipv6/settings)**: Fixed the broken Fast Path link to point to the Packet Flow documentation. Simplified the reboot note to remove redundant wording.
- **[IPv4 Firewall Filter](/docs/cli-reference/ip/firewall/filter)**: Fixed the ICMP reject-with parameter — it previously referenced ICMPv6 error types (ICMP type 1) and now correctly shows the IPv4 ICMP type 3 values with proper error descriptions. Added the tcp-reset description (sends a TCP segment with the RST flag set). Expanded connection-nat-state to document the ein-snat and ein-dnat values for endpoint-independent NAT.
- **[IPv4 Firewall Mangle](/docs/cli-reference/ip/firewall/mangle)**: Fixed fasttrack-connection description ("shows fasttrack counters" → "mark the connection for FastTrack"). Fixed "ets" → "Sets" typo in new-priority. Fixed trailing double period in mark-routing description. Consistently updated rst TCP flag description from "drop connection" to "reset connection" across all firewall tables.
- **[IPv6 Firewall Filter](/docs/cli-reference/ipv6/firewall/filter)**: Expanded the reject-with parameter with detailed descriptions of each ICMPv6 error type and their corresponding ICMP type/code values, along with a link to the IANA ICMPv6 parameters registry.
- **[Disk](/docs/cli-reference/disk)**: Fixed self-encryption flag descriptions — removed the redundant "tcg-opal-" prefix from the displayed flag names.
- **[IP Settings](/docs/cli-reference/ip/settings)**: Added a security warning to accept-source-route noting that accepting source-routed packets is a spoofing risk. Reformatted the rp-filter options into a proper bullet list and clarified that strict mode causes problems with asymmetric/VPN routing. Fixed the broken Fast Path link.

## Getting Started

- **[MikroTik Hardware Licensing](/docs/getting-started/routeros-licensing/mikrotik-hardware)**: Added a new "Custom wireless channels" section documenting the Advanced Channels feature for Atheros 92xx devices, covering expanded scan-lists, precise frequency customization with kHz granularity, and non-standard channel widths.

## Bridging & Switching

- **[SwOS](/docs/bridging-and-switching)**: Added 81 new SwOS screenshots for the CSS106, CSS610, and GPEN21 switch models, covering VLAN configuration, statistics, system settings, ACLs, link status, IGMP, and more.
