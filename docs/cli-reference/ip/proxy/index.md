---
sidebar_key: "cli-reference/ip/proxy/index"
sidebar_position: 7
title: "proxy"
source: https://manual.mikrotik.com/docs/cli-reference/ip/proxy
captured_at: '2026-11-01T21:28:54+08:00'
---

-----------

## ip/proxy 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="src-address" typ="object { address: alt { address: ipAddr
, address6: ip6Addr
 }
 }"></ArgTableRow>
<ArgTableRow arg="port" typ="multi { port: num [1 .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="anonymous" typ="bool"></ArgTableRow>
<ArgTableRow arg="parent-proxy" typ="alt { host: ipAddr
, host6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="parent-proxy-port" typ="num"></ArgTableRow>
<ArgTableRow arg="cache-administrator" typ="string"></ArgTableRow>
<ArgTableRow arg="max-cache-size" typ="alt { special: enum (none | unlimited) { none:0, unlimited:0xffffffff }
, value: num
 }"></ArgTableRow>
<ArgTableRow arg="max-cache-object-size" typ="num"></ArgTableRow>
<ArgTableRow arg="cache-on-disk" typ="bool"></ArgTableRow>
<ArgTableRow arg="max-client-connections" typ="num"></ArgTableRow>
<ArgTableRow arg="max-server-connections" typ="num"></ArgTableRow>
<ArgTableRow arg="max-fresh-time" typ="time"></ArgTableRow>
<ArgTableRow arg="serialize-connections" typ="bool"></ArgTableRow>
<ArgTableRow arg="always-from-cache" typ="bool"></ArgTableRow>
<ArgTableRow arg="cache-hit-dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="cache-path" typ="string"></ArgTableRow>
</ArgTable>
