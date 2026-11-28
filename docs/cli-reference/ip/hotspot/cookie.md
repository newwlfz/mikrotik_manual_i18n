---
sidebar_key: "cli-reference/ip/hotspot/cookie"
sidebar_position: 2
title: "cookie"
sidebar_label: 'cookie'
source: https://manual.mikrotik.com/docs/cli-reference/ip/hotspot/cookie
captured_at: '2026-11-28T10:14:44.799Z'
pagination_next: "cli-reference/ip/hotspot/host"
---

-----------

## ip/hotspot/cookie 
**Type:** Directory

The `/ip/hotspot/cookie` menu lists the cookies of the `cookie` and `mac-cookie` login methods. Remove an entry to make the device log in again.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="M" typ="mac-cookie">MAC cookie, created by the `mac-cookie` login method.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="user" typ="string">User name.</ArgTableRow>
<ArgTableRow arg="domain" typ="string">Domain of the user, if it is split from the user name.</ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr">MAC address of the device.</ArgTableRow>
<ArgTableRow arg="expires-in" typ="time">Time after which the cookie is removed.</ArgTableRow>
</ArgTable>
