---
sidebar_key: "cli-reference/interface/ethernet/switch/l3hw-settings/advanced/index"
sidebar_position: 1
title: "advanced"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/l3hw-settings/advanced
captured_at: '2026-11-01T21:27:12+08:00'
---

-----------

## interface/ethernet/switch/l3hw-settings/advanced 
**Syscap:** rbswitch and crs_prestera
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="route-queue-limit-high" typ="num" syscap="!prestera-cpss">Disable indexing if the number of routes in queue exceeds this value</ArgTableRow>
<ArgTableRow arg="route-queue-limit-low" typ="num" syscap="!prestera-cpss">Re-enable indexing if the number of routes in queue drops down to this value</ArgTableRow>
<ArgTableRow arg="shwp-reset-counter" typ="num">Reset the Shortest HW Prefix and try the full route table offloading after this amount of changes in the routing table</ArgTableRow>
<ArgTableRow arg="partial-offload-chunk" typ="num" syscap="prestera-bc2">Minimum number of routes for incremental adding in partial offloading</ArgTableRow>
<ArgTableRow arg="route-index-delay-min" typ="time" syscap="!prestera-cpss">Minimum time between route processing and table indexing</ArgTableRow>
<ArgTableRow arg="route-index-delay-max" typ="time">Maximum time between route processing and table indexing</ArgTableRow>
<ArgTableRow arg="neigh-keepalive-interval" typ="time" syscap="!prestera-cpss">The interval between keeping alive hw-offloaded neighbors (hosts)</ArgTableRow>
<ArgTableRow arg="neigh-discovery-interval" typ="time" syscap="!prestera-cpss">The interval between sending ARP/ND requests to check availability of hw-offloaded neighbors</ArgTableRow>
<ArgTableRow arg="neigh-discovery-burst-limit" typ="num" syscap="!prestera-cpss">Limits the amount or ARP/ND requests that can be sent at once</ArgTableRow>
<ArgTableRow arg="neigh-discovery-burst-delay" typ="time" syscap="!prestera-cpss">The interval between ARP/ND request bursts</ArgTableRow>
<ArgTableRow arg="neigh-dump-retries" typ="num" syscap="!prestera-cpss">The maximum retry count to offload a neighbor table in case of failure</ArgTableRow>
</ArgTable>
