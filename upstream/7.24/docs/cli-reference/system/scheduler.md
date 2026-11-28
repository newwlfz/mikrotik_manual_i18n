# scheduler

> RouterOS directory reference for /system/scheduler.

-----------

## system/scheduler 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="start-date" typ="date"></ArgTableRow>
<ArgTableRow arg="start-time" typ="alt { startup: enum (startup) { startup:0xffffffff }
, time: date
 }"></ArgTableRow>
<ArgTableRow arg="days" typ="alt { day: enum (never | always) { never:0, always:127 }
, day: ubit (sun, mon, tue, wed, thu, fri, sat)
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="interval" typ="time"></ArgTableRow>
<ArgTableRow arg="on-event" typ="alt { script: string
 }"></ArgTableRow>
<ArgTableRow arg="policy" typ="multi { array-id, policy: enum
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="owner" typ="string"></ArgTableRow>
<ArgTableRow arg="run-count" typ="num"></ArgTableRow>
<ArgTableRow arg="next-run" typ="date"></ArgTableRow>
</ArgTable>
