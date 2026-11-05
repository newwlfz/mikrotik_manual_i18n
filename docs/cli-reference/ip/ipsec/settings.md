---
sidebar_key: "cli-reference/ip/ipsec/settings"
sidebar_position: 10
title: "settings"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/ipsec/settings
captured_at: '2026-11-01T21:24:14+08:00'
---

-----------

## ip/ipsec/settings 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="xauth-use-radius" typ="bool">Whether to use Radius client for XAuth users or not. The property is only applicable to peers using the IKEv1 exchange mode.</ArgTableRow>
<ArgTableRow arg="accounting" typ="bool">WWhether to send RADIUS accounting requests to a RADIUS server. Applicable if EAP Radius (auth-method=eap-radius) or pre-shared key with XAuth authentication method (auth-method=pre-shared-key-xauth) is used.</ArgTableRow>
<ArgTableRow arg="interim-update" typ="time">The interval between each consecutive RADIUS accounting Interim update. Accounting must be enabled.</ArgTableRow>
<ArgTableRow arg="ddos-cookie-threshold" typ="num">DDOS cookie activation threshold.</ArgTableRow>
</ArgTable>
