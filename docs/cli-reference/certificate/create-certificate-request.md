---
sidebar_key: "cli-reference/certificate/create-certificate-request"
sidebar_position: 7
title: "create-certificate-request"
sidebar_label: 'create-certificate-request'
source: https://manual.mikrotik.com/docs/cli-reference/certificate/create-certificate-request
captured_at: '2026-11-28T10:14:44.799Z'
pagination_next: "cli-reference/certificate/crl"
---

-----------

## certificate/create-certificate-request 
**Type:** Command

Create a certificate request and a private key from a template. Writes the files `certificate-request.pem` and `certificate-request_key.pem`.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="template" typ="enum">Template to create the request from.</ArgTableRow>
<ArgTableRow arg="key-passphrase" typ="string">Passphrase that encrypts the private key file.</ArgTableRow>
<ArgTableRow arg="challenge-passphrase" typ="string"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="progress" typ="string"></ArgTableRow>
</ArgTable>
