---
sidebar_key: "cli-reference/ip/cloud/back-to-home-file/settings/remove-certificate"
sidebar_position: 1
title: "remove-certificate"
sidebar_label: 'remove-certificate'
source: https://manual.mikrotik.com/docs/cli-reference/ip/cloud/back-to-home-file/settings/remove-certificate
captured_at: '2026-11-28T10:14:44.799Z'
pagination_prev: "cli-reference/ip/cloud/back-to-home-file/settings"
pagination_next: "cli-reference/ip/cloud/back-to-home-user"
---

-----------

## ip/cloud/back-to-home-file/settings/remove-certificate 
**Syscap:** cloud-vpn
**Type:** Command

Deletes the File Share certificate from `/certificate`. It works only when no share exists; otherwise, it fails with `cannot remove certificate while file shares active`. The next share requests a new certificate. See [Stop File Share](/docs/network-management/cloud/file-share#stop-file-share).
