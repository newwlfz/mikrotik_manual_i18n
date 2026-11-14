---
sidebar_key: "routing-and-networking-protocols/multicast/group-management-protocol"
sidebar_position: 1
title: "Group Management Protocol"
sidebar_label: 'Group Management Protocol'
description: 'Group Management Protocol enables interfaces to receive multicast streams without dedicated clients, supporting IGMP and MLD protocols. It allows testing multicast routing by sending membership reports and responding to queries, with automatic cleanup when disabled.'
tags:
  - 'igmp'
  - 'mld'
  - 'multicast'
slug: /user-guides/routing-and-networking-protocols/multicast/group-management-protocol
source: https://manual.mikrotik.com/docs/7.25/user-guides/routing-and-networking-protocols/multicast/group-management-protocol
captured_at: '2026-11-04T11:22:27+08:00'
---

The Group Management Protocol allows any of the interfaces to become a receiver for the multicast stream. It allows testing the multicast routing and switching setups without using dedicated IGMP or MLD clients. The option has been available since RouterOS v7.4 and it supports IGMP v1, v2, v3 and MLD v1, v2 protocols.

Interfaces are using IGMP v3 and MLD v2 by default. In case IGMP v1, v2 or MLD v1 queries are received, the interfaces will fall back to the appropriate version. Once the Group Management Protocol is created on the interface, it will send an unsolicited membership report (join) packet and respond to query messages. If the configuration is removed or disabled, the interface will send a leave message.

## Examples

---

This example shows how to configure a simple multicast listener on the interface.

First, add an IP address on the interface:

```ros
/ip/address
add address=192.168.10.10/24 interface=ether1 network=192.168.10.0
```

Then configure Group Management Protocol on the same interface:

```ros
/routing/gmp
add groups=229.1.1.1 interfaces=ether1
```

It is now possible to check your multicast network to see if routers or switches have created the appropriate multicast forwarding entries and whether multicast data is being received on the interface (see the interface stats, or use a [Packet Sniffer](/docs/7.25/diagnostics-monitoring-and-troubleshooting/packet-sniffer) and [Torch](/docs/7.25/diagnostics-monitoring-and-troubleshooting/torch)).
