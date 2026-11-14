---
sidebar_key: "cli-reference/interface/ethernet/switch/egress-vlan-tag"
sidebar_position: 4
title: "egress-vlan-tag"
sidebar_label: 'egress-vlan-tag'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/ethernet/switch/egress-vlan-tag
captured_at: '2026-11-01T21:22:32+08:00'
---

-----------

## interface/ethernet/switch/egress-vlan-tag 
**Syscap:** musicswitch
**Type:** Directory

Egress packets can be assigned different VLAN tag formats. The VLAN tags can be removed, added, or left as is when the packet is sent to the egress port (destination port). Each port has dedicated control of the egress VLAN tag format. The tag formats include:
- Untagged
- Tagged
- Unmodified

The Egress VLAN Tag table includes 4096 entries for VLAN tagging selection.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="vlan-id" typ="num" mandatory="1">VLAN ID which is tagged in egress.</ArgTableRow>
<ArgTableRow arg="tagged-ports" typ="multi { array-id }">Ports that are tagged in egress.</ArgTableRow>
</ArgTable>
