---
sidebar_key: "cli-reference/ip/cloud/index"
sidebar_position: 5
title: "cloud"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/cloud
captured_at: '2026-11-01T21:28:24+08:00'
---

-----------

## ip/cloud 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="ddns-enabled" typ="enum (auto | yes)"></ArgTableRow>
<ArgTableRow arg="ddns-update-interval" typ="alt { ddns-update-interval: enum (none) { none:0 }
, ddns-update-interval: time [1m .. ]
 }"></ArgTableRow>
<ArgTableRow arg="update-time" typ="bool"></ArgTableRow>
<ArgTableRow arg="back-to-home-vpn" typ="enum (revoked-and-disabled | enabled)" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-prefer-relay-code" typ="string" syscap="cloud-vpn"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="public-address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="public-address-ipv6" typ="ip6Addr"></ArgTableRow>
<ArgTableRow arg="dns-name" typ="string"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
<ArgTableRow arg="vpn-dns-name" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-port" typ="num" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-status" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-relay-rtts" typ="multi { code: string
 }" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-relay-ipv4-status" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-relay-ipv6-status" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-relay-regions" typ="multi { code: string
 }" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-relay-addresses" typ="multi { address: ipAddr
 }" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-relay-addresses-ipv6" typ="multi { address: ip6Addr
 }" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-private-key" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-public-key" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-peer-private-key" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-peer-public-key" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-interface" typ="iface_enum" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-wireguard-client-config" typ="string" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="vpn-wireguard-client-config-qrcode" typ="pic" syscap="cloud-vpn"></ArgTableRow>
<ArgTableRow arg="warning" typ="string"></ArgTableRow>
</ArgTable>
