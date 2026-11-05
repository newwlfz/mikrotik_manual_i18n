---
sidebar_key: "cli-reference/ip/address"
sidebar_position: 1
title: "address"
sidebar_label: 'ip'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/address
captured_at: '2026-11-01T21:28:23+08:00'
---

-----------

## ip/address 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="S" typ="slave">Whether address belongs to an interface which is a slave port to some other master interface.</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="composite { address: ipAddr
, netmask: [ num [ .. 32]]
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="network" typ="ipAddr">Network address, that is calculated from address parameter using address itself and the netmask.</ArgTableRow>
<ArgTableRow arg="netmask" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="broadcast" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1">Specifies the interface on which the IPv4 address is configured. You can select it from the pool of interfaces available on the router.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="actual-interface" typ="iface_enum">Actual interface on which address is set up. For example, if address was configured on ethernet interface and ethernet interface was added to bridge, then actual interface is bridge not ethernet.</ArgTableRow>
<ArgTableRow arg="vrf" typ="enum">Indicates which VRF this IP address is associated with.</ArgTableRow>
</ArgTable>
