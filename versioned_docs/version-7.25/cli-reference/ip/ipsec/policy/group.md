---
title: "group"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/ipsec/policy/group
captured_at: '2026-11-28T10:17:19.424Z'
pagination_prev: "cli-reference/ip/ipsec/policy"
---

-----------

## ip/ipsec/policy/group 
**Type:** Directory

This menu allows you to create additional policy groups used by policy templates.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default">Whether the item is the default.</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1">Group name.</ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum">Interface to which policies in this group apply.</ArgTableRow>
</ArgTable>
