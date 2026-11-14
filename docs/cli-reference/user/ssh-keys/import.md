---
sidebar_key: "cli-reference/user/ssh-keys/import"
sidebar_position: 1
title: "import"
sidebar_label: 'import'
source: https://manual.mikrotik.com/docs/cli-reference/user/ssh-keys/import
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## user/ssh-keys/import 
**Type:** Command

Imports a public SSH key from a file in the router's root directory and assigns it to a user. Accepted formats: OpenSSH single-line, PKCS#1 PEM ("BEGIN RSA PUBLIC KEY") and PKCS#8/SPKI PEM ("BEGIN PUBLIC KEY"). See [User](/docs/authentication-authorization-accounting/user) for the full guide.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="public-key-file" typ="file">Name of the key file in the router's root directory.</ArgTableRow>
<ArgTableRow arg="user" typ="enum">System user to assign the key to.</ArgTableRow>
<ArgTableRow arg="info" typ="string">Free-text label for the key.</ArgTableRow>
</ArgTable>
