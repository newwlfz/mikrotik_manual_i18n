---
sidebar_key: "cli-reference/interface/ethernet/switch/trunk"
sidebar_position: 25
title: "trunk"
sidebar_label: 'trunk'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/ethernet/switch/trunk
captured_at: '2026-11-01T21:22:42+08:00'
---

-----------

## interface/ethernet/switch/trunk 
**Syscap:** musicswitch
**Type:** Directory

Trunking in the Cloud Router Switches provides static link aggregation groups with hardware automatic failover and load balancing. IEEE802.3ad and IEEE802.1ax compatible Link Aggregation Control Protocol is not supported. Up to 8 Trunk groups are supported with up to 8 Trunk member ports per Trunk group. CRS Port Trunking calculates transmit-hash based on all of the following parameters: L2 src-dst MAC + L3 src-dst IP + L4 src-dst Port.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Name of the Trunk group.</ArgTableRow>
<ArgTableRow arg="member-ports" typ="multi { array-id, port: enum
 }" mandatory="1">Member ports of the Trunk group.</ArgTableRow>
</ArgTable>
