---
sidebar_key: "cli-reference/interface/ethernet/switch/dscp-to-dscp"
sidebar_position: 3
title: "dscp-to-dscp"
sidebar_label: 'dscp-to-dscp'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/ethernet/switch/dscp-to-dscp
captured_at: '2026-11-01T21:22:33+08:00'
---

-----------

## interface/ethernet/switch/dscp-to-dscp 
**Syscap:** musicswitch
**Type:** Directory

The global DSCP to DSCP mapping table is used for mapping from the packet's original DSCP to the new DSCP value configured in the table.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="new-dscp" typ="num">The new value of DSCP for the DSCP to DSCP mapping entry.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="original-dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="hex" typ="num"></ArgTableRow>
</ArgTable>
