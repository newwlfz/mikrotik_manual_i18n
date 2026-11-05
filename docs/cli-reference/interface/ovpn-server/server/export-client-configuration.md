---
sidebar_key: "cli-reference/interface/ovpn-server/server/export-client-configuration"
sidebar_position: 1
title: "export-client-configuration"
sidebar_label: 'export-client-configuration'
source: https://manual.mikrotik.com/docs/cli-reference/interface/ovpn-server/server/export-client-configuration
captured_at: '2026-11-01T21:27:31+08:00'
---

-----------

## interface/ovpn-server/server/export-client-configuration 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="server" typ="enum"></ArgTableRow>
<ArgTableRow arg="server-address" typ="string">Public ip address or dns name clients will use to connect to this vpn server</ArgTableRow>
<ArgTableRow arg="ca-certificate" typ="file">CA certificate used by client ovpn configuration</ArgTableRow>
<ArgTableRow arg="client-certificate" typ="file">Client certificate used by client ovpn configuration</ArgTableRow>
<ArgTableRow arg="client-cert-key" typ="file">Client private key used by client ovpn configuration</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="progress" typ="string"></ArgTableRow>
</ArgTable>
