# network

> RouterOS directory reference for /interface/wifi/network.

-----------

## interface/wifi/network 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="Y" typ="managed">managed</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="mlo" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="labels" typ="object" unset="1"></ArgTableRow>
<ArgTableRow arg="ssid" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="mode" typ="enum (ap | station | station-bridge | station-pseudobridge)" unset="1"></ArgTableRow>
<ArgTableRow arg="hide-ssid" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="beacon-interval" typ="time" unset="1"></ArgTableRow>
<ArgTableRow arg="dtim-period" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="multicast-enhance" typ="enum (disabled | enabled) { disabled:0, enabled:1 }" unset="1"></ArgTableRow>
<ArgTableRow arg="qos-classifier" typ="enum (priority | dscp-high-3-bits) { priority:0, dscp-high-3-bits:1 }" unset="1"></ArgTableRow>
<ArgTableRow arg="station-roaming" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="max-clients" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="hw-protection-mode" typ="enum (none | rts-cts | cts-to-self)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.encryption" typ="ubit (tkip, ccmp, gcmp, ccmp-256, gcmp-256)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.group-encryption" typ="enum (tkip | ccmp | gcmp | ccmp-256 | gcmp-256)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.group-key-update" typ="time" unset="1"></ArgTableRow>
<ArgTableRow arg="security.passphrase" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="security.multi-passphrase-group" typ="enum" unset="1"></ArgTableRow>
<ArgTableRow arg="security.disable-pmkid" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="security.management-protection" typ="enum (disabled | allowed | required)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.beacon-protection" typ="enum (disabled | enabled)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.management-encryption" typ="enum (cmac | gmac | cmac-256 | gmac-256)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.wps" typ="enum (disable | push-button)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.dh-groups" typ="ubit (19, 20, 21)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.sae-anti-clogging-threshold" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="security.sae-max-failure-rate" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="security.sae-pwe" typ="enum (hunting-and-pecking | hash-to-element | both)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.owe-transition-interface" typ="iface_enum { auto }" unset="1"></ArgTableRow>
<ArgTableRow arg="security.eap-methods" typ="multi { array-id, method: enum (tls | ttls | peap) { tls:13, ttls:21, peap:25 }
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="security.eap-certificate-mode" typ="enum (verify-certificate | dont-verify-certificate | no-certificates | verify-certificate-with-crl)" unset="1"></ArgTableRow>
<ArgTableRow arg="security.eap-tls-certificate" typ="enum" unset="1"></ArgTableRow>
<ArgTableRow arg="security.eap-username" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="security.eap-anonymous-identity" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="security.eap-password" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="security.eap-accounting" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="security.ft" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="security.ft-mobility-domain" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="security.ft-over-ds" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="security.ft-reassociation-deadline" typ="time" unset="1"></ArgTableRow>
<ArgTableRow arg="security.ft-nas-identifier" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="security.ft-r0-key-lifetime" typ="time" unset="1"></ArgTableRow>
<ArgTableRow arg="security.ft-preserve-vlanid" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="security.connect-group" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="security.connect-priority" typ="super { connect-accept-priority: num
, [connect-hold-priority] /num
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="security.authentication-types" typ="ubit (wpa-psk, wpa2-psk, wpa2-psk-sha2, wpa-eap, wpa2-eap, wpa3-psk, owe, wpa3-eap, wpa3-eap-192)" unset="1"></ArgTableRow>
<ArgTableRow arg="datapath.bridge" typ="iface_enum { none }" unset="1"></ArgTableRow>
<ArgTableRow arg="datapath.bridge-cost" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="datapath.bridge-horizon" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="datapath.openflow-switch" typ="enum" unset="1" syscap="openflow"></ArgTableRow>
<ArgTableRow arg="datapath.client-isolation" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="datapath.traffic-processing" typ="enum (on-cap | on-capsman | on-capsman-secure)" unset="1"></ArgTableRow>
<ArgTableRow arg="datapath.vlan-id" typ="num" unset="1"></ArgTableRow>
<ArgTableRow arg="datapath.interface-list" typ="enum" unset="1"></ArgTableRow>
</ArgTable>
