---
sidebar_key: "cli-reference/ip/ipsec/identity"
sidebar_position: 2
title: "identity"
sidebar_label: 'identity'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/ipsec/identity
captured_at: '2026-11-01T21:28:43+08:00'
---

-----------

## ip/ipsec/identity 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="peer" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="auth-method" typ="enum (pre-shared-key | digital-signature | eap | eap-radius | pre-shared-key-xauth | rsa-key | rsa-signature-hybrid)"></ArgTableRow>
<ArgTableRow arg="eap-methods" typ="multi { array-id, method: enum (eap-tls | eap-ttls | eap-peap | eap-mschapv2)
 }">EAP methods</ArgTableRow>
<ArgTableRow arg="mode-config" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="notrack-chain" typ="string">Add dynamic raw notrack rules for dynamic policies</ArgTableRow>
<ArgTableRow arg="my-id" typ="alt { string: composite { type: enum (fqdn | user-fqdn | key-id)
, data: string
 }
, address: composite { type: enum (address)
, data: alt { ipv6: ip6Addr
, ip: ipAddr
 }
 }
, other: enum (auto | dn)
 }"></ArgTableRow>
<ArgTableRow arg="remote-id" typ="alt { string: composite { type: enum (fqdn | user-fqdn | key-id)
, data: string
 }
, address: composite { type: enum (address)
, data: alt { ipv6: ip6Addr
, ip: ipAddr
 }
 }
, auto: enum (auto | ignore | dn)
 }"></ArgTableRow>
<ArgTableRow arg="match-by" typ="enum (remote-id | certificate)">identity lookup method for the responder</ArgTableRow>
<ArgTableRow arg="key" typ="enum ()">key for raw RSA authentication (ike1 only)</ArgTableRow>
<ArgTableRow arg="remote-key" typ="enum ()">remote key for raw RSA authentication (ike1 only)</ArgTableRow>
<ArgTableRow arg="secret" typ="string">pre-shared key secret</ArgTableRow>
<ArgTableRow arg="certificate" typ="multi { array-id, certificate: enum
 }">local certificate</ArgTableRow>
<ArgTableRow arg="remote-certificate" typ="enum (none) { none:-1 }">use this certificate when peer does not send one</ArgTableRow>
<ArgTableRow arg="username" typ="string">EAP or XAuth user</ArgTableRow>
<ArgTableRow arg="password" typ="string">EAP or XAuth password</ArgTableRow>
<ArgTableRow arg="generate-policy" typ="enum (no | port-override | port-strict)"></ArgTableRow>
<ArgTableRow arg="policy-template-group" typ="enum"></ArgTableRow>
</ArgTable>
