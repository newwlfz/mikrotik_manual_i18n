---
sidebar_key: "cli-reference/file/tail"
sidebar_position: 7
title: "tail"
sidebar_label: 'tail'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/file/tail
captured_at: '2026-11-01T21:22:20+08:00'
---

-----------

## file/tail 
**Type:** Command

Prints the last lines of a file's contents. With `as-value`, the lines are returned as an array of strings in `lines`. See the [Files](/docs/system-information-and-utilities/files#head-or-tail-a-file) guide.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="n" typ="num" unset="1">Number of lines to output from the end of the file. Range: 1..1000. Default: 10.</ArgTableRow>
<ArgTableRow arg="numbered" typ="switch">Show line numbers in front of each line.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="lines" typ="object { line: string
 }">The output lines returned as an array of strings.</ArgTableRow>
</ArgTable>
