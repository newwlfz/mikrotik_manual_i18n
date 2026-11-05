---
sidebar_key: "cli-reference/ip/media/index"
sidebar_position: 1
title: "media"
description: 'RouterOS directory reference for /ip/media.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/media
captured_at: '2026-11-01T21:28:48+08:00'
---

-----------

## ip/media 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="path" typ="file"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="friendly-name" typ="string"></ArgTableRow>
<ArgTableRow arg="allowed-ip" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="allowed-hostname" typ="string">Only IP address of this hostname (as known to DHCP server) will be allowed to access content</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string"></ArgTableRow>
</ArgTable>
