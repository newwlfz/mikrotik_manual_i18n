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
  {
    path: 'tools/verify/lock-integrity.mjs',
    reason: 'hub-only: package-lock integrity gate; the hub owns the root lockfile that npm ci installs, locale repositories do not',
  },
  {
    path: 'tools/verify/cold-start.mjs',
    reason: 'hub-only: cold-start / first-install contract gate for the sync orchestrator, which locale repositories do not run',
  },
  {
    path: 'tools/verify/build-inputs.mjs',
    reason: 'hub-only: build gate for hardware/blog/changelog fetch products (manifest alignment, source+captured_at freshness) and the hub-owned static asset floors; locale repositories receive published content',
  },
  {
    path: 'tools/build/index.mjs',
    reason: 'hub calls verify:build-inputs for the fetch products it owns; the locale template build has no hardware/blog/changelog fetch stages or manifests',
  },
  {
    path: 'tools/verify/build-image-prefix.mjs',
    reason: 'hub-only: blog/hardware <img src> baseUrl gate; the hub owns those committed content roots and the sub-path deployment they must survive',
  },
  {
    path: 'tools/verify/addressing-ready.mjs',
    reason: 'hub-only: preflight that materialize kept HEAD /img/<hash> references before the long assets stage; locale repositories do not run sync/materialize',
  },
  {
    path: 'tools/verify/archive-fidelity.mjs',
    reason: 'hub-only: archived versioned_docs/structure fidelity gate; the locale repositories receive archives as published content and do not own the sync cache',
  },
  {
    path: 'tools/verify/provenance.mjs',
    reason: 'hub-only: source+captured_at provenance gate over docs/versioned_docs/blog/changelog/hardware; the three zone manifests are created by the hub-only fetch stages, locale repositories receive published content',
  },
  {
    path: 'tools/verify/anchor-fidelity.mjs',
    reason: 'hub-only: anchor fidelity gate over the hub-owned docs tree; locale repositories receive published content and do not own the sync cache',
  },
  {
    path: 'tools/translate/lib/paths.mjs',
    reason:
      'the template keeps the {{LOCALE}} scaffold placeholder; each locale repository substitutes its own DEFAULT_TARGET_LOCALE (sync:tools protects the file for that reason)',
  },
  {
    path: 'tools/translate/lib/tm.mjs',
    reason:
      'hub keeps a trimmed translation-memory helper: it imports only glossary/anchor helpers and has no translate pipeline or locale overlay. The template-only product-name guard (productHeadingGuard / canonicalProductName in lookupTitle) depends on keep-english.mjs, which is part of the locale toolchain the hub does not carry. Backfilling it would introduce a dangling import and locale-only logic into the English source repository.',
  },

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
    path: 'tools/sync/fetch-favicon.mjs',
    reason:
      'favicon mirror keeps a copy in the locale template too; identical bytes are not reported, a not-yet-synced template copy is reported here as a diff instead of failing the gate',
  },
  {
    path: 'tools/verify/favicon.mjs',
    reason: 'hub-only: offline favicon/manifest provenance gate over the hub-owned static/img tree',
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
  {
    path: 'tools/sync/refresh-zone-manifests.mjs',
    reason: 'hub-only: recompute the hardware/blog/changelog manifest sha256/bytes after later pipeline stages rewrite those .md files; locale repositories receive published content and do not own the three zone manifests',
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
