---
sidebar_key: "cli-reference/user-manager/database/migrate-legacy-db"
sidebar_position: 2
title: "migrate-legacy-db"
sidebar_label: 'migrate-legacy-db'
source: https://manual.mikrotik.com/docs/cli-reference/user-manager/database/migrate-legacy-db
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## user-manager/database/migrate-legacy-db 
**Package:** userman-5
**Type:** Command

Migrates the User Manager database of RouterOS v6 to the database of the current User Manager: users, profiles, limitations, the links between them, and routers. See [Upgrading to v7](/docs/getting-started/upgrading-to-v7).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="database-path" typ="file">Folder that holds the RouterOS v6 User Manager database, for example `user-manager`. The `found-legacy-db-path` value of `/user-manager/database` shows the folder that the router found.</ArgTableRow>
<ArgTableRow arg="overwrite" typ="bool">Whether to delete the data of the current database before the migration. Without `overwrite=yes`, the command stops with an error when the current database already contains data.</ArgTableRow>
</ArgTable>
