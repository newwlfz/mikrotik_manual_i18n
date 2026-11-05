---
sidebar_key: "cli-reference/interface/ethernet/cable-test"
sidebar_position: 2
title: "cable-test"
sidebar_label: 'cable-test'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/ethernet/cable-test
captured_at: '2026-11-01T21:22:29+08:00'
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
