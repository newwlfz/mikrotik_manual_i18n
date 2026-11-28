# bandwidth-test

> RouterOS command reference for /tool/bandwidth-test.

-----------

## tool/bandwidth-test 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="address (flags=46viD)"></ArgTableRow>
<ArgTableRow arg="protocol" typ="enum (udp | tcp) { udp:0, tcp:1 }"></ArgTableRow>
<ArgTableRow arg="local-udp-tx-size" typ="range"></ArgTableRow>
<ArgTableRow arg="remote-udp-tx-size" typ="range"></ArgTableRow>
<ArgTableRow arg="direction" typ="enum (receive | transmit | both) { receive:0x00000100, transmit:0x00000200, both:0x00000300 }"></ArgTableRow>
<ArgTableRow arg="connection-count" typ="num"></ArgTableRow>
<ArgTableRow arg="local-tx-speed" typ="num"></ArgTableRow>
<ArgTableRow arg="remote-tx-speed" typ="num"></ArgTableRow>
<ArgTableRow arg="user" typ="string"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
<ArgTableRow arg="duration" typ="time"></ArgTableRow>
<ArgTableRow arg="random-data" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="enum (connecting | can not start test | can not connect | remote is busy | test unsupported | running | disconnected | authentication failed | done testing) { connecting:0, can not start test:1, can not connect:2, remote is busy:3, test unsupported:4, running:5, disconnected:6, authentication failed:7, done testing:8 }"></ArgTableRow>
<ArgTableRow arg="duration" typ="time"></ArgTableRow>
<ArgTableRow arg="tx-current" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-10-second-average" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-total-average" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-current" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-10-second-average" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-total-average" typ="num"></ArgTableRow>
<ArgTableRow arg="lost-packets" typ="num"></ArgTableRow>
<ArgTableRow arg="random-data" typ="bool"></ArgTableRow>
<ArgTableRow arg="direction" typ="enum (receive | transmit | both) { receive:0x00000100, transmit:0x00000200, both:0x00000300 }"></ArgTableRow>
<ArgTableRow arg="tx-size" typ="range"></ArgTableRow>
<ArgTableRow arg="rx-size" typ="range"></ArgTableRow>
<ArgTableRow arg="connection-count" typ="num"></ArgTableRow>
<ArgTableRow arg="local-cpu-load" typ="num"></ArgTableRow>
<ArgTableRow arg="remote-cpu-load" typ="num"></ArgTableRow>
<ArgTableRow arg="tcp-info" typ="multi { name: string
 }"></ArgTableRow>
</ArgTable>
