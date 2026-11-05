---
sidebar_key: "cli-reference/interface/dot1x/client"
sidebar_position: 1
title: "client"
sidebar_label: 'client'
source: https://manual.mikrotik.com/docs/cli-reference/interface/dot1x/client
captured_at: '2026-11-01T21:27:02+08:00'
---

-----------

## interface/dot1x/client 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="inactive">inactive</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="eap-methods" typ="multi { method: enum (eap-tls | eap-ttls | eap-peap | eap-mschapv2) { eap-tls:13, eap-ttls:21, eap-peap:25, eap-mschapv2:26 }
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="identity" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
<ArgTableRow arg="anon-identity" typ="string"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none)"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string"></ArgTableRow>
</ArgTable>
