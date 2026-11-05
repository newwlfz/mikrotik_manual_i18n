---
sidebar_key: "cli-reference/file/index"
sidebar_position: 3
title: "file"
description: 'RouterOS directory reference for /file.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/file
captured_at: '2026-11-01T21:26:52+08:00'
---

-----------

## file 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="S" typ="shared"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="file" mandatory="1"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (file | directory)"></ArgTableRow>
<ArgTableRow arg="contents" typ="string"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="size" typ="num"></ArgTableRow>
<ArgTableRow arg="last-modified" typ="date">Last modification date and time</ArgTableRow>
<ArgTableRow arg="package-name" typ="string"></ArgTableRow>
<ArgTableRow arg="package-version" typ="string"></ArgTableRow>
<ArgTableRow arg="package-build-time" typ="date"></ArgTableRow>
<ArgTableRow arg="package-architecture" typ="string"></ArgTableRow>
<ArgTableRow arg="url" typ="string" syscap="cloud-vpn"></ArgTableRow>
</ArgTable>
