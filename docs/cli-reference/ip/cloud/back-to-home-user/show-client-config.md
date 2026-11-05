---
sidebar_key: "cli-reference/ip/cloud/back-to-home-user/show-client-config"
sidebar_position: 2
title: "show-client-config"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/cloud/back-to-home-user/show-client-config
captured_at: '2026-11-01T21:23:51+08:00'
---

-----------

## ip/cloud/back-to-home-user/show-client-config 
**Syscap:** cloud-vpn
**Type:** Command

Prints the WireGuard configuration of a user and the same configuration as a QR code. Import it in a WireGuard app. Give the user by its number or with `[find name=<name>]`; a name alone is a syntax error. The configuration has a second peer with a placeholder key and `AllowedIPs = 0.0.0.0/32`, which carries no traffic; a client connects through the first peer, also when the router uses a relay.

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="conf" typ="string">WireGuard configuration of the user.</ArgTableRow>
<ArgTableRow arg="qr" typ="pic">The configuration as a QR code.</ArgTableRow>
</ArgTable>
