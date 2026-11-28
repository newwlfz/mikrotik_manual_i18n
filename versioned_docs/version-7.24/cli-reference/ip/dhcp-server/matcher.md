---
title: "matcher"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/dhcp-server/matcher
captured_at: '2026-11-28T10:19:39.818Z'
---

-----------

## ip/dhcp-server/matcher 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="server" typ="enum (all)" mandatory="1">global or single server</ArgTableRow>
<ArgTableRow arg="address-pool" typ="enum (static-only)">pool used for this entry</ArgTableRow>
<ArgTableRow arg="option-set" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="code" typ="alt { number: num [1 .. 254]
, option: enum (vendor-specific) { vendor-specific:43 }
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="value" typ="string" mandatory="1">contents of option to match as string or hex with 0x prefix</ArgTableRow>
<ArgTableRow arg="matching-type" typ="enum (exact | substring)" mandatory="1"></ArgTableRow>
</ArgTable>
