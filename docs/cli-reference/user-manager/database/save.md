---
sidebar_key: "cli-reference/user-manager/database/save"
sidebar_position: 4
title: "save"
sidebar_label: 'save'
source: https://manual.mikrotik.com/docs/cli-reference/user-manager/database/save
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## user-manager/database/save 
**Package:** userman-5
**Type:** Command

Saves the database to a `.umb` file.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="file">Name of the file. The extension `.umb` is added.</ArgTableRow>
<ArgTableRow arg="overwrite" typ="bool">Replaces a file with the same name. Without it, the command fails when the file exists.</ArgTableRow>
</ArgTable>
