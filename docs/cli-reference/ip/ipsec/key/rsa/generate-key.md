---
sidebar_key: "cli-reference/ip/ipsec/key/rsa/generate-key"
sidebar_position: 2
title: "generate-key"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/ipsec/key/rsa/generate-key
captured_at: '2026-11-01T21:24:10+08:00'
---

-----------

## ip/ipsec/key/rsa/generate-key 
**Type:** Command

Generate a private key. Takes two parameters, name of the newly generated key and key size 1024,2048 and 4096.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Name for the generated key.</ArgTableRow>
<ArgTableRow arg="key-size" typ="alt { key-size: enum (2048 | 4096 | 8192) { 2048:2048, 4096:4096, 8192:8192 }
 }">RSA key size in bits.</ArgTableRow>
</ArgTable>
