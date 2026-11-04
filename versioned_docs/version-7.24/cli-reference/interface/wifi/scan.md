---
sidebar_key: "cli-reference/interface/wifi/scan"
sidebar_position: 21
title: "scan"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/wifi/scan
captured_at: '2026-11-01T21:27:56+08:00'
---

-----------

## interface/wifi/scan 
**Type:** Command

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="A" typ="active">active</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="rounds" typ="num"></ArgTableRow>
<ArgTableRow arg="save-file" typ="string"></ArgTableRow>
<ArgTableRow arg="frequency" typ="object" unset="1"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="ssid" typ="string"></ArgTableRow>
<ArgTableRow arg="channel" typ="string"></ArgTableRow>
<ArgTableRow arg="security" typ="multi { array-id, auth-type: enum (wpa2-eap | wpa2-psk | ft-eap | ft-wpa2-psk | wpa3-eap | wpa2-psk-sha2 | wpa3-psk | wpa3-psk-gd | ft-wpa3-psk | ft-wpa3-psk-gd | wpa3-eap-192 | ft-wpa3-eap-192 | owe | wpa-eap | wpa-psk | dpp)
 }"></ArgTableRow>
<ArgTableRow arg="signal" typ="num"></ArgTableRow>
<ArgTableRow arg="nf" typ="num"></ArgTableRow>
<ArgTableRow arg="sta-count" typ="num"></ArgTableRow>
</ArgTable>
