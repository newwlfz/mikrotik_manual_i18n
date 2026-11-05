---
sidebar_key: "cli-reference/ip/ipsec/profile"
sidebar_position: 8
title: "profile"
description: 'RouterOS directory reference for /ip/ipsec/profile.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/ipsec/profile
captured_at: '2026-11-01T21:28:46+08:00'
---

-----------

## ip/ipsec/profile 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default">default</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="hash-algorithm" typ="enum (md5 | sha1 | sha256 | sha384 | sha512)"></ArgTableRow>
<ArgTableRow arg="prf-algorithm" typ="enum (auto | sha1 | sha256 | sha384 | sha512)">IKEv2 only</ArgTableRow>
<ArgTableRow arg="enc-algorithm" typ="ubit (aes-256, aes-192, aes-128, 3des, des)"></ArgTableRow>
<ArgTableRow arg="dh-group" typ="ubit (x25519, ecp256, ecp384, ecp521, modp6144, modp4096, modp3072, modp2048, modp1536, modp1024, modp768)"></ArgTableRow>
<ArgTableRow arg="lifetime" typ="time">IKEv1 only</ArgTableRow>
<ArgTableRow arg="lifebytes" typ="num">IKEv1 only</ArgTableRow>
<ArgTableRow arg="proposal-check" typ="enum (obey | strict | claim | exact) { obey:1, strict:2, claim:3, exact:4 }">Lifetime check logic (IKEv1 only)</ArgTableRow>
<ArgTableRow arg="nat-traversal" typ="bool">IKEv1 only</ArgTableRow>
<ArgTableRow arg="ppk" typ="enum (no | psk | qkd | psk-ike-initial)">post-quantum preshared key (IKEv2 only)</ArgTableRow>
<ArgTableRow arg="dpd-interval" typ="alt { special: enum (disable-dpd) { disable-dpd:0 }
, num: time [ .. 3600]
 }"></ArgTableRow>
<ArgTableRow arg="dpd-maximum-failures" typ="num">IKEv1 only</ArgTableRow>
</ArgTable>
