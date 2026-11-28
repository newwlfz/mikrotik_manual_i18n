---
sidebar_key: "cli-reference/certificate/add-scep"
sidebar_position: 3
title: "add-scep"
sidebar_label: 'add-scep'
source: https://manual.mikrotik.com/docs/cli-reference/certificate/add-scep
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## certificate/add-scep 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="ca-identity" typ="string"></ArgTableRow>
<ArgTableRow arg="template" typ="enum">Template to enrol.</ArgTableRow>
<ArgTableRow arg="scep-url" typ="string">URL of the SCEP server.</ArgTableRow>
<ArgTableRow arg="challenge-password" typ="string">One-time password generated on the SCEP server.</ArgTableRow>
<ArgTableRow arg="on-smart-card" typ="bool">stores private key on smart card if hardware supports it</ArgTableRow>
<ArgTableRow arg="refresh" typ="bool">check certificate expiry and refresh it if expired</ArgTableRow>
</ArgTable>
