---
sidebar_key: "cli-reference/certificate/enable-ssl-certificate"
sidebar_position: 9
title: "enable-ssl-certificate"
sidebar_label: 'enable-ssl-certificate'
source: https://manual.mikrotik.com/docs/cli-reference/certificate/enable-ssl-certificate
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## certificate/enable-ssl-certificate 
**Type:** Command

Obsolete. The command ends with an error that points to `/certificate/add-acme`.

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
