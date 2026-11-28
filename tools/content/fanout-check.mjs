#!/usr/bin/env node
/**
 * `fanout-check` — cross-repository consistency assertion for the hub fan-out.
 *
 * The hub is the single source of truth. This script proves, without network
 * access and without reading any credential, that the fan-out actually landed
 * in every checkout:
 *
 *   1. `locales.json` **key fields** (`default` plus every locale's `repo`,
 *      `baseUrl`, `site`, `available`) agree in hub / zh-Hans / zh-Hant;
 *      `tagline`, `label` and `siteTitle` are intentionally localized per site,
 *      so whole-file sha256 equality is the wrong assertion here;
 *   2. `sidebars-hardware.ts` sha256 is identical in all three (the 13-class
 *      Quick Guides structure);
 *   3. every `build/index.html` `docusaurus-available-locales` meta matches the
 *      available locales derived from that repository's own `locales.json`;
 *   4. every entry of the shared EXPECTED_SYNC_LIST exists in every checkout.
 *
 * Any mismatch exits 1 and prints the exact paths / sha256 values. A stale
 * build meta is a real failure: it means the registry flipped but that site
 * was not rebuilt yet. The rebuild itself belongs to the next pipeline stage
 * (see guides/FANOUT.md); this assertion is what detects the gap.
 *
 * Usage:
 *   node tools/content/fanout-check.mjs            # --check, human report
 *   node tools/content/fanout-check.mjs --check    # same, explicit
 *   node tools/content/fanout-check.mjs --json     # machine-readable report
 *   node tools/content/fanout-check.mjs --repos-root=/path/to/siblings
 *
 * Exit codes: 0 = all assertions pass; 1 = drift / unreadable input.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {collectFanout, REGISTRY_FILE} from './sync-contract.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Registry fields that must agree across all three checkouts. `tagline`,
 * `label` and `siteTitle` are localisation products: each site renders its own
 * language, so their bytes are expected to differ. `available` follows the
 * registry semantics (absent === true), so a missing key normalises to true.
 */
export const REGISTRY_KEY_FIELDS = Object.freeze([
  'repo',
  'baseUrl',
  'site',
  'available',
]);

/** Deterministic signature of the registry's key fields only (null if unreadable). */
export function registryKeySignature(file) {
  if (!fs.existsSync(file)) return null;
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!registry || typeof registry !== 'object' || !registry.locales ||
      typeof registry.locales !== 'object') return null;
  const locales = {};
  for (const tag of Object.keys(registry.locales).sort()) {
    const entry = registry.locales[tag] || {};
    const selected = {};
    for (const field of REGISTRY_KEY_FIELDS) {
      selected[field] = field === 'available' && entry[field] === undefined
        ? true
        : entry[field];
    }
    locales[tag] = selected;
  }
  const canonical = {default: registry.default, locales};
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * `collectFanout()` asserts whole-file sha256 for every BYTE_IDENTICAL_ENTRIES
 * member, including the registry. Replace that one identity item with a
 * key-fields comparison and keep every other count / rebuild reason consistent.
 * Nothing outside this file is modified; the shared contract stays untouched.
 */
function useRegistryKeyIdentity(report) {
  const item = report.identity.find((entry) => entry.entry === REGISTRY_FILE);
  if (!item) return report;

  const shaByLocale = {};
  for (const repo of report.repositories) {
    shaByLocale[repo.locale] = registryKeySignature(path.join(repo.path, REGISTRY_FILE));
  }
  const hubSha = report.hub ? shaByLocale[report.hub.locale] : null;
  const diffs = report.repositories
    .filter((repo) => !repo.isDefault && shaByLocale[repo.locale] !== hubSha)
    .map((repo) => ({
      locale: repo.locale,
      repo: repo.repo,
      hubSha,
      sha256: shaByLocale[repo.locale],
    }));
  item.hubSha = hubSha;
  item.shaByLocale = shaByLocale;
  item.diffs = diffs;
  item.equal = hubSha !== null && diffs.length === 0;
  item.keyFieldsOnly = true;
  item.keyFields = ['default', ...REGISTRY_KEY_FIELDS];

  report.contract.keyIdentical = [REGISTRY_FILE];
  report.contract.registryKeyFields = item.keyFields;
  report.contract.byteIdentical = report.contract.byteIdentical.filter(
    (entry) => entry !== REGISTRY_FILE,
  );
  report.counts.byteIdenticalEntries = report.contract.byteIdentical.length;
  report.counts.identityMismatches = report.identity.reduce(
    (total, entry) => total + entry.diffs.length, 0,
  ) + (hubSha === null && report.hub ? 1 : 0);

  // Drop only the registry-identity rebuild reason for repos that now match.
  const matched = new Set(
    hubSha === null
      ? []
      : report.repositories
        .filter((repo) => !diffs.some((diff) => diff.locale === repo.locale))
        .map((repo) => repo.locale),
  );
  report.rebuild = report.rebuild
    .map((target) => ({
      ...target,
      reasons: target.reasons.filter(
        (reason) => !(reason === `${REGISTRY_FILE} 与 hub 不一致` && matched.has(target.locale)),
      ),
    }))
    .filter((target) => target.reasons.length > 0);
  report.counts.rebuildTargets = report.rebuild.length;
  report.ok =
    report.registry.errors.length === 0 &&
    report.identity.every((entry) => entry.equal) &&
    report.presence.length === 0 &&
    report.buildMeta.every((entry) => entry.equal) &&
    report.rebuild.length === 0;
  return report;
}

