---
sidebar_key: "cli-reference/interface/l2tp-ether/index"
sidebar_position: 1
title: "l2tp-ether"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/l2tp-ether
captured_at: '2026-11-01T21:27:21+08:00'
---

-----------

## interface/l2tp-ether 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="R" typ="running">running</ArgTableRow>
<ArgTableRow arg="u" typ="unmanaged">unmanaged</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="connect-to" typ="address (flags=D46v)">Remote server address or empty (zero) address for incoming connections</ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="use-ipsec" typ="bool">Ignored for passive (incoming) connections (for incoming connections please use l2tp-server settings)</ArgTableRow>
<ArgTableRow arg="ipsec-secret" typ="string">Ignored for passive (incoming) connections (for incoming connections please use l2tp-server settings)</ArgTableRow>
<ArgTableRow arg="allow-fast-path" typ="bool"></ArgTableRow>
<ArgTableRow arg="l2tp-proto-version" typ="enum (l2tpv3-ip | l2tpv3-udp) { l2tpv3-ip:1, l2tpv3-udp:2 }">L2TPv3 encapsulation mode (IP or UDP)</ArgTableRow>
<ArgTableRow arg="circuit-id" typ="string">L2TPv3 remote end identifier (virtual circuit ID)</ArgTableRow>
<ArgTableRow arg="cookie-length" typ="enum (0 | 4-bytes | 8-bytes) { 0:0, 4-bytes:4, 8-bytes:8 }">Ignored for passive (incoming) connections (for incoming connections please use l2tp-server settings)</ArgTableRow>
<ArgTableRow arg="digest-hash" typ="enum (none | md5 | sha1) { none:99, md5:0, sha1:1 }">Ignored for passive (incoming) connections (for incoming connections please use l2tp-server settings)</ArgTableRow>
<ArgTableRow arg="use-l2-specific-sublayer" typ="bool">Enables L2TPv3 ethernet pseudowire level 2 default sublayer</ArgTableRow>
<ArgTableRow arg="local-address" typ="alt { local-ipv4-address: ipAddr
, local-ipv6-address: ip6Addr
 }">local IPv4 or IPv6 address (unmanaged L2TP connection)</ArgTableRow>
<ArgTableRow arg="local-tunnel-id" typ="num">local tunnel ID (unmanaged L2TP connection)</ArgTableRow>
<ArgTableRow arg="local-session-id" typ="num">local session ID (unmanaged L2TP connection)</ArgTableRow>
<ArgTableRow arg="remote-tunnel-id" typ="num">remote tunnel ID (unmanaged L2TP connection)</ArgTableRow>
<ArgTableRow arg="remote-session-id" typ="num">remote session ID (unmanaged L2TP connection)</ArgTableRow>
<ArgTableRow arg="peer-cookie" typ="string">cookie hex value for received packets (8 or 16 characters or empty) (unmanaged L2TP connection)</ArgTableRow>
<ArgTableRow arg="send-cookie" typ="string">cookie hex value for sent packets (8 or 16 characters or empty) (unmanaged L2TP connection)</ArgTableRow>
<ArgTableRow arg="unmanaged-mode" typ="bool">enables/disables unmanaged (static) tunnel mode</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="actual-mtu" typ="num"></ArgTableRow>
</ArgTable>
