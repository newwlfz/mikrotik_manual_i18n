---
sidebar_key: "cli-reference/tool/sms/send"
sidebar_position: 2
title: "send"
sidebar_label: 'send'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/sms/send
captured_at: '2026-11-01T21:25:58+08:00'
---

-----------

## tool/sms/send 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="port" typ="alt { serial: enum
, interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="channel" typ="num"></ArgTableRow>
<ArgTableRow arg="phone-number" typ="string"></ArgTableRow>
<ArgTableRow arg="smsc" typ="string"></ArgTableRow>
<ArgTableRow arg="message" typ="string"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (class-1 | class-0 | ussd)"></ArgTableRow>
<ArgTableRow arg="status-report-request" typ="bool"></ArgTableRow>
</ArgTable>
