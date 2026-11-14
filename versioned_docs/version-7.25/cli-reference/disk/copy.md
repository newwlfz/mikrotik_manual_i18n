---
sidebar_key: "cli-reference/disk/copy"
sidebar_position: 4
title: "copy"
sidebar_label: 'copy'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/disk/copy
captured_at: '2026-11-01T21:22:09+08:00'
---

-----------

## disk/copy 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="src" typ="enum">Source disk, partition or file.</ArgTableRow>
<ArgTableRow arg="dst" typ="enum">Destination disk, partition or file. It must be at least as large as the copied data.</ArgTableRow>
<ArgTableRow arg="src-offset" typ="num">Byte offset in the source where the copy starts. Default: 0.</ArgTableRow>
<ArgTableRow arg="dst-offset" typ="num">Byte offset in the destination where the data is written. Default: 0.</ArgTableRow>
<ArgTableRow arg="size" typ="num">Number of bytes to copy. Without it, the whole source is copied.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string">Progress of the copy: `<bytes copied> / <total bytes> (<percent>%)`.</ArgTableRow>
</ArgTable>
