# policy

> RouterOS directory reference for /ip/ipsec/policy.

-----------

## ip/ipsec/policy 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="T" typ="template">template</ArgTableRow>
<ArgTableRow arg="B" typ="backup">backup</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="A" typ="active">active</ArgTableRow>
<ArgTableRow arg="*" typ="default">default</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="peer" typ="multi { array-id, peer: enum
 }">auto activates peer establishes connection, use with shunt policy</ArgTableRow>
<ArgTableRow arg="tunnel" typ="bool"></ArgTableRow>
<ArgTableRow arg="group" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="src-address" typ="alt { prefix6: ip6Prefix
, prefix4: ipPrefix
 }"></ArgTableRow>
<ArgTableRow arg="src-port" typ="num"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="alt { prefix6: ip6Prefix
, prefix4: ipPrefix
 }"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="num"></ArgTableRow>
<ArgTableRow arg="protocol" typ="enum (all) { all:255 }"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (encrypt | discard | none) { encrypt:2, discard:0, none:1 }"></ArgTableRow>
<ArgTableRow arg="level" typ="enum (require | use | unique) { require:2, use:1, unique:3 }"></ArgTableRow>
<ArgTableRow arg="ipsec-protocols" typ="enum (ah | esp) { ah:1, esp:2 }">which ipsec protocol to use</ArgTableRow>
<ArgTableRow arg="sa-src-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }">endpoint address</ArgTableRow>
<ArgTableRow arg="sa-dst-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }">endpoint address</ArgTableRow>
<ArgTableRow arg="proposal" typ="enum"></ArgTableRow>
<ArgTableRow arg="template" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="ph2-count" typ="num"></ArgTableRow>
<ArgTableRow arg="ph2-state" typ="enum (spawning | starting | ready-to-send | getspi-sent | getspi-done | msg1-sent | ready-to-establish | commiting | adding-sa | established | expired | no-phase2) { spawning:0, starting:1, ready-to-send:2, getspi-sent:3, getspi-done:4, msg1-sent:5, ready-to-establish:6, commiting:7, adding-sa:8, established:9, expired:10, no-phase2:11 }"></ArgTableRow>
</ArgTable>
