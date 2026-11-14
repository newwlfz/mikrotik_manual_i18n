---
sidebar_key: "cli-reference/tool/mac-server/index"
sidebar_position: 1
title: "mac-server"
sidebar_label: 'mac-server'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/mac-server
captured_at: '2026-11-01T21:25:55+08:00'
---

-----------

## tool/mac-server 
**Type:** Settings Directory

MAC Telnet server settings. The MAC server lets devices on the same layer-2 segment reach the router by its MAC address, without IP configuration: MAC Telnet (this menu), MAC WinBox ([`/tool/mac-server/mac-winbox`](/docs/7.25/cli-reference/tool/mac-server/mac-winbox)) and MAC ping ([`/tool/mac-server/ping`](/docs/7.25/cli-reference/tool/mac-server/ping)). Open MAC Telnet sessions are listed in [`/tool/mac-server/sessions`](/docs/7.25/cli-reference/tool/mac-server/sessions). The IP firewall does not stop MAC access; limit it with `allowed-interface-list`. For examples, see [MAC server](/docs/7.25/management-tools/mac-server).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="allowed-interface-list" typ="enum">Interface list on which the router accepts MAC Telnet connections. A bridge in the list also allows connections that arrive through its ports; a bridge port alone in the list does not. `none`, or a list without members, turns MAC Telnet off. A change applies to the next connection at once; open sessions stay. The default configuration sets `LAN`. Default: all.</ArgTableRow>
</ArgTable>
