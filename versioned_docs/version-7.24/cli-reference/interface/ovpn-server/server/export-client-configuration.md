---
title: "export-client-configuration"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ovpn-server/server/export-client-configuration
captured_at: '2026-11-28T10:19:39.818Z'
pagination_prev: "cli-reference/interface/ovpn-server/server"
pagination_next: "cli-reference/interface/ppp-client"
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
