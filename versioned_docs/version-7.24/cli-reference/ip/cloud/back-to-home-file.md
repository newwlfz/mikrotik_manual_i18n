---
title: "back-to-home-file"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/cloud/back-to-home-file
captured_at: '2026-11-28T10:19:39.818Z'
---

-----------

## ip/cloud/back-to-home-file 
**Syscap:** cloud-vpn
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="path" typ="file"></ArgTableRow>
<ArgTableRow arg="allow-uploads" typ="bool"></ArgTableRow>
<ArgTableRow arg="expires" typ="alt { expires: enum (never) { never:0xFFFFFFFF }
, interval: time
, date-time: date
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="key" typ="string"></ArgTableRow>
<ArgTableRow arg="url" typ="string"></ArgTableRow>
<ArgTableRow arg="direct-url" typ="string"></ArgTableRow>
<ArgTableRow arg="downloads" typ="num"></ArgTableRow>
</ArgTable>
