---
sidebar_key: "cli-reference/user-manager/generate-report"
sidebar_position: 4
title: "generate-report"
sidebar_label: 'generate-report'
source: https://manual.mikrotik.com/docs/cli-reference/user-manager/generate-report
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## user-manager/generate-report 
**Package:** userman-5
**Type:** Command

Writes the sessions to a file in `um5files/PRIVATE/GENERATED/reports`, from a template.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="columns" typ="ubit (username, session-start, session-end, user-ip, calling-station-id, uptime, download, upload, acct-session-id, nas-ip-address, nas-port-type, nas-port-id, terminate-cause, nas-identifier)">Columns of the report: `username`, `session-start`, `session-end`, `user-ip`, `calling-station-id`, `uptime`, `download`, `upload`, `acct-session-id`, `nas-ip-address`, `nas-port-type`, `nas-port-id`, `terminate-cause`, `nas-identifier`.</ArgTableRow>
<ArgTableRow arg="report-template" typ="enum">Name of a template file in `um5files/PRIVATE/TEMPLATES/reports`, for example `report_default.html`.</ArgTableRow>
</ArgTable>
