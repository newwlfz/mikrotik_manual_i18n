---
sidebar_key: "cli-reference/ip/firewall/layer7-protocol"
sidebar_position: 5
title: "layer7-protocol"
sidebar_label: 'layer7-protocol'
source: https://manual.mikrotik.com/docs/cli-reference/ip/firewall/layer7-protocol
captured_at: '2026-11-28T10:14:44.799Z'
pagination_next: "cli-reference/ip/firewall/mangle"
---

-----------

## ip/firewall/layer7-protocol 
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Descriptive name of the Layer7 pattern used by firewall rules.</ArgTableRow>
<ArgTableRow arg="regexp" typ="string">Regular expression matched against the connection payload. Write hex escapes with a doubled backslash in a command (`\\x2f`); character ranges such as `[0-9]` work; POSIX character classes and octal escapes do not.</ArgTableRow>
</ArgTable>
