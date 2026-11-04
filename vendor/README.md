# Vendor snapshots

Reference copies of official assets used to verify fidelity. They are not
blindly loaded by the application.

- `official/3.10.1/css/` — official stylesheets.
- `official/3.10.1/js/` — official runtime bundles, for inspection only.
- `official/3.10.1/static/` — logo, favicon, fonts, icons.
- `official/3.10.1/manifest.json` — source URL, bytes and SHA-256 per file.

Compiled official JavaScript is **not** injected into the Docusaurus build:
it embeds the official route/chunk map and content manifest. The same
Docusaurus version regenerates equivalent code locally.
