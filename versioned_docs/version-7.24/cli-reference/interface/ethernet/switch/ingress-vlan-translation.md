---
sidebar_key: "cli-reference/interface/ethernet/switch/ingress-vlan-translation"
sidebar_position: 9
title: "ingress-vlan-translation"
sidebar_label: 'ingress-vlan-translation'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/ingress-vlan-translation
captured_at: '2026-11-01T21:27:12+08:00'
---

-----------

## interface/ethernet/switch/ingress-vlan-translation 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="protocol" typ="alt { protocol-name: enum (length | llc-bpdu) { length:1, llc-bpdu:0x4242 }
, protocol-number: num [ .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="sa-learning" typ="bool"></ArgTableRow>
<ArgTableRow arg="ports" typ="multi { array-id }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="service-vlan-format" typ="enum (untagged-or-tagged | priority-tagged-or-tagged | tagged | any) { untagged-or-tagged:0, priority-tagged-or-tagged:1, tagged:2, any:3 }"></ArgTableRow>
<ArgTableRow arg="service-vid" typ="num"></ArgTableRow>
<ArgTableRow arg="service-pcp" typ="num"></ArgTableRow>
<ArgTableRow arg="service-dei" typ="num"></ArgTableRow>
<ArgTableRow arg="customer-vlan-format" typ="enum (untagged-or-tagged | priority-tagged-or-tagged | tagged | any) { untagged-or-tagged:0, priority-tagged-or-tagged:1, tagged:2, any:3 }"></ArgTableRow>
<ArgTableRow arg="customer-vid" typ="num"></ArgTableRow>
<ArgTableRow arg="customer-pcp" typ="num"></ArgTableRow>
<ArgTableRow arg="customer-dei" typ="num"></ArgTableRow>
<ArgTableRow arg="new-service-vid" typ="alt { special-vid: enum (customer-vid) { customer-vid:4096 }
, vid: num [ .. 4095]
 }"></ArgTableRow>
<ArgTableRow arg="new-customer-vid" typ="alt { special-vid: enum (service-vid) { service-vid:4096 }
, vid: num [ .. 4095]
 }"></ArgTableRow>
<ArgTableRow arg="pcp-propagation" typ="bool"></ArgTableRow>
<ArgTableRow arg="swap-vids" typ="enum (no | assign-cvid-to-svid) { no:0, assign-cvid-to-svid:0 }"></ArgTableRow>
</ArgTable>
