---
sidebar_key: "cli-reference/container/layers"
sidebar_position: 5
title: "layers"
description: 'RouterOS directory reference for /container/layers.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/container/layers
captured_at: '2026-11-01T21:26:41+08:00'
---

-----------

## container/layers 
**Package:** container
**Type:** Directory

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="layer-dir" typ="string"></ArgTableRow>
<ArgTableRow arg="size" typ="alt { size: num
, size-state: enum (unavailable | pending | done)
 }"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (layer | root-dir)"></ArgTableRow>
<ArgTableRow arg="containers" typ="multi { container: enum
 }"></ArgTableRow>
</ArgTable>
