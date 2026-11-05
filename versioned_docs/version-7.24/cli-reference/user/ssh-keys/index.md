---
sidebar_key: "cli-reference/user/ssh-keys/index"
sidebar_position: 2
title: "ssh-keys"
description: 'RouterOS directory reference for /user/ssh-keys.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/user/ssh-keys
captured_at: '2026-11-01T21:30:36+08:00'
---

-----------

## user/ssh-keys 
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="user" typ="enum"></ArgTableRow>
<ArgTableRow arg="key" typ="string">only for adding new keys</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="key-type" typ="enum (rsa | ed25519 | ed25519-sk)"></ArgTableRow>
<ArgTableRow arg="bits" typ="num"></ArgTableRow>
<ArgTableRow arg="info" typ="string"></ArgTableRow>
<ArgTableRow arg="fingerprint" typ="string"></ArgTableRow>
</ArgTable>
