---
sidebar_key: "user-guides/routing-and-networking-protocols/unicast/bgp/faq"
sidebar_position: 5
title: "FAQ"
sidebar_label: 'FAQ'
description: 'Frequently asked questions.'
tags:
  - 'routing'
  - 'bgp'
source: https://manual.mikrotik.com/docs/user-guides/routing-and-networking-protocols/unicast/bgp/faq
captured_at: '2026-11-28T10:14:44.799Z'
---

## Why eBGP does not connect to loopback address?

eBGP by default can connect only one hop away. Loopback address is plus one more hop, because it is routed over the connected network. For multihop sessions set [`multihop`](/docs/cli-reference/routing/bgp/connection#multihop)`=yes`.

## What does BGP network synchronization exactly mean?

BGP will not announce the network unless there is a matching active IGP or connected route (exact prefix match) in the routing table. The main reason for synchronization is to avoid routing loops. If IGP is not reliable or it is necessary to always advertise the network, then add static blackhole route for each network prefix to be advertised or set [`output.network-blackhole=yes`](/docs/cli-reference/routing/bgp/connection#output.network) in [`/routing/bgp/connection`](/docs/cli-reference/routing/bgp/connection) configuration to automatically add active blackhole route for each BGP network.

## How to hide my own AS?

Peer's own AS is removed from **AS_PATH** if [`output.default-prepend`](/docs/cli-reference/routing/bgp/connection#output.default-prepend) in [`/routing/bgp/connection`](/docs/cli-reference/routing/bgp/connection) configuration is set to 0 or `bgp-path-prepend` is set to 0 in output [routing filters](/docs/cli-reference/routing/filter/rule).

## Remote peer prepends its AS several times. How to override the prepend?

Remote peers prepend can be removed by setting `bgp-path-peer-prepend 1` in BGP input [routing filter](/docs/cli-reference/routing/filter/rule).

## BGP does not pick route with shortest AS path or other metrics are ignored

BGP best path selection works only on routes received by the same [BGP instance](/docs/cli-reference/routing/bgp/instance).

## BGP routes received from one peer are not advertised to another peer

Most common misconfiguration:

- Output [filter](/docs/cli-reference/routing/filter/rule) is blocking redistribution.
- Both peers are not running on the same [BGP instance](/docs/cli-reference/routing/bgp/instance).

## Why does SNMP monitoring degrade performance with a full BGP feed?

With a full feed, the routing table holds hundreds of thousands of routes. Some monitoring tools collect the routing table by walking the `ipCidrRouteTable` MIB subtree (`1.3.6.1.2.1.4.24.4`). Walking this table makes the SNMP agent read and encode every route, which uses CPU and memory and can degrade routing performance on a busy router.

When a tool does not need routing-table data, deny the OID for the community that the tool uses. For the default `public` community:

```ros
/snmp/community/set [find name=public] denied-oids=1.3.6.1.2.1.4.24.4
```

A denied OID returns no-such-object and a walk skips the blocked subtree, so the rest of the monitoring continues to work. The setting is per [community](/docs/cli-reference/snmp/community#denied-oids); set it on every community that can be used to poll the routing table.
