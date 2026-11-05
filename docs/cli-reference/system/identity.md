---
sidebar_key: "cli-reference/system/identity"
sidebar_position: 11
title: "identity"
sidebar_label: 'identity'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/identity
captured_at: '2026-11-01T21:25:29+08:00'
---

-----------

## system/identity 
**Type:** Settings Directory

The name of the router. For where it appears and examples, see [Identity](/docs/system-information-and-utilities/identity).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Name of the router, up to 64 characters; spaces and other characters are allowed, a longer name fails with `could not change identity: too long`. It appears in the CLI prompt and in WinBox, in neighbor discovery, as the SNMP `sysName`, as the host name the DHCP client sends, and as the default SSID of legacy wireless interfaces. SNMP can set it with a community that has write access. Default: MikroTik.</ArgTableRow>
</ArgTable>
