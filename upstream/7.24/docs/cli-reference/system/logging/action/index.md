# action

> RouterOS directory reference for /system/logging/action.

-----------

## system/logging/action 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default"></ArgTableRow>
<ArgTableRow arg="Y" typ="managed"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="target" typ="enum (memory | disk | echo | remote | email | script) { memory:0, disk:1, echo:2, remote:3, email:4, script:5 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="memory-lines" typ="num"></ArgTableRow>
<ArgTableRow arg="memory-stop-on-full" typ="bool"></ArgTableRow>
<ArgTableRow arg="disk-file-name" typ="string"></ArgTableRow>
<ArgTableRow arg="disk-lines-per-file" typ="num"></ArgTableRow>
<ArgTableRow arg="disk-file-count" typ="num"></ArgTableRow>
<ArgTableRow arg="disk-stop-on-full" typ="bool"></ArgTableRow>
<ArgTableRow arg="remote" typ="alt { ipv6: ip6Addr
, ip: ipAddr
, hostname: string
 }"></ArgTableRow>
<ArgTableRow arg="remote-port" typ="num"></ArgTableRow>
<ArgTableRow arg="src-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="remote-log-format" typ="enum (default | syslog | cef)"></ArgTableRow>
<ArgTableRow arg="remote-protocol" typ="enum (udp | tcp | tls)"></ArgTableRow>
<ArgTableRow arg="check-certificate" typ="bool"></ArgTableRow>
<ArgTableRow arg="cef-event-delimiter" typ="string"></ArgTableRow>
<ArgTableRow arg="syslog-time-format" typ="enum (bsd-syslog | iso8601)"></ArgTableRow>
<ArgTableRow arg="syslog-facility" typ="enum (kern | user | mail | daemon | auth | syslog | lpr | news | uucp | cron | authpriv | ftp | ntp | local0 | local1 | local2 | local3 | local4 | local5 | local6 | local7) { kern:0, user:1, mail:2, daemon:3, auth:4, syslog:5, lpr:6, news:7, uucp:8, cron:9, authpriv:10, ftp:11, ntp:12, local0:16, local1:17, local2:18, local3:19, local4:20, local5:21, local6:22, local7:23 }"></ArgTableRow>
<ArgTableRow arg="syslog-severity" typ="enum (auto | emergency | alert | critical | error | warning | notice | info | debug) { auto:0xffffffff, emergency:0, alert:1, critical:2, error:3, warning:4, notice:5, info:6, debug:7 }"></ArgTableRow>
<ArgTableRow arg="email-to" typ="string"></ArgTableRow>
<ArgTableRow arg="email-cc" typ="multi { array-id, cc: string
 }"></ArgTableRow>
<ArgTableRow arg="email-start-tls" typ="bool"></ArgTableRow>
<ArgTableRow arg="remember" typ="bool"></ArgTableRow>
<ArgTableRow arg="add-topics-string" typ="bool"></ArgTableRow>
<ArgTableRow arg="script" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum ()"></ArgTableRow>
</ArgTable>
