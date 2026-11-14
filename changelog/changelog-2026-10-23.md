---
title: "Documentation updates - October 23, 2026"
date: 2026-10-23T00:00:00.000Z
slug: /changelog-2026-10-23
---

# Documentation updates - October 23, 2026

October 23, 2026

Summary of documentation changes made on October 23, 2026.

## Authentication & AAA[​](#authentication--aaa "Direct link to Authentication & AAA")

-   **[Certificates](/docs/authentication-authorization-accounting/certificates)**, **[User](/docs/authentication-authorization-accounting/user)**: Certificates and SSH keys with a weak RSA public exponent (7 or lower) keep working, but are flagged with the comment `key uses insecure RSA public exponent!` in the `/certificate/print`, `/user/ssh-keys` and `/user/ssh-keys/private` output. Replace them with stronger keys. Also added to the 7.25 manual.

## Management Tools[​](#management-tools "Direct link to Management Tools")

-   **[SSH](/docs/management-tools/ssh)**: An RSA host key with a weak public exponent is regenerated automatically and the event is logged (`host key uses insecure RSA public exponent! Host key will be regenerated!`). After any regeneration, clients that pinned the old key report a fingerprint mismatch. Also added to the 7.25 manual.

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
