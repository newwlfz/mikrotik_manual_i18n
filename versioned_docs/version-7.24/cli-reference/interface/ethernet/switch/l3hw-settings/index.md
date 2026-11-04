---
sidebar_key: "cli-reference/interface/ethernet/switch/l3hw-settings/index"
sidebar_position: 2
title: "l3hw-settings"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/l3hw-settings
captured_at: '2026-11-01T21:27:10+08:00'
---

-----------

## interface/ethernet/switch/l3hw-settings 
**Syscap:** rbswitch and crs_prestera
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="autorestart" typ="bool" syscap="!prestera-cpss">Automatically restarts L3HW in case of driver failure</ArgTableRow>
<ArgTableRow arg="fasttrack-hw" typ="bool" syscap="!prestera-ac3">Hardware offloading of FastTrack connections</ArgTableRow>
<ArgTableRow arg="ipv6-hw" typ="bool">IPv6 hardware offloading</ArgTableRow>
<ArgTableRow arg="icmp-reply-on-error" typ="bool">In case of a packet error (TTL, MTU, etc.), either redirect the packet to the CPU for ICMP reply (yes) or silently drop (no)</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="hw-supports-fasttrack" typ="bool">Does the hardware supports FastTrack offloading?</ArgTableRow>
</ArgTable>
