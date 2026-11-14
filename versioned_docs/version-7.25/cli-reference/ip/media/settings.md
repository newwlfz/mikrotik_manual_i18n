---
sidebar_key: "cli-reference/ip/media/settings"
sidebar_position: 1
title: "settings"
sidebar_label: 'settings'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/media/settings
captured_at: '2026-11-01T21:24:16+08:00'
---

-----------

## ip/media/settings 
**Conditions:** !smips
**Type:** Settings Directory

Settings shared by all DLNA media servers in [`/ip/media`](/docs/7.25/cli-reference/ip/media/). See [DLNA Media Server](/docs/7.25/storage/dlna).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="thumbnails" typ="string">Comma separated list of filenames (should end with .jpg). If name of a file in a directory matches any filename in the list, that file is treated as a thumbnail to any media file in that directory: it is no longer listed as a picture, and players show it as the cover picture of the other files. See [DLNA Media Server](/docs/7.25/storage/dlna). Default: empty.</ArgTableRow>
</ArgTable>
