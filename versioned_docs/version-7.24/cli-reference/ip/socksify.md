---
sidebar_key: "cli-reference/ip/socksify"
sidebar_position: 24
title: "socksify"
description: 'See Socksify for the full documentation.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/socksify
captured_at: '2026-11-01T21:28:57+08:00'
---

-----------

## ip/socksify 
**Type:** Directory

See [Socksify](/docs/7.24/network-management/socks/socksify) for the full documentation.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled (set by default)</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Name of the Socksify service</ArgTableRow>
<ArgTableRow arg="connection-timeout" typ="num">Time in seconds to wait for the SOCKS proxy or destination to respond during connection setup before aborting with an error. Set to 0 to disable timeout (default value: **60s**)</ArgTableRow>
<ArgTableRow arg="port" typ="num">TCP port used by the Socksify service (default value: **952**)</ArgTableRow>
<ArgTableRow arg="socks5-server" typ="ipAddr">IP address of the SOCKS5 proxy server, IPv4 only (default value: **0.0.0.0**)</ArgTableRow>
<ArgTableRow arg="socks5-port" typ="num">Listening port of the SOCKS5 proxy server (default value: **1080**)</ArgTableRow>
<ArgTableRow arg="socks5-user" typ="string">Username for the SOCKS5 proxy server access</ArgTableRow>
<ArgTableRow arg="socks5-password" typ="string">Password for the SOCKS5 proxy server access</ArgTableRow>
</ArgTable>
