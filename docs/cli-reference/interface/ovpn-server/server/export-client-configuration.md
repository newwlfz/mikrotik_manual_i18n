---
sidebar_key: "cli-reference/interface/ovpn-server/server/export-client-configuration"
sidebar_position: 1
title: "export-client-configuration"
sidebar_label: 'export-client-configuration'
source: https://manual.mikrotik.com/docs/cli-reference/interface/ovpn-server/server/export-client-configuration
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## interface/ovpn-server/server/export-client-configuration 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="server" typ="enum">OVPN server name to export configuration from.</ArgTableRow>
<ArgTableRow arg="server-address" typ="string">Public IP address or DNS name clients use to connect to this VPN server.</ArgTableRow>
<ArgTableRow arg="ca-certificate" typ="file">CA certificate used by the client OVPN configuration.</ArgTableRow>
<ArgTableRow arg="client-certificate" typ="file">Client certificate used by the client OVPN configuration.</ArgTableRow>
<ArgTableRow arg="client-cert-key" typ="file">Client private key used by the client OVPN configuration.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="progress" typ="string">Export progress status.</ArgTableRow>
</ArgTable>
