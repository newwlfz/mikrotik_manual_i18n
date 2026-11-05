---
sidebar_key: "cli-reference/routing/bgp/session/clear"
sidebar_position: 1
title: "clear"
source: https://manual.mikrotik.com/docs/cli-reference/routing/bgp/session/clear
captured_at: '2026-11-01T21:29:27+08:00'
---

-----------

## routing/bgp/session/clear 
**Conditions:** !smips
**Type:** Command

Clear the session flags. For example, to be able to re-establish a session after the prefix limit is reached "limit-exceeded" flag must be cleared. It can be done by specifying `flag` parameter, which is able to take the following values:

* input-last-notification  
* limit-exceeded  
* output-last-notification  
* refused-cap-opt  
* stopped

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="flag" typ="enum (refused-cap-opt | stopped | limit-exceeded | input-last-notification | output-last-notification)">A flag to be cleared from BGP session.</ArgTableRow>
</ArgTable>
