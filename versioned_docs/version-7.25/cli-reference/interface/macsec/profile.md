---
sidebar_key: "cli-reference/interface/macsec/profile"
sidebar_position: 2
title: "profile"
sidebar_label: 'profile'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/macsec/profile
captured_at: '2026-11-01T21:22:51+08:00'
---

-----------

## interface/macsec/profile 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default">default</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="ciphers" typ="multi { cipher: enum (aes-gcm-128 | aes-gcm-xpn-128)
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="server-priority" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="default-name" typ="string"></ArgTableRow>
</ArgTable>
