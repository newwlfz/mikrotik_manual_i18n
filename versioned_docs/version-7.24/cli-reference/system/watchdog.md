---
title: "watchdog"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/watchdog
captured_at: '2026-11-28T10:19:39.818Z'
pagination_next: "cli-reference/task"
---

-----------

## system/watchdog 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="watch-address" typ="alt { ip: ipAddr
, ipv6: composite { address: ip6Addr
, interface: [ iface_enum]
 }
 }"></ArgTableRow>
<ArgTableRow arg="watchdog-timer" typ="bool"></ArgTableRow>
<ArgTableRow arg="ping-start-after-boot" typ="time"></ArgTableRow>
<ArgTableRow arg="ping-timeout" typ="time"></ArgTableRow>
<ArgTableRow arg="automatic-supout" typ="bool"></ArgTableRow>
<ArgTableRow arg="auto-send-supout" typ="bool"></ArgTableRow>
<ArgTableRow arg="send-email-to" typ="string"></ArgTableRow>
<ArgTableRow arg="send-email-from" typ="string"></ArgTableRow>
<ArgTableRow arg="send-smtp-server" typ="alt { ipv4: ipAddr
, fqdn: string
 }"></ArgTableRow>
</ArgTable>
