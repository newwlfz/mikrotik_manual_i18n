# monitor

> RouterOS command reference for /interface/ethernet/switch/l3hw-settings/advanced/monitor.

-----------

## interface/ethernet/switch/l3hw-settings/advanced/monitor 
**Syscap:** rbswitch and crs_prestera
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="error-code" typ="num"></ArgTableRow>
<ArgTableRow arg="state" typ="enum (ok | stopping | starting | fib-failure | net-failure | switch-failure | fasttrack-failure | out-of-memory) { ok:0, stopping:1, starting:2, fib-failure:3, net-failure:4, switch-failure:5, fasttrack-failure:6, out-of-memory:0xFFFFFFF4 }"></ArgTableRow>
<ArgTableRow arg="ipv4-routes-total" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-routes-hw" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-routes-cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-shortest-hw-prefix" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv4-hosts" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-routes-total" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-routes-hw" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-routes-cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-shortest-hw-prefix" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-hosts" typ="num"></ArgTableRow>
<ArgTableRow arg="route-queue-size" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="route-queue-rate" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="route-process-rate" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="nexthop-cap" typ="num"></ArgTableRow>
<ArgTableRow arg="nexthop-usage" typ="num"></ArgTableRow>
<ArgTableRow arg="vxlan-mtu-packet-drop" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-ipv4-conns" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-queue-size" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-queue-rate" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-process-rate" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-hw-min-speed" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-hw-offloaded" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="fasttrack-hw-unloaded" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="lpm-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lpm-usage" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lpm-bank-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lpm-bank-usage" typ="multi { array-id, lpm-bank: num
 }" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pbr-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pbr-usage" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pbr-lpm-bank" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="nat-usage" typ="num" syscap="prestera-bc2"></ArgTableRow>
</ArgTable>
