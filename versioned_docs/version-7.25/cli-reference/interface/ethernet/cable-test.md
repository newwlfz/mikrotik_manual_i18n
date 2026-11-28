---
title: "cable-test"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/ethernet/cable-test
captured_at: '2026-11-28T10:17:19.424Z'
---

-----------

## interface/ethernet/cable-test 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="status" typ="enum (unknown | link-ok | no-link | initializing | auto-init-failed)"></ArgTableRow>
<ArgTableRow arg="cable-pairs" typ="multi { array-id, array-id, mac-mask: composite { status: enum (normal | shorted | open | unknown | line-driver | mismatch)
, cable-length: enum (?) { ?:0xffffffff }
 }
 }"></ArgTableRow>
</ArgTable>
