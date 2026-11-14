---
sidebar_key: "cli-reference/user/ssh-keys/private/import"
sidebar_position: 1
title: "import"
sidebar_label: 'import'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/user/ssh-keys/private/import
captured_at: '2026-11-01T21:26:13+08:00'
---

-----------

## user/ssh-keys/private/import 
**Type:** Command

Imports a private SSH key from a file in the router's root directory. Accepted formats: PKCS#1 PEM RSA ("BEGIN RSA PRIVATE KEY"), PKCS#8 ("BEGIN PRIVATE KEY") and encrypted PKCS#8 ("BEGIN ENCRYPTED PRIVATE KEY", requires `passphrase`). OpenSSH-format private keys ("BEGIN OPENSSH PRIVATE KEY") are rejected. See [User](/docs/7.25/authentication-authorization-accounting/user) for the full guide.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="private-key-file" typ="file">Name of the key file in the router's root directory.</ArgTableRow>
<ArgTableRow arg="user" typ="enum">System user that owns the key.</ArgTableRow>
<ArgTableRow arg="passphrase" typ="string">Passphrase of an encrypted key file.</ArgTableRow>
<ArgTableRow arg="info" typ="string">Free-text label for the key.</ArgTableRow>
</ArgTable>
