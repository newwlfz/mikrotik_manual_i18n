---
sidebar_key: "cli-reference/tr069-client/index"
sidebar_position: 1
title: "tr069-client"
description: 'RouterOS settings reference for /tr069-client.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tr069-client
captured_at: '2026-11-01T21:30:27+08:00'
---

-----------

## tr069-client 
**Package:** tr069-client
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="enum (yes | no)"></ArgTableRow>
<ArgTableRow arg="acs-url" typ="string"></ArgTableRow>
<ArgTableRow arg="username" typ="string"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
<ArgTableRow arg="periodic-inform-enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="periodic-inform-interval" typ="time"></ArgTableRow>
<ArgTableRow arg="connection-request-username" typ="string"></ArgTableRow>
<ArgTableRow arg="connection-request-password" typ="string"></ArgTableRow>
<ArgTableRow arg="connection-request-port" typ="num"></ArgTableRow>
<ArgTableRow arg="provisioning-code" typ="string"></ArgTableRow>
<ArgTableRow arg="client-certificate" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="check-certificate" typ="enum (yes | no)"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="enum (disabled | initializing | error | waiting-url | running)"></ArgTableRow>
<ArgTableRow arg="last-session-error" typ="string"></ArgTableRow>
<ArgTableRow arg="retry-count" typ="num"></ArgTableRow>
</ArgTable>
