# settings

> RouterOS settings reference for /interface/ethernet/switch/qos/settings.

-----------

## interface/ethernet/switch/qos/settings 
**Syscap:** rbswitch and crs_prestera
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="multicast-buffers" typ="num">Maximum amount of packet buffers for multicast traffic (% of total buffer memory)</ArgTableRow>
<ArgTableRow arg="mirror-buffers" typ="num" syscap="!prestera-cpss">Maximum amount of packet buffers for mirrored traffic (% of total buffer memory)</ArgTableRow>
<ArgTableRow arg="mirror-profile" typ="enum">A QoS profile to apply to mirrored packets</ArgTableRow>
<ArgTableRow arg="shared-buffers" typ="num">Amount of packet buffers that are shared between ports (% of total buffer memory)</ArgTableRow>
<ArgTableRow arg="lossless-buffers" typ="num" syscap="!prestera-ac3">The size of the lossless shared pool (% of shared buffers)</ArgTableRow>
<ArgTableRow arg="lossless-traffic-class" typ="multi { array-id, tc: num [ .. 7]
 }" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="wred-threshold" typ="enum (low | medium | high) { low:1, medium:2, high:3 }" syscap="!prestera-ac3">A relative queue fill level to start a random tail drop or ECN marking</ArgTableRow>
</ArgTable>
