---
sidebar_key: "cli-reference/ip/reverse-proxy"
sidebar_position: 18
title: "reverse-proxy"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/reverse-proxy
captured_at: '2026-11-01T21:24:23+08:00'
---

-----------

## ip/reverse-proxy 
**Conditions:** !smips
**Type:** Directory

Each rule forwards the HTTPS requests for one host name to an HTTP server. The reverse proxy accepts HTTPS connections on the port of the `reverse-proxy` service in [`/ip/service`](/docs/cli-reference/ip/service/), selects the rule whose `sni` matches the server name the client sends, terminates TLS with the certificate of that rule and forwards the requests as HTTP to `ip-address` and `port`. The service port is open only while at least one enabled rule exists. For an overview and examples, see [Reverse Proxy](/docs/network-management/proxy/reverse-proxy).

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">The rule is disabled. New rules are created enabled.</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">The rule was created by RouterOS for a container app with `use-https=yes` and a web interface (see [`/app`](/docs/cli-reference/app/)). Its `sni` is the host name of the app URL, and its certificate is the one set in `/app/settings`.</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="sni" typ="string" mandatory="1">Host name the rule serves. It is compared with the server name (SNI) the client sends in the TLS handshake and must match it exactly; a wildcard such as `*.example.com` matches nothing. The router closes a connection whose server name matches no rule, and the `rproxy` log shows `no matching rule for <name>`.</ArgTableRow>
<ArgTableRow arg="ip-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }" mandatory="1">IPv4 or IPv6 address of the server the requests are forwarded to. The router connects from its own address and forwards each request as HTTP/1.1. It keeps the `Host` header and adds `X-Forwarded-For` and `X-Real-Ip` with the address of the client, `X-Forwarded-Proto: https`, `X-Forwarded-Host` and `Forwarded`.</ArgTableRow>
<ArgTableRow arg="port" typ="num" mandatory="1">TCP port of the server. The router always connects with plain HTTP, also when the port is 443, so the server must accept HTTP on this port.</ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none)">Certificate the router presents to clients of this rule, for example one issued for the `sni` host name. With `none`, the certificate of the `reverse-proxy` service in [`/ip/service`](/docs/cli-reference/ip/service/) is used. When that is also `none`, the TLS handshake fails, and the `rproxy` log shows `certificate missing for rule <sni>`. Default: none.</ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
</ArgTable>
