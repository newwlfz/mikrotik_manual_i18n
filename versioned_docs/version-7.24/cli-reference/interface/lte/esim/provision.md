---
sidebar_key: "cli-reference/interface/lte/esim/provision"
sidebar_position: 6
title: "provision"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/lte/esim/provision
captured_at: '2026-11-01T21:27:27+08:00'
---

-----------

## interface/lte/esim/provision 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="activation-code" typ="string">Profile activation code. Example: LPA:1$server.example.io$ABCD10EFGHI5KL6M</ArgTableRow>
<ArgTableRow arg="activate" typ="bool">Activate newly created profile after it is provisioned (default: yes)</ArgTableRow>
<ArgTableRow arg="sm-dp-plus" typ="string">SM-DP+ server hostname. Example: sm-dp-plus=server.example.io</ArgTableRow>
<ArgTableRow arg="matching-id" typ="string">An activation code token. Example: matching-id=ABCD10EFGHI5KL6M</ArgTableRow>
<ArgTableRow arg="confirmation-code" typ="string">An optional code supplied by the operator</ArgTableRow>
<ArgTableRow arg="sm-dp-plus-oid" typ="string">An optional SM-DP+ supplied by the operator</ArgTableRow>
<ArgTableRow arg="force-confirmation" typ="bool">Will not ask for confirmation</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="iccid" typ="string"></ArgTableRow>
<ArgTableRow arg="spn" typ="string"></ArgTableRow>
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
</ArgTable>
