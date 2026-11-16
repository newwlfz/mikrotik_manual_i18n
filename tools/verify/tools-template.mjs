#!/usr/bin/env node
/**
 * `npm run check:tools-template` — report how this repository's `tools/` tree
 * differs from the canonical copy in `templates/locale-repo/tools/`.
 *
 * The template is the single authoritative copy of the *shared* toolchain: a new
 * locale repository is scaffolded from it (`npm run locale:add`), and the hub
 * keeps only the files its own build/verify/sync tools import. Since the two
 * trees are separate copies on disk, nothing stops them from drifting — this
 * check is the tripwire, and it only reports: it never rewrites a file.
 *
 * Three kinds of difference are possible:
 *
 *   - `diff`          both trees have the file, the bytes differ;
 *   - `hub-only`      the hub has a file the template does not (hub-only tools);
 *   - `template-only` the template has a file the hub does not. This is the
 *                     normal state of the world: the template carries the whole
 *                     locale toolchain, the hub carries the shared subset.
 *
 * `diff` and `hub-only` must be listed in `WHITELIST` with a reason, otherwise
 * the command exits 1. `template-only` is informational — losing a hub file is
 * caught by the importer that needs it, not here.
 *
 * Usage:
 *   npm run check:tools-template            # summary + every non-identical entry
 *   npm run check:tools-template -- --list-template-only
 *   npm run check:tools-template -- --json
 *
 * Exit codes: 0 only whitelisted differences, 1 unexpected difference.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HUB = path.join(REPO, 'tools');
const TEMPLATE = path.join(REPO, 'templates/locale-repo/tools');
const IGNORED = new Set(['node_modules', '.DS_Store']);

/**
 * Differences this repository and the template are *expected* to have.
 *
 * Every entry is either an exact repo-relative path (`tools/...` form) or a
 * directory prefix ending in `/`. `reason` is printed with the difference, so
 * the whitelist is also the record of why the two trees diverge.
 */
const WHITELIST = [
  // The hub is the English source repository; the template scaffolds a locale
  // repository. Their `tools/README.md` and content-registry helpers therefore
  // legitimately document / provide different things.
  {path: 'tools/README.md', reason: 'hub README documents the split; the template README documents a locale repo'},
  {
    path: 'tools/content/',
    reason:
      'hub-only: locale scaffolding and publishing (locale:add, locales:check, content:publish) plus the template sync (sync:tools); the template only fetches content',
  },
  {path: 'tools/verify/tools-template.mjs', reason: 'hub-only: this check compares the hub against the template'},

  // Hub-side fixes that have not been backported to the template yet. Keeping
  // them visible here is deliberate: the entry disappears when the fix lands in
  // the template.
  {
    path: 'tools/build/slim.mjs',
    reason: 'hub resolves the locale list through tools/lib/site-config.mjs (locales.json), the template parses docusaurus.config.ts',
  },
  {
    path: 'tools/verify/asset-refs.mjs',
    reason: 'same locale resolution change as build/slim.mjs',
  },
  {
    path: 'tools/verify/base-url-refs.mjs',
    reason: 'hub reports the base URL source from site-config, the template still maps it to docusaurus.config.ts',
  },
  {
    path: 'tools/sync/cache-structure.mjs',
    reason: 'hub tolerates a page materialize has not written yet (stage order on a fresh release)',
  },
  {
    path: 'tools/sync/fetch-assets.mjs',
    reason: 'hub recovers images the official site inlined as data: URIs',
  },
  {
    path: 'tools/sync/fetch-upstream.mjs',
    reason: 'hub probes the stored corpus ETag and repairs missing local files',
  },
  {
    path: 'tools/sync/lib/upstream.mjs',
    reason: 'hub carries the corpus-probe helpers used by sync/fetch-upstream.mjs and sync/index.mjs',
  },
  {
    path: 'tools/sync/lib/rendered-images.mjs',
    reason: 'hub-only rendered-image helper (behind npm run test:sync-assets), not backported to the template',
  },
  {
    path: 'tools/sync/lib/rendered-images.test.mjs',
    reason: 'hub-only: the test for tools/sync/lib/rendered-images.mjs',
  },

  // The translation split this repository was refactored for.
  {
    path: 'tools/sync/index.mjs',
    reason: 'hub rejects --with-translation; overlay derivation belongs to the locale repository',
  },
  {
    path: 'tools/pipeline/verify.mjs',
    reason: 'hub has no translate:selftest / translate:verify steps',
  },
  {
    path: 'tools/verify/browser-check.mjs',
    reason:
      'the hub no longer ships the one-shot provenance backfill script, so its footer check no longer names it; the template and the locale repositories still carry the script and keep the pointer',
  },
];

