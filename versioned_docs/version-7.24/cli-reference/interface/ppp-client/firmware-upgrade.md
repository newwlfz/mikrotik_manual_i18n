---
sidebar_key: "cli-reference/interface/ppp-client/firmware-upgrade"
sidebar_position: 2
title: "firmware-upgrade"
sidebar_label: 'firmware-upgrade'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ppp-client/firmware-upgrade
captured_at: '2026-11-01T21:27:33+08:00'
---

-----------

## interface/ppp-client/firmware-upgrade 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="upgrade" typ="bool">perform the upgrade or just check</ArgTableRow>
<ArgTableRow arg="firmware-file" typ="file">path or url for the upgrade image</ArgTableRow>
<ArgTableRow arg="update-channel" typ="enum (stable | testing)">firmware update channel</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="installed" typ="string"></ArgTableRow>
<ArgTableRow arg="latest" typ="string"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
<ArgTableRow arg="note" typ="string"></ArgTableRow>
</ArgTable>
