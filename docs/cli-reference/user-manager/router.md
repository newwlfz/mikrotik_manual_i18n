---
sidebar_key: "cli-reference/user-manager/router"
title: "router"
source: https://manual.mikrotik.com/docs/cli-reference/user-manager/router
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## user-manager/router 
**Package:** userman-5
**Type:** Directory

Routers (NAS) that can send requests to User Manager.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">Disabled.</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1">Name of the router.</ArgTableRow>
<ArgTableRow arg="address" typ="address (flags=46/)" mandatory="1">IPv4 or IPv6 address that the requests of the router come from.</ArgTableRow>
<ArgTableRow arg="protocol" typ="enum (udp | radsec)">`udp` or `radsec` (RADIUS over TLS, TCP port 2083). Default: `udp`.</ArgTableRow>
<ArgTableRow arg="shared-secret" typ="string">Shared secret. The RADIUS client of the router must have the same.</ArgTableRow>
<ArgTableRow arg="coa-port" typ="num">UDP port of the router for disconnect and Change of Authorization requests. Set the `port` of `/radius/incoming` of the router. Not used with `protocol=radsec`: the requests go inside the TLS connection. Default: 3799.</ArgTableRow>
</ArgTable>
