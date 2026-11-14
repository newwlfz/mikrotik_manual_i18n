---
sidebar_key: "cli-reference/routing/pimsm/static-rp"
sidebar_position: 7
title: "static-rp"
sidebar_label: 'static-rp'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/routing/pimsm/static-rp
captured_at: '2026-11-01T21:25:19+08:00'
---

-----------

## routing/pimsm/static-rp 
**Conditions:** !smips
**Type:** Directory

The static-rp menu allows manually defining the multicast group to RP mappings. Such a mechanism is not robust to failures but does at least provide a basic interoperability mechanism.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="inactive">inactive</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="instance" typ="enum" mandatory="1">The name of the PIM instance this static RP belongs to.</ArgTableRow>
<ArgTableRow arg="group" typ="address (flags=46/)">The multicast group that belongs to a specific RP.</ArgTableRow>
<ArgTableRow arg="address" typ="address (flags=46)">The IP address of the static RP.</ArgTableRow>
</ArgTable>
