# clock

> RouterOS settings reference for /system/clock.

-----------

## system/clock 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="time" typ="date"></ArgTableRow>
<ArgTableRow arg="date" typ="date"></ArgTableRow>
<ArgTableRow arg="time-zone-autodetect" typ="bool"></ArgTableRow>
<ArgTableRow arg="time-zone-name" typ="enum"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="gmt-offset" typ="timezone"></ArgTableRow>
<ArgTableRow arg="dst-active" typ="bool"></ArgTableRow>
</ArgTable>
