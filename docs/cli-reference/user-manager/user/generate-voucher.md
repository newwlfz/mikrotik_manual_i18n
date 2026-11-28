---
sidebar_key: "cli-reference/user-manager/user/generate-voucher"
sidebar_position: 2
title: "generate-voucher"
sidebar_label: 'generate-voucher'
source: https://manual.mikrotik.com/docs/cli-reference/user-manager/user/generate-voucher
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## user-manager/user/generate-voucher 
**Package:** userman-5
**Type:** Command

Writes the names and passwords of the given users to a file in `um5files/PRIVATE/GENERATED/vouchers`, from a template.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="voucher-template" typ="enum">Name of a template file in `um5files/PRIVATE/TEMPLATES/vouchers`: `printable_vouchers.html`, `export.csv`, `export.xml` or your own.</ArgTableRow>
</ArgTable>
