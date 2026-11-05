---
sidebar_key: "cli-reference/ip/dhcp-server/option/sets"
sidebar_position: 2
title: "sets"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/dhcp-server/option/sets
captured_at: '2026-11-01T21:23:53+08:00'
---

-----------

## ip/dhcp-server/option/sets 
**Type:** Directory

Groups of DHCP server options that can be assigned together with `dhcp-option-set` to a network, a server, a lease or a matcher. For details, see [DHCP Server](/docs/network-management/dhcp/server).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1">Name of the option set.</ArgTableRow>
<ArgTableRow arg="options" typ="multi { array-id, option: enum
 }" mandatory="1">Options (`/ip/dhcp-server/option`) in the set.</ArgTableRow>
</ArgTable>
