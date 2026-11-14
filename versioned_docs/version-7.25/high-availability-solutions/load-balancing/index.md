---
sidebar_key: "high-availability-solutions/load-balancing/index"
sidebar_position: 3
title: "Load Balancing"
sidebar_label: 'Load Balancing'
description: 'Network load balancing in MikroTik RouterOS allows distributing traffic across multiple links without dynamic routing, with options for per-connection or per-packet methods. The documentation includes setup examples like failover configurations and comparisons of balancing techniques using firewall mangle, bonding, OSPF, and ECMP.'
tags:
  - 'load-balancing'
  - 'firewall-mangle'
  - 'bonding'
source: https://manual.mikrotik.com/docs/7.25/high-availability-solutions/load-balancing
captured_at: '2026-11-04T11:17:43+08:00'
---

- [Failover (WAN Backup)](/docs/7.25/high-availability-solutions/load-balancing/failover-wan-backup)
- [Firewall Marking](/docs/7.25/firewall-and-quality-of-service/firewall/mangle)
- [Bonding Load Balancing](/docs/7.25/high-availability-solutions/bonding)
- [OSPF Load Balancing](/docs/7.25/user-guides/routing-and-networking-protocols/unicast/ospf/)
- [Per connection classifier](/docs/7.25/high-availability-solutions/load-balancing/per-connection-classifier)

## Introduction

Network load balancing is the ability to balance traffic across two or more links.

There are two types of balancing methods:

- per-packet - each packet of a single stream can be forwarded over different links. This method will work reliably especially on TCP and secure connections only when you are able to control both balancing endpoints.
- per-connection - all packets of the same connection (stream) are always sent over one link. This method is mandatory in setups where only one end of the balancing is under our control, for example, a home router with multiple WAN connections.

| Method |  | Per-connection | Per-packet |
| :-- | :-- | :-- | :-- |
| <br/> Firewall Mangle | Nth | **Yes** | **Yes** |
|  | PCC (Per Connection Classifier) | **Yes** | No |
|  | Other matchers | **Yes** | **Yes** |
| ECMP (Equal Cost Multi-Path) |  | **Yes** | **No** |
| Bonding |  | No | **Yes** |
| OSPF |  | **Yes** | No |
| BGP |  | **Yes** | No |

## Simple Failover Example

The simplest failover setup would be to use multiple gateways when one gateway is active and another one takes over when the first one fails.

To make this work, configure a larger **distance** value for the secondary one, and **check-gateway** for the first one:

```ros
/ip/route/add gateway=192.168.1.1 distance=1 check-gateway=ping
/ip/route/add gateway=192.168.2.1 distance=2
```

The *check-gateway* will make sure the gateway is up only when actual traffic can reach the gateway. When the ping fails the first gateway will become inactive and the second one will take over,  and when the first gateway recovers  it will become active and make the second gateway work again as a backup.

## Related topics

<DocCardList />
