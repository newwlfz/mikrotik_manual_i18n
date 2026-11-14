---
sidebar_key: "cli-reference/tool/wol"
sidebar_position: 27
title: "wol"
sidebar_label: 'wol'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/wol
captured_at: '2026-11-01T21:26:04+08:00'
---

-----------

## tool/wol 
**Type:** Command

See [Wake on LAN](/docs/7.25/system-information-and-utilities/wake-on-lan) for the full documentation.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum">Interface to send the magic packet out of, for example the LAN bridge. With an interface, the router sends an Ethernet frame (EtherType `0x0842`) to the broadcast MAC address on it. Without an interface, it sends a UDP packet to `255.255.255.255` port 9 through the default route, which on most routers is the internet connection.</ArgTableRow>
<ArgTableRow arg="mac" typ="macAddr">MAC address of the computer to wake. The magic packet holds it 16 times.</ArgTableRow>
</ArgTable>
