---
sidebar_key: "cli-reference/system/package/local-update/download-all"
sidebar_position: 2
title: "download-all"
source: https://manual.mikrotik.com/docs/cli-reference/system/package/local-update/download-all
captured_at: '2026-11-01T21:29:57+08:00'
---

-----------

## system/package/local-update/download-all 
**Type:** Command

Download all compatible (matching device architecture) packages that are available on the local package server. Downloaded packages are saved in the root directory.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="download-beta" typ="bool">Whether to include beta packages when downloading all compatible packages.</ArgTableRow>
<ArgTableRow arg="reboot-after-download" typ="bool">Whether to automatically reboot the device after all packages finish downloading.</ArgTableRow>
</ArgTable>
