---
sidebar_key: "cli-reference/interface/ethernet/switch/qos/port/index"
sidebar_position: 1
title: "port"
sidebar_label: 'port'
source: https://manual.mikrotik.com/docs/cli-reference/interface/ethernet/switch/qos/port
captured_at: '2026-11-01T21:27:16+08:00'
---

-----------

## interface/ethernet/switch/qos/port 
**Syscap:** rbswitch and crs_prestera
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="R" typ="running"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="profile" typ="enum" syscap="crs_prestera">QoS profile to assign to ingress packets by default</ArgTableRow>
<ArgTableRow arg="map" typ="enum" syscap="crs_prestera">QoS Packet-to-Profile mapping</ArgTableRow>
<ArgTableRow arg="trust-l2" typ="enum (ignore | trust | keep) { ignore:0, trust:1, keep:2 }" syscap="crs_prestera">Trust Layer 2 header (PCP) for QoS mapping</ArgTableRow>
<ArgTableRow arg="trust-l3" typ="enum (ignore | trust | keep) { ignore:0, trust:1, keep:2 }" syscap="crs_prestera">Trust Layer 3 header (DSCP) for QoS mapping</ArgTableRow>
<ArgTableRow arg="tx-manager" typ="enum" syscap="crs_prestera">QoS Tx Manager for egress traffic on this port</ArgTableRow>
<ArgTableRow arg="pfc" typ="enum" syscap="!prestera-ac3">Priority Flow Control profile for ingress traffic on this port</ArgTableRow>
<ArgTableRow arg="egress-rate-queue0" typ="num" syscap="switch-rate"></ArgTableRow>
<ArgTableRow arg="egress-rate-queue1" typ="num" syscap="switch-rate"></ArgTableRow>
<ArgTableRow arg="egress-rate-queue2" typ="num" syscap="switch-rate"></ArgTableRow>
<ArgTableRow arg="egress-rate-queue3" typ="num" syscap="switch-rate"></ArgTableRow>
<ArgTableRow arg="egress-rate-queue4" typ="num" syscap="switch-rate"></ArgTableRow>
<ArgTableRow arg="egress-rate-queue5" typ="num" syscap="switch-rate"></ArgTableRow>
<ArgTableRow arg="egress-rate-queue6" typ="num" syscap="switch-rate"></ArgTableRow>
<ArgTableRow arg="egress-rate-queue7" typ="num" syscap="switch-rate"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="switch" typ="enum"></ArgTableRow>
<ArgTableRow arg="tx-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-bytes" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue0-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue1-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue2-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue3-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue4-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue5-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue6-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue7-shared-packet-cap" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue0-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue1-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue2-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue3-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue4-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue5-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue6-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue7-shared-byte-cap" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue0-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue1-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue2-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue3-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue4-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue5-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue6-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue7-packet-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue0-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue1-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue2-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue3-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue4-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue5-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue6-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue7-byte-cap" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue0-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue1-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue2-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue3-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue4-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue5-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue6-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue7-packet-use" typ="num" syscap="!prestera-cpss"></ArgTableRow>
<ArgTableRow arg="queue0-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue1-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue2-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue3-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue4-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue5-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue6-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="queue7-byte-use" typ="num"></ArgTableRow>
<ArgTableRow arg="byte-max" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="queue0-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue1-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue2-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue3-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue4-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue5-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue6-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="queue7-byte-max" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc0-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc1-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc2-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc3-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc4-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc5-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc6-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc7-pause-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc0-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc1-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc2-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc3-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc4-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc5-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc6-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc7-resume-threshold" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc0-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc1-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc2-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc3-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc4-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc5-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc6-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc7-use" typ="num" syscap="!prestera-ac3"></ArgTableRow>
<ArgTableRow arg="pfc-paused-tc" typ="multi { array-id, tc: num
 }" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc-unknown" typ="multi { counter: num
 }" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc-rx" typ="multi { counter: num
 }" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="pfc-tx" typ="num" syscap="prestera-bc2"></ArgTableRow>
<ArgTableRow arg="rx-pause" typ="multi { counter: num
 }" syscap="prestera-cpss"></ArgTableRow>
<ArgTableRow arg="tx-pause" typ="multi { counter: num
 }" syscap="prestera-cpss"></ArgTableRow>
<ArgTableRow arg="tx-queue0-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue0-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue1-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue1-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue2-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue2-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue3-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue3-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue4-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue4-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue5-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue5-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue6-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue6-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue7-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-queue7-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue0-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue0-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue1-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue1-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue2-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue2-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue3-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue3-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue4-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue4-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue5-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue5-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue6-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue6-byte" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue7-packet" typ="multi { counter: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-drop-queue7-byte" typ="multi { counter: num
 }"></ArgTableRow>
</ArgTable>
