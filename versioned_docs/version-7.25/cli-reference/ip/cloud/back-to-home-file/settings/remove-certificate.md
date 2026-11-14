---
sidebar_key: "cli-reference/ip/cloud/back-to-home-file/settings/remove-certificate"
sidebar_position: 1
title: "remove-certificate"
sidebar_label: 'remove-certificate'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/cloud/back-to-home-file/settings/remove-certificate
captured_at: '2026-11-01T21:23:47+08:00'
---

-----------

## ip/cloud/back-to-home-file/settings/remove-certificate 
**Syscap:** cloud-vpn
**Type:** Command

Deletes the File Share certificate from `/certificate`. It works only when no share exists; otherwise, it fails with `cannot remove certificate while file shares active`. The next share requests a new certificate. See [Stop File Share](/docs/7.25/network-management/cloud/file-share#stop-file-share).
