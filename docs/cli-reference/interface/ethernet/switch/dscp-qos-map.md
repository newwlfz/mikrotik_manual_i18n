---
sidebar_key: "cli-reference/interface/ethernet/switch/dscp-qos-map"
sidebar_position: 2
title: "dscp-qos-map"
sidebar_label: 'dscp-qos-map'
source: https://manual.mikrotik.com/docs/cli-reference/interface/ethernet/switch/dscp-qos-map
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## interface/ethernet/switch/dscp-qos-map 
**Syscap:** musicswitch
**Type:** Directory

The global DSCP to QOS mapping table is used for mapping from the DSCP of the packet to new QoS attributes configured in the table.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="drop-precedence" typ="enum (green | yellow | red | drop)">The new value of Drop precedence for the DSCP to QoS mapping entry.</ArgTableRow>
<ArgTableRow arg="dei" typ="num">The new value of DEI for the DSCP to QoS mapping entry.</ArgTableRow>
<ArgTableRow arg="pcp" typ="num">The new value of PCP for the DSCP to QoS mapping entry.</ArgTableRow>
<ArgTableRow arg="priority" typ="num">The new value of internal priority for the DSCP to QoS mapping entry.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="hex" typ="num"></ArgTableRow>
</ArgTable>
