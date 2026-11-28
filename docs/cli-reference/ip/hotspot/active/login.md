---
sidebar_key: "cli-reference/ip/hotspot/active/login"
sidebar_position: 1
title: "login"
sidebar_label: 'login'
source: https://manual.mikrotik.com/docs/cli-reference/ip/hotspot/active/login
captured_at: '2026-11-28T10:14:44.799Z'
pagination_prev: "cli-reference/ip/hotspot/active"
---

-----------

## ip/hotspot/active/login 
**Type:** Command

The `/ip/hotspot/active/login` command logs in a device that is in `/ip/hotspot/host`, without the login page. For example, `/ip/hotspot/active/login user=anna password=ChangeMe-1 ip=192.168.88.254`.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="ip" typ="ipAddr">IP address of the device.</ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr">MAC address of the device.</ArgTableRow>
<ArgTableRow arg="user" typ="string">User name.</ArgTableRow>
<ArgTableRow arg="password" typ="string">Password of the user.</ArgTableRow>
<ArgTableRow arg="domain" typ="string">Domain of the user.</ArgTableRow>
</ArgTable>
