---
sidebar_key: "cli-reference/tool/mac-server/sessions"
sidebar_position: 4
title: "sessions"
sidebar_label: 'sessions'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/mac-server/sessions
captured_at: '2026-11-01T21:25:56+08:00'
---

-----------

## tool/mac-server/sessions 
**Type:** Directory

Open MAC Telnet sessions to this router. MAC WinBox connections are not listed. For examples, see [MAC server](/docs/management-tools/mac-server).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum">Interface the session arrived on.</ArgTableRow>
<ArgTableRow arg="src-address" typ="macAddr">MAC address of the client.</ArgTableRow>
<ArgTableRow arg="uptime" typ="time">How long the session has been open.</ArgTableRow>
</ArgTable>