const matches = (rel, entry) =>
  entry.path.endsWith('/') ? rel.startsWith(entry.path) : rel === entry.path;

function whitelistEntry(rel) {
  return WHITELIST.find((entry) => matches(rel, entry)) || null;
}

/** Paths of every file under `dir`, relative to `base`. */
function walk(dir, base, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const json = process.argv.includes('--json');
const listTemplateOnly = process.argv.includes('--list-template-only');

if (!fs.existsSync(TEMPLATE)) {
  console.error(`check:tools-template: template not found at ${path.relative(REPO, TEMPLATE)}`);
  process.exit(1);
}

// Both sides are keyed by the hub-relative `tools/...` path, so the whitelist
// and the output never depend on which tree a row came from.
const hubFiles = walk(HUB, REPO).sort();
const templateFiles = new Set(walk(TEMPLATE, TEMPLATE).map((rel) => path.join('tools', rel)));
const hubSet = new Set(hubFiles);

const identical = [];
const allowed = [];
const unexpected = [];
const templateOnly = [...templateFiles].filter((rel) => !hubSet.has(rel)).sort();

for (const rel of hubFiles) {
  if (!templateFiles.has(rel)) {
    const entry = whitelistEntry(rel);
    (entry ? allowed : unexpected).push({
      kind: 'hub-only',
      path: rel,
      reason: entry ? entry.reason : 'the hub has no counterpart in the template',
    });
    continue;
  }
  const hubFile = path.join(REPO, rel);
  const templateFile = path.join(TEMPLATE, path.relative(HUB, hubFile));
  if (digest(hubFile) === digest(templateFile)) {    identical.push(rel);
    continue;
  }
  const entry = whitelistEntry(rel);
  (entry ? allowed : unexpected).push({
    kind: 'diff',
    path: rel,
    reason: entry ? entry.reason : 'bytes differ and the file is not whitelisted',
  });
}

if (json) {
  console.log(
    JSON.stringify(
      {
        hub: 'tools',
        template: 'templates/locale-repo/tools',
        identical: identical.length,
        allowed,
        unexpected,
        template_only: {count: templateOnly.length, files: listTemplateOnly ? templateOnly : undefined},
        ok: unexpected.length === 0,
      },
      null,
      2,
    ),
  );
  process.exit(unexpected.length ? 1 : 0);
}

const line = (text = '') => console.log(text);
line(`check:tools-template  hub=tools  template=templates/locale-repo/tools`);
line();
line(`  identical          ${String(identical.length).padStart(4)}`);
line(`  whitelisted diff   ${String(allowed.length).padStart(4)}`);
line(`  unexpected diff    ${String(unexpected.length).padStart(4)}`);
line(`  template-only      ${String(templateOnly.length).padStart(4)}  (locale toolchain the hub does not carry)`);
line();

if (allowed.length) {
  line('whitelisted (expected to differ):');
  for (const item of allowed) line(`  ${item.kind.padEnd(7)} ${item.path} — ${item.reason}`);
  line();
}

if (unexpected.length) {
  line('UNEXPECTED (fix the copy or add a reasoned whitelist entry):');
  for (const item of unexpected) line(`  ${item.kind.padEnd(7)} ${item.path} — ${item.reason}`);
  line();
  console.error(`check:tools-template: ${unexpected.length} unexpected difference(s).`);
  process.exit(1);
}

if (listTemplateOnly) {
  line('template-only:');
  for (const rel of templateOnly) line(`  ${rel}`);
  line();
}

line('check:tools-template: only the whitelisted differences were found.');
