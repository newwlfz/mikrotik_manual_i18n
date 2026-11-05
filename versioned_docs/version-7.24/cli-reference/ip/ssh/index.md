---
sidebar_key: "cli-reference/ip/ssh/index"
sidebar_position: 3
title: "ssh"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/ssh
captured_at: '2026-11-01T21:28:58+08:00'
---

-----------

## ip/ssh 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="ciphers" typ="multi { array-id, cipher: enum (aes-gcm | aes-ctr | aes-cbc | 3des-cbc | null | auto)
 }">allowed cipher list</ArgTableRow>
<ArgTableRow arg="forwarding-enabled" typ="enum (no | local | remote | both)">control which forwarding is allowed</ArgTableRow>
<ArgTableRow arg="password-authentication" typ="enum (yes | no | yes-if-no-key)"></ArgTableRow>
<ArgTableRow arg="publickey-authentication-options" typ="enum (none | touch-required | verify-required)"></ArgTableRow>
<ArgTableRow arg="strong-crypto" typ="bool">use stronger encryption, HMAC algorithms, use bigger DH primes and disallow weaker ones</ArgTableRow>
<ArgTableRow arg="host-key-size" typ="enum (1024 | 1536 | 2048 | 4096 | 8192) { 1024:1024, 1536:1536, 2048:2048, 4096:4096, 8192:8192 }">RSA key size when host key is regenerated</ArgTableRow>
<ArgTableRow arg="host-key-type" typ="enum (rsa | ed25519) { rsa:0, ed25519:3 }"></ArgTableRow>
</ArgTable>
