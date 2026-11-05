---
sidebar_key: "cli-reference/ipv6/dhcp-relay/option"
sidebar_position: 3
title: "option"
source: https://manual.mikrotik.com/docs/cli-reference/ipv6/dhcp-relay/option
captured_at: '2026-11-01T21:29:02+08:00'
---

-----------

## ipv6/dhcp-relay/option 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default">default</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="code" typ="num" mandatory="1"></ArgTableRow>
<ArgTableRow arg="value" typ="string"></ArgTableRow>
<ArgTableRow arg="only-if-mac-available" typ="bool">Option is added only if packet originated from client (not another relay) and MAC address is deducible</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="raw-value" typ="string"></ArgTableRow>
</ArgTable>
