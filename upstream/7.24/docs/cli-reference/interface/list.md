# list

> RouterOS directory reference for /interface/list.

-----------

## interface/list 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="builtin">builtin</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="include" typ="multi { include-list: enum
 }"></ArgTableRow>
<ArgTableRow arg="exclude" typ="multi { exclude-list: enum
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="dynamic" typ="bool"></ArgTableRow>
</ArgTable>
