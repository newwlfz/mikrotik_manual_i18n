---
sidebar_key: "cli-reference/certificate/enable-ssl-certificate"
sidebar_position: 9
title: "enable-ssl-certificate"
description: 'RouterOS command reference for /certificate/enable-ssl-certificate.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/certificate/enable-ssl-certificate
captured_at: '2026-11-01T21:26:26+08:00'
---

-----------

## certificate/enable-ssl-certificate 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="dns-name" typ="string">domain name for SSL certificate</ArgTableRow>
<ArgTableRow arg="directory-url" typ="string">ACME directory url</ArgTableRow>
<ArgTableRow arg="eab-hmac-key" typ="string">base64url encoded EAB hmac key</ArgTableRow>
<ArgTableRow arg="eab-kid" typ="string">EAB account id</ArgTableRow>
<ArgTableRow arg="reset-private-key" typ="bool">initialize new private key</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="progress" typ="string"></ArgTableRow>
</ArgTable>
