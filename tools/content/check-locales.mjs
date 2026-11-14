#!/usr/bin/env node
/**
 * `npm run locales:check` — assert that `locales.json` is a usable registry.
 *
 * The checks are the contract the rest of the repository relies on:
 *
 *   - `default` is `"en"` (the hub is the English site);
 *   - every locale's `baseUrl` starts and ends with `/`;
 *   - every locale's `repo` looks like `owner/name` and no two locales share
 *     one;
 *   - every locale's `site` is an absolute http(s) URL ending with its
 *     `baseUrl`;
 *   - locale keys are valid language tags and each entry has a label.
 *
 * Exit code 0 means the registry is valid. Nothing here touches the network.
 */

import localeRegistry from './locales.js';

function main() {
  let registry;
  try {
    registry = localeRegistry.readRegistry();
  } catch (error) {
    console.error(`[locales] ERROR ${error.message}`);
    return 1;
  }

  const errors = localeRegistry.validateRegistry(registry);
  if (errors.length > 0) {
    console.error(`[locales] ${errors.length} problem(s) in locales.json:`);
    for (const error of errors) console.error(`  - ${error}`);
    console.error(
      '[locales] Fix locales.json (see guides/ARCHITECTURE-MULTISITE.md) and run this check again.',
    );
    return 1;
  }

  const entries = Object.entries(registry.locales);
  const defaultEntry = registry.locales[registry.default];
  console.log(
    `[locales] OK: ${entries.length} locale(s), default "${registry.default}" ` +
      `(${defaultEntry.repo})`,
  );
  for (const [locale, entry] of entries) {
    const marker = locale === registry.default ? '*' : ' ';
    console.log(
      `[locales] ${marker} ${locale.padEnd(10)} ${entry.label.padEnd(12)} ` +
        `${entry.repo.padEnd(34)} ${entry.baseUrl.padEnd(30)} ${entry.site}`,
    );
  }
  console.log(
    '[locales] assertions: default is "en"; baseUrl starts and ends with "/"; ' +
      'repo is owner/name; site is absolute and ends with baseUrl',
  );
  return 0;
}

process.exitCode = main();
