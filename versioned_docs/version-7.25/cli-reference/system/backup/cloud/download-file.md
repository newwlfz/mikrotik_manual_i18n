---
sidebar_key: "cli-reference/system/backup/cloud/download-file"
sidebar_position: 1
title: "download-file"
sidebar_label: 'download-file'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/backup/cloud/download-file
captured_at: '2026-11-01T21:25:24+08:00'
---

-----------

## system/backup/cloud/download-file 
**Type:** Command

Downloads a backup from the cloud server: this device's backup by its number in the list (`number=0`), or any backup by its `secret-download-key`.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="secret-download-key" typ="string">Key of the backup to download, shown as `secret-download-key` on the router that uploaded it. Use it to download the backup to another router.</ArgTableRow>
<ArgTableRow arg="action" typ="enum (download | download-and-apply)">
What to do with the backup:
- `download` - Save the backup file to the router's storage.
- `download-and-apply` - Save the backup file, restore the configuration from it with `password`, and reboot.
</ArgTableRow>
<ArgTableRow arg="dst-file" typ="string">Name of the saved file; `.backup` is added. Without it, the file is saved as `<name>.backup`.</ArgTableRow>
<ArgTableRow arg="password" typ="string">Password of the backup, for `action=download-and-apply`.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string">Progress of the command: `working...` while it runs, `finished` when it is done, or the error message, for example from the cloud server.</ArgTableRow>
</ArgTable>
