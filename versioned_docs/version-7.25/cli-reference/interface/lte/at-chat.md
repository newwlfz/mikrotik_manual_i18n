---
title: "at-chat"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/lte/at-chat
captured_at: '2026-11-28T10:17:19.424Z'
---

-----------

## interface/lte/at-chat 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="input" typ="string">sends command to modem and waits for any output before returning</ArgTableRow>
<ArgTableRow arg="wait" typ="alt { wait: enum (no | yes) { no:0, yes:3 }
 }">always wait 3s</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="output" typ="string"></ArgTableRow>
</ArgTable>
