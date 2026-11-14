# ssh-keys

> RouterOS directory reference for /user/ssh-keys.

-----------

## user/ssh-keys 
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="user" typ="enum"></ArgTableRow>
<ArgTableRow arg="key" typ="string">only for adding new keys</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="key-type" typ="enum (rsa | ed25519 | ed25519-sk)"></ArgTableRow>
<ArgTableRow arg="bits" typ="num"></ArgTableRow>
<ArgTableRow arg="info" typ="string"></ArgTableRow>
<ArgTableRow arg="fingerprint" typ="string"></ArgTableRow>
</ArgTable>
