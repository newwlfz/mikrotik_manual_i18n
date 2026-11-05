---
sidebar_key: "routing-and-networking-protocols/unicast/ospf/faq"
sidebar_position: 2
title: "FAQ"
sidebar_label: 'FAQ'
description: 'Frequently asked questions.'
tags:
  - 'routing'
  - 'ospf'
slug: /user-guides/routing-and-networking-protocols/unicast/ospf/faq
source: https://manual.mikrotik.com/docs/7.25/user-guides/routing-and-networking-protocols/unicast/ospf/faq
captured_at: '2026-11-04T11:22:51+08:00'
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
