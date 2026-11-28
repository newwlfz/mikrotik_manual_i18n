---
title: "ad-structures"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/iot/bluetooth/advertisers/ad-structures
captured_at: '2026-11-28T10:19:39.818Z'
pagination_prev: "cli-reference/iot/bluetooth/advertisers"
pagination_next: "cli-reference/iot/bluetooth/connections"
---

-----------

## iot/bluetooth/advertisers/ad-structures 
**Package:** iot
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (short-local-name | complete-local-name | service-data | manufacturer-data) { short-local-name:8, complete-local-name:9, service-data:22, manufacturer-data:255 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="data" typ="string" mandatory="1"></ArgTableRow>
</ArgTable>
