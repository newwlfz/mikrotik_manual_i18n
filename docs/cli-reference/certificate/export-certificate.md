---
sidebar_key: "cli-reference/certificate/export-certificate"
sidebar_position: 10
title: "export-certificate"
sidebar_label: 'export-certificate'
source: https://manual.mikrotik.com/docs/cli-reference/certificate/export-certificate
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## certificate/export-certificate 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="export-passphrase" typ="string">Passphrase that encrypts the exported private key. Without it, only the certificate is exported.</ArgTableRow>
<ArgTableRow arg="type" typ="enum (pem | pkcs12)">
Format of the export.
- `pem` (default) - A `.crt` file with the certificate and, with `export-passphrase`, a `.key` file with the encrypted private key.
- `pkcs12` - One `.p12` file with the certificate, its private key and the certificate of the authority.
</ArgTableRow>
<ArgTableRow arg="file-name" typ="file">Name of the exported files without the extension. Default: `cert_export_<certificate name>`.</ArgTableRow>
</ArgTable>
