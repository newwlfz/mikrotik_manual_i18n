---
title: "Documentation updates - September 23, 2026"
date: 2026-09-23
slug: /changelog-2026-09-23
source: https://manual.mikrotik.com/changelog/changelog-2026-09-23
captured_at: '2026-11-04T06:08:50+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on September 23, 2026.

## Network Management

- **[DHCP](/docs/network-management/dhcp)**: Split the single DHCP page into a section with separate pages for the [DHCP Client](https://manual.mikrotik.com/docs/network-management/dhcp/client), [DHCP Server](https://manual.mikrotik.com/docs/network-management/dhcp/server), [DHCP Relay](https://manual.mikrotik.com/docs/network-management/dhcp/relay), [DHCPv6 Client](https://manual.mikrotik.com/docs/network-management/dhcp/dhcpv6-client) and [DHCPv6 Server](https://manual.mikrotik.com/docs/network-management/dhcp/dhcpv6-server). The section page now explains how DHCP works: the DISCOVER/OFFER/REQUEST/ACK exchange and the broadcast flag, lease renewal (renewing at 50% and rebinding at 87.5% of the lease time), address conflict checks, client identification, common options and why option 121 makes clients ignore option 3, relays and giaddr, and how DHCPv6 differs. The behaviour on all DHCP pages was checked on RouterOS 7.25, and every page now opens with a configuration example, while the property tables moved to the CLI Reference.
- **[DHCP Client](https://manual.mikrotik.com/docs/network-management/dhcp/client)**: New intro describing what the client applies from a lease, and a "Routes from the lease" section covering the add-default-route modes, route distance and ECMP with another default route, and routes in VRF tables. Corrected the defaults of disabled (no) and default-route-distance (1), documented dhcp-options, and removed the RouterOS v6 properties client-id and host-name. Fixed two script examples that did not work: the off-subnet gateway script is now set as the client's own script (as a separate system script it could not see the lease variables), and the WAN1 lease script now creates its routing table.
- **[DHCP Server](https://manual.mikrotik.com/docs/network-management/dhcp/server)**: Rewrote the lease allocation description (addresses are checked with ARP and ICMP, an address in use is kept as a conflict lease, static addresses are not checked) and explained authoritative precisely: no ignores only broadcast requests for unknown addresses, while unicast renewals are always answered. Removed the incorrect note that DNS entries need an existing DNS zone, updated the setup walkthrough to the current prompts (including the new send dns question), turned the manual configuration into numbered steps, and fixed the force example, which named no option.
- **[DHCP Relay](https://manual.mikrotik.com/docs/network-management/dhcp/relay)**: Rewritten from tests with two routers. Added a section on relay agent information (option 82) and how the DHCP server uses it for leases and static lease matching, noted that new IPv4 relays are created disabled, explained why the VRF example needs its dst-nat rules and cross-VRF routes, and corrected the DHCPv6 relay description: it sends Relay-Forward messages (not a Hop-by-Hop option), the default firewall must allow UDP port 547 on the client-side interface, and a new section covers store-relayed-bindings.
- **[DHCPv6 Client](https://manual.mikrotik.com/docs/network-management/dhcp/dhcpv6-client)**, **[DHCPv6 Server](https://manual.mikrotik.com/docs/network-management/dhcp/dhcpv6-server)**: New intros covering request types, dynamic pools, DUID and IAID, and server-initiated renewal (the server sends Reconfigure messages by itself when its settings change). Documented that DNS entries are created as AAAA records for address bindings only, fixed invalid IPv6 prefixes in the examples, and updated all example outputs to the RouterOS 7 format.
- **[Reverse Proxy](/docs/network-management/proxy/reverse-proxy)**: Rewrote the page with a configuration example (importing a certificate, adding a rule and allowing HTTPS in the firewall) and new sections on how rules are selected by the TLS server name (SNI, exact match only), which certificate the router presents, what the web server receives (plain HTTP/1.1 with X-Forwarded-For, X-Forwarded-Proto, Forwarded and related headers), the service port, the dynamic rules for container apps, and troubleshooting with the rproxy log. A new warning explains that www-ssl takes port 443 after a reboot when both services use it. Corrected the menu path (/ip/reverse-proxy) and the defaults: new rules are enabled, and sni, ip-address and port are mandatory. The property table moved to the CLI Reference.

## CLI Reference

- **[/ip/dhcp-client](/docs/cli-reference/ip/dhcp-client)**, **[/ip/dhcp-server](/docs/cli-reference/ip/dhcp-server)**, **[/ip/dhcp-relay](/docs/cli-reference/ip/dhcp-relay)**, **[/ipv6/dhcp-client](/docs/cli-reference/ipv6/dhcp-client)**, **[/ipv6/dhcp-server](/docs/cli-reference/ipv6/dhcp-server)**, **[/ipv6/dhcp-relay](/docs/cli-reference/ipv6/dhcp-relay)**: Wrote descriptions, including defaults, for about 180 previously empty parameters, flags and commands of the DHCP and DHCPv6 clients, servers, leases, bindings, networks, options, matchers, alerts and relays, all checked on RouterOS 7.25. This covers parameters that were not documented anywhere before, such as ipv6-only-preferred (option 108), accept-prefix-without-address, rapid-commit, the relay monitor counters and the DHCPv6 relay routes menu, and corrects wrong details such as the default life-time of static DHCPv6 bindings (1w) and the meaning of server-address.
- **[/ip/reverse-proxy](/docs/cli-reference/ip/reverse-proxy)**: Described the rule flags and the sni, ip-address, port and certificate parameters, checked on RouterOS 7.25, including the fallback to the /ip/service certificate and the log messages for unmatched names and missing certificates.

## System

- **[Services](/docs/system-information-and-utilities/services)**: The reverse-proxy service links to the Reverse Proxy page, and the certificate property notes that reverse proxy rules without their own certificate use the service certificate.

## Storage

- **[Encrypted Storage](/docs/storage/encrypted-storage)**: Removed the crypt-mode=encryption-and-integrity setting from the RAID1 example.
