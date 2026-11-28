#!/usr/bin/env node
/**
 * Snapshot the hub's *common* English repository documentation into hub-docs/.
 *
 * This is the canonical replacement for the ad-hoc copy in
 * `work/hub-docs-land/sync-hub-docs.mjs`: it lives in the hub's tracked toolchain
 * so the scope rule travels with the repository. Run from anywhere:
 *
 *   node tools/content/sync-hub-docs.mjs [--dry-run] [--hub=<hub root>]
 *
 * The hub is the source of truth: the root README.md and guides/*.md are copied
 * as real files (never symlinks, because publish pushes git blob contents).
 * Every copy is sha256-verified, stale snapshot files are removed, and a digest
 * manifest is written to ../work/fix-hubdocs-scope/hub-docs-manifest.json.
 *
 * Locale-specific guides are NOT shared hub docs. Publishing one to every
 * language repository gives the translate job a source with no matching overlay
 * (e.g. 12 hub-docs sources against 11 Simplified overlays), which fails the
 * Release gate. The denylist below names those files explicitly; any other
 * guide whose *filename* advertises a locale tag is a hard error, so a future
 * language-specific document cannot be copied silently.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB_ARG = process.argv.find((arg) => arg.startsWith('--hub='));
const HUB = path.resolve(HUB_ARG ? HUB_ARG.slice('--hub='.length) : path.join(HERE, '../..'));
const OUT = path.join(HUB, 'hub-docs');
const MANIFEST = path.resolve(HUB, '../work/fix-hubdocs-scope/hub-docs-manifest.json');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Guides authored for one locale only. They stay in the hub's guides/ tree for
 * maintainers, but must never be published as shared hub-docs sources.
 */
export const LOCALE_SPECIFIC_GUIDES = Object.freeze([
  // Traditional-Chinese-only operator runbook (zh-Hant); not a common English
  // hub doc, so the Simplified overlay has no counterpart for it.
  'ZH_HANT_RUNBOOK.md',
]);

/** Fail-closed guard: a new locale-tagged guide must be reviewed, not copied. */
const LOCALE_TAG_IN_FILENAME = /(^|[_.-])(zh[-_]?hant|zh[-_]?hans)([_.-]|$)/i;

const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');

function selectSources(hub) {
  const sources = [{file: 'README.md', source: path.join(hub, 'README.md')}];
  const guidesDir = path.join(hub, 'guides');
  const guides = fs.readdirSync(guidesDir, {withFileTypes: true})
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const excluded = [];
  const seen = new Set();
  for (const name of guides) {
    if (LOCALE_SPECIFIC_GUIDES.includes(name)) {
      excluded.push({file: name, reason: 'locale-specific guide (denylist)'});
      continue;
    }
    if (LOCALE_TAG_IN_FILENAME.test(name)) {
      throw new Error(
        `locale-tagged guide ${name} is not in LOCALE_SPECIFIC_GUIDES; review it before syncing hub-docs`,
      );
    }
    if (seen.has(name)) throw new Error(`duplicate hub-docs target name: ${name}`);
    seen.add(name);
    sources.push({file: name, source: path.join(guidesDir, name)});
  }
  sources.sort((a, b) => a.file.localeCompare(b.file));
  if (seen.has('README.md')) throw new Error('guides/README.md would shadow the root README.md');
  return {sources, excluded};
}

const {sources, excluded} = selectSources(HUB);
const files = sources.map(({file, source}) => {
  const bytes = fs.readFileSync(source);
  return {file, source: path.relative(HUB, source), bytes: bytes.length, sha256: sha(bytes)};
});

const plan = {
  hub: HUB,
  directory: 'hub-docs',
  dryRun: DRY_RUN,
  localeSpecificExclusions: excluded,
  fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  files,
};

if (DRY_RUN) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

fs.mkdirSync(OUT, {recursive: true});
const digestByFile = new Map(files.map((file) => [file.file, file.sha256]));
for (const {file, source} of sources) {
  const bytes = fs.readFileSync(source);
  const target = path.join(OUT, file);
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error(`refusing to write through a symlink: ${target}`);
  }
  fs.writeFileSync(target, bytes); // always replace: keep the snapshot in sync
  const copied = fs.readFileSync(target);
  if (sha(copied) !== digestByFile.get(file) || !copied.equals(bytes)) {
    throw new Error(`hub-docs copy verification failed: ${target}`);
  }
}

// Remove stale snapshot files, including any previously published locale doc.
const removed = [];
for (const entry of fs.readdirSync(OUT, {withFileTypes: true})) {
  if (!files.some((file) => file.file === entry.name) && (entry.isFile() || entry.isSymbolicLink())) {
    fs.rmSync(path.join(OUT, entry.name));
    removed.push(entry.name);
  }
}

const {dryRun: _dryRun, ...planWithoutDryRun} = plan;
const manifest = {...planWithoutDryRun, removed};
fs.mkdirSync(path.dirname(MANIFEST), {recursive: true});
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify(
    {...manifest, manifest: path.relative(HUB, MANIFEST)},
    null,
    2,
  ),
);
