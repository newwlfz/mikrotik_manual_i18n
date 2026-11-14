---
sidebar_key: "user-guides/routing-and-networking-protocols/unicast/ospf/faq"
sidebar_position: 5
title: "FAQ"
sidebar_label: 'FAQ'
description: 'Frequently asked questions.'
tags:
  - 'routing'
  - 'ospf'
source: https://manual.mikrotik.com/docs/user-guides/routing-and-networking-protocols/unicast/ospf/faq
captured_at: '2026-11-09T11:35:47.715Z'
---

## Neighbors Stuck in Init State or Frequently Flapping

The most common misconfiguration reasons:

- [`router-id`](/docs/cli-reference/routing/ospf/instance#router-id) is not unique.
- A firewall is blocking OSPF protocol or multicast addresses used by OSPF.
- NAT is configured and is changing OSPF packets.

The most common network problems:

- Neighbors are connected via an L2 device that blocks or modifies multicast packets.
- Neighbors are connected via a wireless link, which cannot reliably deliver multicast packets.
The solution for both of these cases is to configure NBMA.
