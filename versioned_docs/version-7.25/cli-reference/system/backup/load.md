---
sidebar_key: "cli-reference/system/backup/load"
sidebar_position: 2
title: "load"
sidebar_label: 'load'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/backup/load
captured_at: '2026-11-01T21:25:24+08:00'
---

-----------

## system/backup/load 
**Type:** Command

Command loads the configuration from [backup files](/docs/7.25/getting-started/configuration-management/backup).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="file">File name for the backup file.</ArgTableRow>
<ArgTableRow arg="password" typ="string">Password for the encrypted backup file.</ArgTableRow>
<ArgTableRow arg="force-v6-to-v7-configuration-upgrade" typ="bool">This setting after loading the config (if backup has the ROSv6 config) is forcing to run configuration conversion to v7.</ArgTableRow>
</ArgTable>
