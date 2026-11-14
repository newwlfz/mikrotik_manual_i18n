---
sidebar_key: "cli-reference/system/ntp/key"
sidebar_position: 2
title: "key"
sidebar_label: 'key'
source: https://manual.mikrotik.com/docs/cli-reference/system/ntp/key
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## system/ntp/key 
**Type:** Directory

Symmetric keys for NTP authentication, selected by their key ID in [`/system/ntp/client/servers`](/docs/cli-reference/system/ntp/client/servers) and [`/system/ntp/server`](/docs/cli-reference/system/ntp/server). The key value is sensitive: it is not shown in `print` or saved in `export` output. See the [NTP](/docs/system-information-and-utilities/ntp) guide.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="key-id" typ="num" mandatory="1">Key identifier, referenced by `auth-key` in the client and server configuration.</ArgTableRow>
<ArgTableRow arg="key-val" typ="string" mandatory="1">The shared secret. Not included in `export` output.</ArgTableRow>
</ArgTable>
