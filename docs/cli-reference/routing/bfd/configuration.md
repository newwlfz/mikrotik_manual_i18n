---
sidebar_key: "cli-reference/routing/bfd/configuration"
sidebar_position: 2
title: "configuration"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/routing/bfd/configuration
captured_at: '2026-11-01T21:25:02+08:00'
---

-----------

## routing/bfd/configuration 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="inactive">inactive</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="vrf" typ="enum" unset="1">The Virtual Routing and Forwarding instance to which this configuration applies.</ArgTableRow>
<ArgTableRow arg="interfaces" typ="object { interface: iface_enum
 }" unset="1">list of interfaces where BFD configuration should be active.</ArgTableRow>
<ArgTableRow arg="addresses" typ="object { address: alt { ipv6: ip6Prefix
, ip: ipPrefix
 }
 }" unset="1">This config entry will only apply to BFD sessions established with these specific remote neighbors.</ArgTableRow>
<ArgTableRow arg="address-list" typ="enum" unset="1">Firewall address list name. BFD configuration will apply if remote IP address is contained within specified list.</ArgTableRow>
<ArgTableRow arg="min-tx" typ="time" unset="1">Desired transmit interval that the local router would like to use when sending BFD packets to the neighbor.</ArgTableRow>
<ArgTableRow arg="min-rx" typ="time" unset="1">Minimum receive interval that the local router requires between received BFD packets.</ArgTableRow>
<ArgTableRow arg="multiplier" typ="num" unset="1">This value is multiplied by the negotiated transmission interval to determine the **Hold Time**; if no packets within the Hold time are received - the neighbor is declared down. `Hold Time = negotiated interval × multiplier`</ArgTableRow>
<ArgTableRow arg="forbid-bfd" typ="bool" unset="1">if = **yes**: BFD sessions matching criteria will be prohibited.</ArgTableRow>
<ArgTableRow arg="keyring" typ="enum" mandatory="1"></ArgTableRow>
</ArgTable>
