---
sidebar_key: "cli-reference/caps-man/manager/index"
sidebar_position: 1
title: "manager"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/caps-man/manager
captured_at: '2026-11-01T21:21:44+08:00'
---

-----------

## caps-man/manager 
**Package:** wireless-rep
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none | auto) { auto:0 }"></ArgTableRow>
<ArgTableRow arg="ca-certificate" typ="enum (none | auto) { auto:0 }"></ArgTableRow>
<ArgTableRow arg="package-path" typ="string"></ArgTableRow>
<ArgTableRow arg="upgrade-policy" typ="enum (none | suggest-same-version | require-same-version)"></ArgTableRow>
<ArgTableRow arg="require-peer-certificate" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="generated-certificate" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="generated-ca-certificate" typ="enum (none)"></ArgTableRow>
</ArgTable>
