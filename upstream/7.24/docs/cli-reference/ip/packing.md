# packing

> RouterOS directory reference for /ip/packing.

-----------

## ip/packing 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="packing" typ="enum (none | simple | compress-headers | compress-all) { none:0x00, simple:0x01, compress-headers:0x03, compress-all:0x07 }"></ArgTableRow>
<ArgTableRow arg="unpacking" typ="enum (none | simple | compress-headers | compress-all) { none:0x00, simple:0x01, compress-headers:0x03, compress-all:0x07 }"></ArgTableRow>
<ArgTableRow arg="aggregated-size" typ="num"></ArgTableRow>
</ArgTable>
