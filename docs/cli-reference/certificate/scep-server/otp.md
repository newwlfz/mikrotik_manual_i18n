---
sidebar_key: "cli-reference/certificate/scep-server/otp"
title: "otp"
source: https://manual.mikrotik.com/docs/cli-reference/certificate/scep-server/otp
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## certificate/scep-server/otp 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="E" typ="expired">expired</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="password" typ="string">One-time password.</ArgTableRow>
<ArgTableRow arg="expires" typ="time">Time left until the password expires.</ArgTableRow>
<ArgTableRow arg="used" typ="bool">Whether the password has been used.</ArgTableRow>
</ArgTable>
