---
sidebar_key: "routing-and-networking-protocols/unicast/rip"
sidebar_position: 6
title: "RIP"
sidebar_label: 'RIP'
description: 'MikroTik RouterOS supports RIP version 2 for exchanging routing information within autonomous systems, selecting optimal paths based on hop count. Configuration is available under `/routing/rip`.'
tags:
  - 'routing'
  - 'rip'
slug: /user-guides/routing-and-networking-protocols/unicast/rip
source: https://manual.mikrotik.com/docs/7.24/user-guides/routing-and-networking-protocols/unicast/rip
captured_at: '2026-11-04T11:34:17+08:00'
---

MikroTik RouterOS implements RIP version 2 (RFC 2453). Version 1 (RFC 1058) is not supported.

RIP enables routers in an autonomous system to exchange routing information. It always uses the best path (the path with the fewest number of hops (i.e. routers)) available. Configuration is available under [`/routing/rip`](/docs/7.24/cli-reference/routing/rip/instance).
