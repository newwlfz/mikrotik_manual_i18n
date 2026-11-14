---
sidebar_key: "cli-reference/interface/wireguard/wg-export"
sidebar_position: 2
title: "wg-export"
sidebar_label: 'wg-export'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wireguard/wg-export
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## interface/wireguard/wg-export 
**Type:** Command

Export the selected WireGuard interface and its peers in standard WireGuard configuration format. Select the interface with `[find name=...]`. The export does not include interface IP addresses, routes or firewall rules. For an executable RouterOS script, use the regular `/interface/wireguard/export` command. See [WireGuard](/docs/virtual-private-networks/wireguard).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="file" typ="file">Name of the file to export the selected WireGuard interface and its peers to. The file contains `[Interface]` and `[Peer]` sections and the private key; store it securely.</ArgTableRow>
</ArgTable>
