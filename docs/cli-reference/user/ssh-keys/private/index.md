---
sidebar_key: "cli-reference/user/ssh-keys/private/index"
sidebar_position: 2
title: "private"
sidebar_label: 'private'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/user/ssh-keys/private
captured_at: '2026-11-01T21:26:13+08:00'
---
-----------

## user/ssh-keys/private 
**Type:** Directory

Private SSH keys that identify the router in outgoing SSH connections to other devices, for example with [`/system/ssh`](../../../system/ssh) or [`/tool/fetch`](../../../tool/fetch). All properties are read-only; keys are added with [`/user/ssh-keys/private/import`](import). See [User](../../../../authentication-authorization-accounting/user) for the full guide.

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="user" typ="enum">System user that owns the key.</ArgTableRow>
<ArgTableRow arg="key-type" typ="enum (rsa | ed25519)">Type of the key: `rsa` or `ed25519`.</ArgTableRow>
<ArgTableRow arg="bits" typ="num">Key length in bits.</ArgTableRow>
<ArgTableRow arg="info" typ="string">Free-text label for the key.</ArgTableRow>
</ArgTable>