function parseArgs(argv) {
  const options = {format: 'check', reposRoot: path.dirname(HUB), help: false};
  for (const arg of argv) {
    if (arg === '--check') options.format = 'check';
    else if (arg === '--json') options.format = 'json';
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--repos-root=')) {
      const value = arg.slice('--repos-root='.length).trim();
      if (!value) throw new Error('--repos-root needs a directory');
      options.reposRoot = path.resolve(value);
    } else throw new Error(`unknown argument: ${arg} (try --help)`);
  }
  return options;
}

function usage() {
  return [
    'usage: node tools/content/fanout-check.mjs [--check|--json] [--repos-root=<dir>]',
    '',
    'Assert hub -> locale fan-out across the three sibling checkouts:',
    '  - locales.json key fields (default/repo/baseUrl/site/available) equality;',
    '    tagline/label/siteTitle may be localized per repository',
    '  - sidebars-hardware.ts / hub-docs sha256 equality',
    '  - build meta available-locales == locales.json derivation, per repo',
    '  - presence of all EXPECTED_SYNC_LIST entries',
    '',
    '  --json          emit the full report as JSON (exit code is unchanged)',
    '  --repos-root=…  parent directory of the three checkouts (default: hub parent)',
  ].join('\n');
}

const short = (sha) => (sha ? sha.slice(0, 16) : '(missing)');

function printReport(report) {
  const line = (text = '') => console.log(text);
  line('fanout-check  hub -> locale-repos  (cross-repo consistency)');
  line();
  line(
    `  contract        ${report.contract.expectedSyncList.length} expected entries ` +
      `(${report.contract.contentRoots.length} content roots + ${report.contract.registryFile}); ` +
      `${report.contract.byteIdentical.length} byte-identical` +
      (report.contract.keyIdentical?.length
        ? ` + ${report.contract.keyIdentical.length} key-field-identical (${(report.contract.registryKeyFields || []).join(',')})`
        : ''),
  );
  line(`  hub             ${report.hub ? `${report.hub.locale} -> ${report.hub.repo}` : '(missing)'}`);
  line(`  registry sha256 ${short(report.registry.sha256)}  available=${JSON.stringify(report.registry.available)}`);
  if (report.registry.errors.length) {
    line(`  registry errors ${report.registry.errors.length}:`);
    for (const error of report.registry.errors) line(`    - ${error}`);
  }
  line();

  line('repositories:');
  for (const repo of report.repositories) {
    line(
      `  ${repo.isDefault ? '*' : ' '} ${repo.locale.padEnd(8)} ${repo.repo}  ` +
        `registry=${short(repo.registrySha)}  available=${JSON.stringify(repo.available)}`,
    );
  }
  line();

  line('identity (must match the hub):');
  for (const item of report.identity) {
    line(
      `  ${item.equal ? 'PASS' : 'FAIL'} ${item.entry}${item.keyFieldsOnly ? ' [key fields only]' : ''}  ` +
        `hub=${short(item.hubSha)}`,
    );
    if (!item.equal) {
      for (const diff of item.diffs) {
        line(
          `        ${diff.locale} (${diff.repo}): ${short(diff.sha256)}` +
            (diff.sha256 === null ? '  <- file missing' : ''),
        );
      }
    }
  }
  if (report.contract.keyIdentical?.length) {
    line(
      '  note: locales.json sha is a key-fields signature; tagline/label/siteTitle ' +
        'are localised and intentionally ignored',
    );
  }
  line();

  line('expected sync list presence:');
  if (report.presence.length === 0) {
    line(`  PASS all ${report.counts.repositories} repo(s) have all ${report.counts.expectedSyncEntries} entries`);
  } else {
    for (const item of report.presence) line(`  FAIL ${item.locale}: missing ${item.entry}`);
  }
  line();

  line('build meta (docusaurus-available-locales):');
  for (const item of report.buildMeta) {
    line(`  ${item.equal ? 'PASS' : 'FAIL'} ${item.locale}  expected=${JSON.stringify(item.expected)}  actual=${JSON.stringify(item.actual)}  ${item.file}`);
  }
  line();

  line(`需重建 (${report.rebuild.length}):`);
  if (report.rebuild.length === 0) line('  (none)');
  for (const item of report.rebuild) {
    line(`  - ${item.locale} -> ${item.repo}`);
    for (const reason of item.reasons) line(`      ${reason}`);
  }
  line();
  line(
    `fanout-check: ${report.ok ? 'PASS' : 'FAIL'}  ` +
      `identity=${report.counts.identityMismatches} presence=${report.counts.presenceFailures} ` +
      `buildMeta=${report.counts.buildMetaMismatches} rebuild=${report.counts.rebuildTargets}`,
  );
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`fanout-check: ERROR ${error.message}`);
  process.exitCode = 1;
}

if (options) {
  if (options.help) {
    console.log(usage());
  } else {
    let report;
    try {
      report = useRegistryKeyIdentity(collectFanout({hubPath: HUB, reposRoot: options.reposRoot}));
    } catch (error) {
      console.error(`fanout-check: ERROR ${error.message}`);
      process.exitCode = 1;
    }
    if (report) {
      if (options.format === 'json') console.log(JSON.stringify(report, null, 2));
      else printReport(report);
      if (!report.ok) process.exitCode = 1;
    }
  }
}
