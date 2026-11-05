---
sidebar_key: "cli-reference/interface/ethernet/switch/qos/monitor"
sidebar_position: 3
title: "monitor"
description: 'RouterOS command reference for /interface/ethernet/switch/qos/monitor.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/qos/monitor
captured_at: '2026-11-01T21:27:16+08:00'
---

-----------

## interface/ethernet/switch/qos/monitor 
**Syscap:** rbswitch and crs_prestera
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="total-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="total-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="total-byte-cap" typ="num"></ArgTableRow>
<ArgTableRow arg="total-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="multicast-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="multicast-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="multicast-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="multicast-byte-use" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="mirror-ingress-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="mirror-ingress-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="mirror-ingress-byte-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="mirror-ingress-byte-use" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="mirror-egress-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="mirror-egress-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="mirror-egress-byte-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="mirror-egress-byte-use" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="shared-packet-cap" typ="num" syscap="prestera-ac3"></ArgTableRow>
<ArgTableRow arg="shared-packet-use" typ="num" syscap="prestera-ac3"></ArgTableRow>
<ArgTableRow arg="shared-byte-cap" typ="num" syscap="prestera-ac3"></ArgTableRow>
<ArgTableRow arg="shared-byte-use" typ="num" syscap="prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lossy-pool-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="lossy-pool-packet-use" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="lossless-pool-packet-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lossless-pool-packet-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lossy-pool-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lossy-pool-byte-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lossless-pool-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="lossless-pool-byte-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="wred-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="wred-byte-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
</ArgTable>
