---
sidebar_key: "cli-reference/interface/ovpn-server/server/index"
sidebar_position: 2
title: "server"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ovpn-server/server
captured_at: '2026-11-01T21:27:32+08:00'
---

-----------

## interface/ovpn-server/server 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="inactive">inactive</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="mode" typ="enum (ip | ethernet) { ip:0, ethernet:1 }"></ArgTableRow>
<ArgTableRow arg="protocol" typ="enum (tcp | udp)"></ArgTableRow>
<ArgTableRow arg="netmask" typ="num"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="max-mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="keepalive-timeout" typ="enum (disabled) { disabled:0 }"></ArgTableRow>
<ArgTableRow arg="default-profile" typ="enum"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum"></ArgTableRow>
<ArgTableRow arg="require-client-certificate" typ="bool"></ArgTableRow>
<ArgTableRow arg="tls-version" typ="enum (any | only-1.2) { any:0, only-1.2:2 }"></ArgTableRow>
<ArgTableRow arg="auth" typ="ubit (sha1, md5, sha256, sha384, sha512, null)"></ArgTableRow>
<ArgTableRow arg="cipher" typ="ubit (blowfish128, aes128-cbc, aes192-cbc, aes256-cbc, aes128-gcm, aes192-gcm, aes256-gcm, null)"></ArgTableRow>
<ArgTableRow arg="reneg-sec" typ="num">Encryption key re-negotiation interval (0 - disabled)</ArgTableRow>
<ArgTableRow arg="redirect-gateway" typ="ubit (disabled, def1, ipv6)">Push 'redirect-gateway def1 ipv6' options to VPN clients</ArgTableRow>
<ArgTableRow arg="push-routes" typ="string"></ArgTableRow>
<ArgTableRow arg="push-routes-ipv6" typ="string"></ArgTableRow>
<ArgTableRow arg="enable-tun-ipv6" typ="bool">Enable ipv6 inside ovpn tunnel</ArgTableRow>
<ArgTableRow arg="tun-server-ipv6" typ="ip6Addr">Server ipv6 address</ArgTableRow>
<ArgTableRow arg="ipv6-prefix-len" typ="num">Prefix length used for tunneled ipv6</ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="user-auth-method" typ="enum (pap | mschap2) { pap:16, mschap2:2 }"></ArgTableRow>
</ArgTable>
