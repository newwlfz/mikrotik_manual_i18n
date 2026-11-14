# import-ovpn-configuration

> RouterOS command reference for /interface/ovpn-client/import-ovpn-configuration.

-----------

## interface/ovpn-client/import-ovpn-configuration 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="file-name" typ="file">.ovpn client configuration file</ArgTableRow>
<ArgTableRow arg="skip-cert-import" typ="bool">Ignore certificate information in ovpn file in case these are added by user manualy</ArgTableRow>
<ArgTableRow arg="key-passphrase" typ="string"></ArgTableRow>
<ArgTableRow arg="ovpn-user" typ="string"></ArgTableRow>
<ArgTableRow arg="ovpn-password" typ="string"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="progress" typ="string"></ArgTableRow>
</ArgTable>
