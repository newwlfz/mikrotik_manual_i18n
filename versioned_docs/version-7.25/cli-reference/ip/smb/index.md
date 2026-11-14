---
sidebar_key: "cli-reference/ip/smb/index"
sidebar_position: 1
title: "smb"
sidebar_label: 'smb'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/smb
captured_at: '2026-11-01T21:24:26+08:00'
---

-----------

## ip/smb 
**Conditions:** !smips
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="enum (no | auto | yes)">
Whether the built-in SMB server runs:
- `no` - the server is disabled.
- `auto` (default) - the server starts automatically when the first non-disabled share is configured in [`shares`](/docs/7.25/cli-reference/ip/smb/shares).
- `yes` - the server is enabled.
</ArgTableRow>
<ArgTableRow arg="domain" typ="string">Name of the Windows workgroup the SMB server belongs to. Default: MSHOME.</ArgTableRow>
<ArgTableRow arg="comment" typ="string">Comment of the SMB server. Default: MikrotikSMB.</ArgTableRow>
<ArgTableRow arg="interfaces" typ="multi { array-id, interface: iface_enum { all:0 }
 }">Interfaces on which the SMB service listens. Default: all.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string">Actual state of the SMB server, for example `enabled`.</ArgTableRow>
</ArgTable>
