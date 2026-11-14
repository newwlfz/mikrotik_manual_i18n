---
sidebar_key: "cli-reference/iot/bluetooth/advertisers/ad-structures"
sidebar_position: 1
title: "ad-structures"
sidebar_label: 'ad-structures'
source: https://manual.mikrotik.com/docs/cli-reference/iot/bluetooth/advertisers/ad-structures
captured_at: '2026-11-09T11:35:47.715Z'
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
