---
sidebar_key: "cli-reference/interface/wifi/security/multi-passphrase"
sidebar_position: 2
title: "multi-passphrase"
sidebar_label: 'multi-passphrase'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wifi/security/multi-passphrase
captured_at: '2026-11-01T21:27:52+08:00'
---

-----------

## interface/wifi/security/multi-passphrase 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="E" typ="expired">expired</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="group" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="passphrase" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="expires" typ="date" unset="1"></ArgTableRow>
<ArgTableRow arg="isolation" typ="bool" unset="1"></ArgTableRow>
</ArgTable>
