---
sidebar_key: "routing-and-networking-protocols/unicast/bgp/faq"
sidebar_position: 5
title: "FAQ"
sidebar_label: 'FAQ'
description: 'Frequently asked questions.'
tags:
  - 'routing'
  - 'bgp'
slug: /user-guides/routing-and-networking-protocols/unicast/bgp/faq
source: https://manual.mikrotik.com/docs/7.25/user-guides/routing-and-networking-protocols/unicast/bgp/faq
captured_at: '2026-11-04T11:22:41+08:00'
---

## Why eBGP does not connect to loopback address?

eBGP by default can connect only one hop away. Loopback address is plus one more hop, because it is routed over the connected network. For multihop sessions set [`multihop`](/docs/7.25/cli-reference/routing/bgp/connection#multihop)`=yes`.

## What does BGP network synchronization exactly mean?

BGP will not announce the network unless there is a matching active IGP or connected route (exact prefix match) in the routing table. The main reason for synchronization is to avoid routing loops. If IGP is not reliable or it is necessary to always advertise the network, then add static blackhole route for each network prefix to be advertised or set [`output.network-blackhole=yes`](/docs/7.25/cli-reference/routing/bgp/connection#output.network) in [`/routing/bgp/connection`](/docs/7.25/cli-reference/routing/bgp/connection) configuration to automatically add active blackhole route for each BGP network.

## How to hide my own AS?

Peer's own AS is removed from **AS_PATH** if [`output.default-prepend`](/docs/7.25/cli-reference/routing/bgp/connection#output.default-prepend) in [`/routing/bgp/connection`](/docs/7.25/cli-reference/routing/bgp/connection) configuration is set to 0 or `bgp-path-prepend` is set to 0 in output [routing filters](/docs/7.25/cli-reference/routing/filter/rule).

## Remote peer prepends its AS several times. How to override the prepend?

Remote peers prepend can be removed by setting `bgp-path-peer-prepend 1` in BGP input [routing filter](/docs/7.25/cli-reference/routing/filter/rule).

## BGP does not pick route with shortest AS path or other metrics are ignored

BGP best path selection works only on routes received by the same [BGP instance](/docs/7.25/cli-reference/routing/bgp/instance).

## BGP routes received from one peer are not advertised to another peer

Most common misconfiguration:

- Output [filter](/docs/7.25/cli-reference/routing/filter/rule) is blocking redistribution.
- Both peers are not running on the same [BGP instance](/docs/7.25/cli-reference/routing/bgp/instance).
