---
title: "Documentation updates - November 5, 2026"
date: 2026-11-05T00:00:00.000Z
slug: /changelog-2026-11-05
source: https://manual.mikrotik.com/changelog/changelog-2026-11-05
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 5, 2026

November 5, 2026

Summary of documentation changes made on November 5, 2026.

## Containers

-   **[Apps](/docs/containers/apps/)**: Rewrote the app documentation and removed the commands that now have their own reference pages. The [app CLI reference](/docs/cli-reference/app/) describes `settings`, `setup`, `update`, `cleanup`, `network`, `restart` and `remove`, including the networks flags and `allow-outgoing-access`.
-   **[Containers](/docs/containers/)**: Added the steps to enable containers before the first one: install the `container` package and turn containers on in device-mode, where they are off by default.

## Bridging & Switching

-   **[Bridging and Switching](/docs/bridging-and-switching/)**: Bridged traffic bypasses the IP/IPv6 firewall unless `use-ip-firewall` is enabled. The `use-ip-firewall` description explains what enabling it changes: bridge Fast Path turns off, so FastTrack stops for that traffic, and the extra chains cost CPU. Routed traffic and VLAN interfaces on the bridge already pass the IP firewall.
-   **[Bridging and Switching](/docs/bridging-and-switching/)**: DHCP snooping applies to all VLANs of the bridge by default; the `dhcp-snooping-vlan-ids` property limits it to the listed VLANs, and DHCP messages in the other VLANs are forwarded without snooping. The example uses two switches in VLAN 10 with Option 82.
-   **[Bridge VLAN table](/docs/bridging-and-switching/user-guides/bridge-vlan-table)**: Named the switch chip section clearly and pointed the VLAN pages at the trunk/access example.

## Firewall & QoS

-   **[Filter](/docs/firewall-and-quality-of-service/firewall/filter)**: New section on blocking a connection that is already open. A drop rule after the rules that accept or FastTrack established connections stops only new connections; to stop open ones, put the drop rule before them.
-   **[PCQ example](/docs/firewall-and-quality-of-service/queues/pcq-example)**: Realistic per-device limits for a whole LAN (10 Mbit/s download, 5 Mbit/s upload), with `pcq-classifier` and `pcq-rate` units, and a note that FastTracked traffic bypasses the queue.

## Getting Started

-   **[First time configuration](/docs/getting-started/first-time-configuration)**: The port-forward example now limits the rule with `in-interface-list=WAN` and explains what happens without it: local devices connecting to that port on any internet server would be redirected too.
-   **[Upgrade](/docs/getting-started/installation-and-upgrade/upgrade)**: Added the command-line upgrade steps (`/system/package/update/check-for-updates` and `install`).
-   **[Securing your router](/docs/getting-started/securing-your-router)**: When the router is the DNS server for the network, keep `allow-remote-requests=yes`; the default firewall drops DNS queries from the internet.

## Hardware

-   **[RouterBOARD pages](/hardware/rb450gx4), [RB911 series](/hardware/rb911-series)**: Added product specification tables to the RouterBOARD documentation, moved the specifications under the Extension slots and ports section, standardized the Reset button sections, linked the product names, bulleted the safety warnings, and removed the leftover Confluence formatting.
-   **Hardware pages**: The RouterOS update instructions now link the Downloads section of each product page.

## Management Tools

-   **[WinBox](/docs/management-tools/winbox)**: Documented the **Set file password** action, which encrypts the saved passwords in the `.cdb` device list (the most recently used password cannot be encrypted), and the `winbox` service on TCP port 8291, including how to change the port.
-   **[CMR](/docs/management-tools/cmr/)**: Changes that CMR makes on a client are now documented as `cmr:<user>@<address>` in the client log. The **[cmr/vlan](/docs/cli-reference/cmr/vlan)** rule requires `port-labels`, so a VLAN rule always names the ports it configures instead of applying to every port of a device.

## Network Management

-   **[DHCP server](/docs/network-management/dhcp/server)**: New example for giving a device a fixed address with a static lease, without changing anything on the device.
-   **DHCP server**: The server's `address-lists` add the address of each bound lease to firewall address lists; a static lease's own `address-lists` override the server's lists for that lease.

## System

-   **[Neighbor discovery](/docs/system-information-and-utilities/neighbor-discovery)**: LLDP neighbors are in a separate table (`/ip/neighbor/lldp`), now documented on the page, in the CLI reference and for SNMP.

## User Guides

-   **[Policy routing](/docs/user-guides/routing-and-networking-protocols/policy-routing)**: New example that sends one device through a second WAN, with a routing table, a `check-gateway=ping` route and a routing rule.

## VPN

-   **[EoIP](/docs/virtual-private-networks/eoip)**: Documented EoIPv6 (`/interface/eoipv6`) as a separate encapsulation (next header 97 with a 2-byte tunnel ID, not GRE), the `tunnel-id` requirement (a mismatch keeps the running flag off; with keepalive off the flag stays up), and the MTU arithmetic: 1458 bytes over IPv4 and 1444 over IPv6 on a 1500-byte path.

## High Availability Solutions

-   **[Bonding](/docs/high-availability-solutions/bonding)**: Added an LACP example (`mode=802.3ad`) and stated that the default mode is `balance-rr`.
-   **[Failover WAN backup](/docs/high-availability-solutions/load-balancing/failover-wan-backup)**: The host routes and default routes now appear in one configuration block.

## Authentication & AAA

-   **[User](/docs/authentication-authorization-accounting/user)**: New example for creating a read-only user: a group with the `read` policy and the policies of the login tools, then a user in that group.
