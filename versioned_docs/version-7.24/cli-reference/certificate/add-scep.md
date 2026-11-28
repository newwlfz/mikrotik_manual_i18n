---
title: "add-scep"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/certificate/add-scep
captured_at: '2026-11-28T10:19:39.818Z'
---

-----------

## certificate/add-scep 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="ca-identity" typ="string"></ArgTableRow>
<ArgTableRow arg="template" typ="enum"></ArgTableRow>
<ArgTableRow arg="scep-url" typ="string"></ArgTableRow>
<ArgTableRow arg="challenge-password" typ="string"></ArgTableRow>
<ArgTableRow arg="on-smart-card" typ="bool">stores private key on smart card if hardware supports it</ArgTableRow>
<ArgTableRow arg="refresh" typ="bool">check certificate expiry and refresh it if expired</ArgTableRow>
</ArgTable>
