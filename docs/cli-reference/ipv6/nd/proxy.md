---
sidebar_key: "cli-reference/ipv6/nd/proxy"
sidebar_position: 3
title: "proxy"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ipv6/nd/proxy
captured_at: '2026-11-01T21:24:40+08:00'
---

-----------

## ipv6/nd/proxy 
**Type:** Directory

An IPv6 Neighbor Discovery Proxy allows a router or host to respond to Neighbor Discovery ([RFC 4861](https://tools.ietf.org/html/rfc4861)) messages on behalf of another node. This enables communication across different network segments as if they were on the same link. In RouterOS, the proxy can be enabled for a single IPv6 address and works per interface.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="ip6Addr">IPv6 address the proxy takes ownership of.</ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum">Interface on which the proxy operates for this IPv6 address.</ArgTableRow>
</ArgTable>
