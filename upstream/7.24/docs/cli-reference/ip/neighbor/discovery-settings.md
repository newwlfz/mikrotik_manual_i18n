# discovery-settings

> RouterOS settings reference for /ip/neighbor/discovery-settings.

-----------

## ip/neighbor/discovery-settings 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="discover-interface-list" typ="super { !
, discover-interface-list: enum
 }"></ArgTableRow>
<ArgTableRow arg="discover-interval" typ="time"></ArgTableRow>
<ArgTableRow arg="lldp-med" typ="bool"></ArgTableRow>
<ArgTableRow arg="lldp-med-net-policy-vlan" typ="alt { constant: enum (disabled)
, vlan-id: num [ .. 4094]
 }"></ArgTableRow>
<ArgTableRow arg="lldp-mac-phy-config" typ="bool"></ArgTableRow>
<ArgTableRow arg="lldp-max-frame-size" typ="bool"></ArgTableRow>
<ArgTableRow arg="lldp-vlan-info" typ="bool"></ArgTableRow>
<ArgTableRow arg="lldp-poe-power" typ="bool" syscap="poe"></ArgTableRow>
<ArgTableRow arg="lldp-poe-in-power" typ="bool" syscap="poe-in"></ArgTableRow>
<ArgTableRow arg="lldp-dcbx" typ="bool" syscap="crs_prestera"></ArgTableRow>
<ArgTableRow arg="protocol" typ="ubit (cdp, lldp, mndp)"></ArgTableRow>
<ArgTableRow arg="mode" typ="enum (tx-and-rx | tx-only | rx-only)"></ArgTableRow>
<ArgTableRow arg="dying-gasp" typ="bool"></ArgTableRow>
<ArgTableRow arg="add-dns-entries" typ="bool"></ArgTableRow>
<ArgTableRow arg="add-dns-entries-suffix" typ="string"></ArgTableRow>
</ArgTable>
