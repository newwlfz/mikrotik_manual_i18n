---
sidebar_key: "cli-reference/certificate/sign"
sidebar_position: 17
title: "sign"
description: 'RouterOS command reference for /certificate/sign.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/certificate/sign
captured_at: '2026-11-01T21:26:30+08:00'
---

-----------

## certificate/sign 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="ca-crl-host" typ="multi { array-id, host: string
 }">adds CRL URL to created certificate</ArgTableRow>
<ArgTableRow arg="ca-on-smart-card" typ="bool">stores CA's private key on smart card</ArgTableRow>
<ArgTableRow arg="ca" typ="enum">issuer CA</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="progress" typ="string"></ArgTableRow>
</ArgTable>
