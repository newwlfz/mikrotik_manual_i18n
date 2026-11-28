---
title: "profile"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/macsec/profile
captured_at: '2026-11-28T10:19:39.818Z'
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
