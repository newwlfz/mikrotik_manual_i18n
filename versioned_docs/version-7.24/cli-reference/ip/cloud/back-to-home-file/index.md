---
sidebar_key: "cli-reference/ip/cloud/back-to-home-file/index"
sidebar_position: 1
title: "back-to-home-file"
sidebar_label: 'back-to-home-file'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/cloud/back-to-home-file
captured_at: '2026-11-01T21:28:25+08:00'
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
