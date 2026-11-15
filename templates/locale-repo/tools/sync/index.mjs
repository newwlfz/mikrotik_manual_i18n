#!/usr/bin/env node
/**
 * Mirror entry point.
 *
 *   node tools/sync/index.mjs --check       verify the committed state hashes
 *   node tools/sync/index.mjs --bootstrap   rewrite state/sync_state.json
 *   node tools/sync/index.mjs --repair      restore missing pages from the legacy copy
 *   node tools/sync/index.mjs --update      follow the official site (the pipeline)
 *
 * `--update` is the orchestrator: it discovers the release the official site
 * currently serves, then runs fetch -> snapshot -> install -> crawl -> cache ->
 * materialise -> assets -> sidebars -> prune -> verify, aborting on the first
 * failure. See tools/sync/lib/update.mjs for the stage list.
 *
 *   --update --to=7.26       pin the target instead of discovering it
 *   --update --dry-run       preflight + fetch + route report, no mutation
 *   --update --allow-dirty   skip the clean-worktree guard
 *   --update --current-only  materialise only the current version
 *   --update --with-translation  derive the new version's overlay (no API calls)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import {archivedVersions, currentVersion} from './lib/versions.mjs';
import {
  buildStages,
  discoverOfficialVersion,
  gitStatus,
  runUpdate,
  skippedReleases,
  startsJournal,
} from './lib/update.mjs';

const args = process.argv.slice(2);
const has = (name) => args.some((value) => value === `--${name}` || value.startsWith(`--${name}=`));
const value = (name, fallback) => {
  const hit = args.find((argument) => argument.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const CONFIG = YAML.parse(fs.readFileSync('config/mirror.yml', 'utf8'));
const STATE_FILE = CONFIG.sync.state_file;

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// --update: the pipeline
// ---------------------------------------------------------------------------
if (has('update')) {
  const dryRun = has('dry-run');

  // Preflight: a dirty tree destroys the only cheap rollback we have.
  const dirty = gitStatus();
  if (dirty.length && !has('allow-dirty')) {
    console.error(`working tree is not clean (${dirty.length} path(s)); commit or stash first.`);
    for (const entry of dirty.slice(0, 10)) console.error(`  ${entry}`);
    console.error('re-run with --allow-dirty to ignore this guard.');
    process.exit(2);
  }

  const installed = currentVersion();
  let target = value('to', '');
  if (!target) {
    try {
      target = await discoverOfficialVersion();
    } catch (error) {
      fail(`cannot discover the official release: ${error.message}`);
    }
    console.log(`official current release: ${target}`);
  }
  if (!/^\d+(\.\d+)+$/.test(target)) fail(`not a RouterOS version: ${target}`);

  const archived = archivedVersions();
  if (target !== installed) {
    if (archived.includes(target)) fail(`${target} is already archived in versions.json`);
    if (fs.existsSync(`versioned_docs/version-${installed}`)) {
      fail(`versioned_docs/version-${installed} already exists; refusing to snapshot over it`);
    }
    const skipped = skippedReleases(target);
    if (skipped.length) {
      console.warn(
        `warning: release(s) ${skipped.join(', ')} were never archived locally; ` +
          'snapshot them from the official site if the history matters.',
      );
    }
  }

  const mode = target === installed ? 'refresh' : 'bump';
  let stages = buildStages({target, mode, all: !has('current-only')});

  // `--from=<stage>` continues an aborted run without redoing the expensive
  // stages before it (fetch, snapshot, install).
  const from = value('from', '');
  if (from) {
    const index = stages.findIndex((stage) => stage.id === from);
    if (index === -1) fail(`unknown stage: ${from}`);
    stages = stages.slice(index);
    console.log(`[update] resuming from ${from} (${stages.length} stage(s) left)`);
  }
  console.log(`[update] mode=${mode} from=${installed} to=${target} stages=${stages.length}`);

  if (dryRun) {
    // Fetching only writes upstream/<target>/ (committed evidence, never docs/),
    // and the route report is exactly the decision list a human must read.
    startsJournal({target, mode, dry_run: true});
    for (const stage of stages.filter((entry) => ['fetch-upstream', 'report-routes'].includes(entry.id))) {
      const [script, argv] = stage.run;
      console.log(`\n$ node ${script} ${argv.join(' ')}`);
      const {spawnSync} = await import('node:child_process');
      const result = spawnSync(process.execPath, [script, ...argv], {stdio: 'inherit'});
      if (result.status !== 0) fail(`dry run failed in ${stage.id}`, 1);
    }
    console.log('\nplanned stages:');
    for (const stage of stages) console.log(`  - ${stage.id}: ${stage.title}`);
    console.log('\ndry run only: docs/, i18n/ and state were not touched.');
    process.exit(0);
  }

  const result = runUpdate({target, mode, stages, resumedFrom: from || null});
  if (!result.ok) {
    console.error(
      `\n[update] FAILED at ${result.failed.id} (${result.failed.title}); ` +
        `stages completed: ${result.completed.join(' -> ') || 'none'}`,
    );
    console.error('[update] journal: state/update-run.json');
    console.error(
      '[update] rollback (keeps tool/config edits):\n' +
        '  git checkout -- docs i18n sidebars.ts versioned_sidebars data versions.json state\n' +
        '  rm -rf versioned_docs/version-<new-archive> upstream/<target>',
    );
    process.exit(1);
  }

  if (has('with-translation')) {
    console.log('\n[update] deriving the new version from the previous one (no API calls)');
    const {spawnSync} = await import('node:child_process');
    const derive = spawnSync(process.execPath, ['tools/translate/derive.mjs', '--apply'], {stdio: 'inherit'});
    if (derive.status !== 0) fail('translate:derive failed', 1);
    // The sidebar catalogue is derived from the overlay titles, so it must run
    // after the overlay exists.
    const ui = spawnSync(process.execPath, ['tools/translate/generate-ui.mjs'], {stdio: 'inherit'});
    if (ui.status !== 0) fail('generate-ui failed', 1);
  }

  console.log(`\n[update] ${mode} ${installed} -> ${target} finished`);
  console.log('next:');
  console.log('  npm run translate:derive   # reuse reviewed wording, translate only what changed');
  console.log('  npm run translate:verify');
  console.log('  npm run build && npm run verify:ui');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// State bookkeeping (bootstrap / check / repair)
// ---------------------------------------------------------------------------
const VERSION = currentVersion();
const VERSIONED = archivedVersions();
const BACKUP = '../incoming/legacy/site';
const BACKUP_SECTIONS = {
  docs: `${BACKUP}/versioned_docs/version-${VERSION}`,
  hardware: `${BACKUP}/hardware`,
  blog: `${BACKUP}/blog`,
  changelog: `${BACKUP}/changelog`,
};
const SECTIONS = {
  docs: 'docs',
  hardware: 'hardware',
  blog: 'blog',
  changelog: 'changelog',
};
for (const version of VERSIONED) {
  SECTIONS[`docs-${version}`] = `versioned_docs/version-${version}`;
  BACKUP_SECTIONS[`docs-${version}`] = `${BACKUP}/versioned_docs/version-${version}`;
}

function walk(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) files.push(file);
  }
  return files;
}

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = text.slice(3, end);
  const out = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function sourceFor(section, rel, fm) {
  if (fm.source) return fm.source;
  const route = rel.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '');
  const version = section === 'docs' ? VERSION : section.slice('docs-'.length);
  if (section === 'docs' || section.startsWith('docs-')) {
    return `https://manual.mikrotik.com/docs/${version}/${route}`;
  }
  return `https://manual.mikrotik.com/${section}/${route}`;
}

function scan() {
  const entries = {};
  for (const [section, dir] of Object.entries(SECTIONS)) {
    for (const file of walk(dir)) {
      const rel = path.relative(dir, file);
      const fm = frontmatter(file);
      const key = `${section}:${rel}`;
      entries[key] = {
        section,
        local_path: file,
        source_url: sourceFor(section, rel, fm),
        sha256: hash(file),
        bytes: fs.statSync(file).size,
        synced_at: new Date().toISOString(),
      };
    }
  }
  return entries;
}

function writeState(entries) {
  fs.mkdirSync(path.dirname(STATE_FILE), {recursive: true});
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({schema: 1, source: CONFIG.source.base_url, version: VERSION, entries: sorted}, null, 2) + '\n',
  );
}

if (has('bootstrap')) {
  const entries = scan();
  writeState(entries);
  console.log(`bootstrapped ${Object.keys(entries).length} entries`);
  process.exit(0);
}

if (!fs.existsSync(STATE_FILE)) {
  fail(`missing ${STATE_FILE}; run --bootstrap first`);
}

const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

if (has('check')) {
  const missing = [];
  const changed = [];
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!fs.existsSync(entry.local_path)) missing.push(key);
    else if (hash(entry.local_path) !== entry.sha256) changed.push(key);
  }
  console.log(`entries=${Object.keys(state.entries).length} missing=${missing.length} changed=${changed.length}`);
  for (const key of missing.slice(0, 20)) console.log('MISSING', key);
  for (const key of changed.slice(0, 20)) console.log('CHANGED', key);
  process.exit(missing.length || changed.length ? 1 : 0);
}

// Bootstrap-only: restores from ../incoming/legacy/site. The scheduled workflow
// does not use it; it is kept until the one-off migration is complete.
if (has('repair')) {
  let repaired = 0;
  const failed = [];
  for (const [key, entry] of Object.entries(state.entries)) {
    if (fs.existsSync(entry.local_path) && hash(entry.local_path) === entry.sha256) continue;
    const rel = key.slice(key.indexOf(':') + 1);
    const candidates = [
      path.join(BACKUP_SECTIONS[entry.section] ?? path.join(BACKUP, entry.section), rel),
      path.join(BACKUP, entry.section, rel),
    ];
    const backup = candidates.find((candidate) => fs.existsSync(candidate));
    if (!backup) {
      failed.push(key);
      continue;
    }
    fs.mkdirSync(path.dirname(entry.local_path), {recursive: true});
    fs.copyFileSync(backup, entry.local_path);
    entry.sha256 = hash(entry.local_path);
    entry.bytes = fs.statSync(entry.local_path).size;
    entry.synced_at = new Date().toISOString();
    repaired++;
    console.log('REPAIRED', key);
  }
  writeState(state.entries);
  console.log(`repaired=${repaired} failed=${failed.length}`);
  if (failed.length) console.log(failed);
  process.exit(failed.length ? 1 : 0);
}

fail('usage: node tools/sync/index.mjs --bootstrap|--check|--repair|--update [options]');
