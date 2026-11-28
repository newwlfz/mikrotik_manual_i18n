---
sidebar_key: "high-availability-solutions"
title: "High Availability Solutions"
description: 'High availability in RouterOS: bonding, multi-chassis link aggregation (MLAG), VRRP, WAN failover and load balancing over several internet links, and which one to use for what.'
tags:
  - 'high-availability'
  - 'bonding'
  - 'vrrp'
source: https://manual.mikrotik.com/docs/high-availability-solutions
captured_at: '2026-11-28T10:14:44.799Z'
---

This section is about keeping the network working when a link or a device fails, and about using several links at the same time.

| You want to | See |
| :-- | :-- |
| Join several links between two devices into one | [Bonding](/docs/bonding) |
| Connect a device to two switches with one LACP bond | [Multi-chassis Link Aggregation Group](/docs/high-availability-solutions/multi-chassis-link-aggregation-group) |
| Keep the gateway address of a network alive when a router fails | [VRRP](/docs/vrrp) |
| Use a second internet link when the first one fails | [Failover (WAN Backup)](/docs/high-availability-solutions/load-balancing/failover-wan-backup) |
| Use two internet links at the same time | [Per connection classifier](/docs/high-availability-solutions/load-balancing/per-connection-classifier) |

<DocCardList />
