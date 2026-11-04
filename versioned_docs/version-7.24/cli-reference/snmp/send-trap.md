---
sidebar_key: "cli-reference/snmp/send-trap"
sidebar_position: 3
title: "send-trap"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/snmp/send-trap
captured_at: '2026-11-01T21:29:43+08:00'
---

-----------

## snmp/send-trap 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="oid" typ="string"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (integer | string | nullobj | obj-id | ip-address | counter32 | timeticks | unsigned) { integer:0x02, string:0x04, nullobj:0x05, obj-id:0x06, ip-address:0x40, counter32:0x41, timeticks:0x43, unsigned:0x47 }"></ArgTableRow>
<ArgTableRow arg="value" typ="string"></ArgTableRow>
</ArgTable>
