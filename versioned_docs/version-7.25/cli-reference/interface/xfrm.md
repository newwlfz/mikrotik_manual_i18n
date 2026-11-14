---
sidebar_key: "cli-reference/interface/xfrm"
sidebar_position: 44
title: "xfrm"
sidebar_label: 'xfrm'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/xfrm
captured_at: '2026-11-01T21:23:31+08:00'
---

-----------

## interface/xfrm 
**Type:** Directory

An XFRM interface provides a route-based IPsec endpoint. Bind an IPsec policy group to the interface, then route traffic for the remote network through the interface. The policies in the bound group encrypt traffic that enters the interface, and decrypted traffic is delivered through the same interface.

See [Route-based IPsec with XFRM interfaces](/docs/7.25/virtual-private-networks/ipsec/#route-based-ipsec-with-xfrm-interfaces) for a configuration example.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">Whether the interface is disabled.</ArgTableRow>
<ArgTableRow arg="R" typ="running">Whether the interface is running. The flag appears when an IPsec SA that uses the interface is established.</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Interface name.</ArgTableRow>
<ArgTableRow arg="mtu" typ="num">Layer 3 maximum transmission unit. Default: `1400`.</ArgTableRow>
</ArgTable>
