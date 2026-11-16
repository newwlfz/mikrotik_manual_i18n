#!/usr/bin/env node
/**
 * `npm run sync:tools` — copy the shared toolchain from the canonical template
 * into one locale repository (or into every `../repo_*` checkout).
 *
 * The template `templates/locale-repo/tools/` is the single authoritative copy
 * of the toolchain every locale repository runs (see `templates/README.md`).
 * `npm run locale:add` gives a *new* repository the current copy for free, but an
 * existing repository only ever gets a change when someone copies the files by
 * hand — and "by hand" is where the family drifts apart. This command is that
 * copy step, with the safety rules the hand-copy was missing:
 *
 *   - a file the target does not have yet            -> copied;
 *   - a file with identical bytes on both sides      -> unchanged (no write);
 *   - a file that differs                            -> **conflict**: reported,
 *     not written. A locale repository may carry a local fix; overwriting it
 *     silently is how a fix is lost. `--force` overwrites deliberately;
 *   - a protected path is never written at all       -> protected.
 *
 * Usage:
 *   npm run sync:tools -- --to ../repo_zh_hans --dry-run
 *   npm run sync:tools -- --to ../repo_zh_hans
 *   npm run sync:tools -- --all
 *   npm run sync:tools -- --all --force
 *
 * Exit codes: 0 nothing to confirm, 1 conflicts left for a human (without
 * `--force`), 2 bad usage.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Hub checkout (this file lives in `tools/content/`). */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = path.join(REPO, 'templates/locale-repo/tools');
/** Both sides are keyed by the hub-relative `tools/...` path. */
const SOURCE_PREFIX = 'tools';

/** Directories that are never part of the toolchain. */
const IGNORED_DIRS = new Set(['node_modules', '__pycache__', '.git']);
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

/**
 * Paths the template must never overwrite.
 *
 * Every locale repository legitimately owns these: the default target locale,
 * the import/bootstrap scripts, the repository-specific post-passes and the
 * workflow helpers all encode decisions the template cannot know. A template
 * copy of the same path is *expected* to differ, so it is neither a conflict
 * nor a copy.
 */
const PROTECTED = [
  {
    path: 'tools/translate/lib/paths.mjs',
    reason: 'each repository defaults to its own target locale (DEFAULT_TARGET_LOCALE)',
  },
  {
    prefix: 'tools/bootstrap/',
    reason: 'repository-specific import/bootstrap scripts',
  },
  {
    path: 'tools/translate/localize-zh-hant.mjs',
    reason: 'zh-Hant-only post-pass, not part of the shared toolchain',
  },
  {
    prefix: 'tools/content/',
    reason: 'content acquisition differs per repository; the hub publishes content instead',
  },
  {
    prefix: 'tools/ci/',
    reason: 'the CI helpers follow each repository workflow',
  },
];

const USAGE = `Usage: npm run sync:tools -- (--to <dir> | --all) [--dry-run] [--force]

Copy templates/locale-repo/tools/ into a locale repository.

Required (one of)
  --to <dir>          locale repository checkout to update, e.g. ../repo_zh_hans
  --all               every sibling ../repo_* directory that has a pages.yml

Optional
  --dry-run           report the plan; write nothing
  --force             overwrite files that differ (default: report them as conflict)
  -h, --help          print this help

Protected paths are never written: ${PROTECTED.map((entry) => entry.path || entry.prefix).join(', ')}.

Exit codes: 0 nothing left to confirm, 1 conflicts need a human (without --force),
2 bad usage.`;

class UsageError extends Error {}

function parseArgs(argv) {
  const options = {dryRun: false, force: false, all: false, to: null, help: false};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--all') {
      options.all = true;
      continue;
    }
    const separator = arg.indexOf('=');
    const name = separator === -1 ? arg.slice(2) : arg.slice(2, separator);
    if (name !== 'to') throw new UsageError(`unknown option "${arg}"`);
    let value = separator === -1 ? null : arg.slice(separator + 1);
    if (value === null) {
      value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError('--to needs a directory');
      }
      index += 1;
    }
    if (options.to !== null) throw new UsageError('--to given twice');
    options.to = value.trim();
  }
  if (options.help) return options;
  if (options.all && options.to) throw new UsageError('--to and --all are mutually exclusive');
  if (!options.all && !options.to) throw new UsageError('one of --to <dir> or --all is required');
  return options;
}

/** Every regular file under `dir`, relative to it, sorted. */
function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), base, out);
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      out.push(path.relative(base, path.join(dir, entry.name)));
    } else {
      // Symlinks and sockets are not part of the toolchain; naming them is
      // better than copying whatever they point at.
      out.push(path.relative(base, path.join(dir, entry.name)));
    }
  }
  return out.sort();
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isProtected(rel) {
  return PROTECTED.find((entry) => (entry.prefix ? rel.startsWith(entry.prefix) : rel === entry.path)) || null;
}

/**
 * A short, human-readable account of how two text files differ.
 *
 * A real unified diff would be nicer, but the point of a conflict report is to
 * say "these two copies are not the same file, look" without drowning the
 * summary in a 400-line body. The first differing line is the anchor a reviewer
 * needs; the counts say whether one side is simply ahead.
 */
function diffSummary(sourceFile, targetFile) {
  const sourceLines = fs.readFileSync(sourceFile, 'utf8').split('\n');
  const targetLines = fs.readFileSync(targetFile, 'utf8').split('\n');
  let first = 0;
  while (
    first < sourceLines.length &&
    first < targetLines.length &&
    sourceLines[first] === targetLines[first]
  ) {
    first += 1;
  }
  const show = (line) => (line === undefined ? '<eof>' : JSON.stringify(line.slice(0, 120)));
  return {
    sourceLines: sourceLines.length,
    targetLines: targetLines.length,
    firstDifferingLine: first + 1,
    source: show(sourceLines[first]),
    target: show(targetLines[first]),
  };
}

/** Resolve `--to`; a relative path is relative to the caller's directory. */
function resolveTarget(value) {
  const target = path.resolve(process.cwd(), value);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`--to ${value}: not a directory (resolved ${target})`);
  }
  if (!fs.existsSync(path.join(target, 'package.json'))) {
    throw new Error(`--to ${value}: no package.json — not a locale repository`);
  }
  return target;
}

/** Sibling `../repo_*` checkouts that carry a Pages workflow. */
function discoverTargets() {
  const parent = path.dirname(REPO);
  const found = [];
  for (const entry of fs.readdirSync(parent, {withFileTypes: true})) {
    if (!entry.isDirectory() || !entry.name.startsWith('repo_')) continue;
    const candidate = path.join(parent, entry.name);
    if (candidate === REPO) continue; // the hub itself is not a target
    const workflow = path.join(candidate, '.github/workflows/pages.yml');
    const rootWorkflow = path.join(candidate, 'pages.yml');
    if (fs.existsSync(workflow) || fs.existsSync(rootWorkflow)) found.push(candidate);
  }
  found.sort();
  if (!found.length) {
    throw new Error(`no sibling repo_* directory with a pages.yml under ${parent}`);
  }
  return found;
}

/** Plan and (unless `dryRun`) apply the copy for one target. */
function syncTarget(target, options) {
  const targetName = path.basename(target);
  const toolDir = path.join(target, 'tools');
  const sourceFiles = walk(SOURCE).map((rel) => path.join(SOURCE_PREFIX, rel));
  const targetFiles = new Set(walk(toolDir).map((rel) => path.join(SOURCE_PREFIX, rel)));

  const copied = [];
  const updated = [];
  const unchanged = [];
  const conflicts = [];
  const protectedFiles = [];

  for (const rel of sourceFiles) {
    const sourceFile = path.join(SOURCE, path.relative(SOURCE_PREFIX, rel));
    const targetFile = path.join(target, rel);
    const protection = isProtected(rel);
    const exists = targetFiles.has(rel);
    const identical = exists && digest(sourceFile) === digest(targetFile);

    if (identical) {
      unchanged.push(rel);
      continue;
    }
    // Rule 1 wins over protection: a missing file is created, never overwritten,
    // and "never overwrite" is what protection means.
    if (!exists) {
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(targetFile), {recursive: true});
        fs.copyFileSync(sourceFile, targetFile);
      }
      copied.push(rel);
      continue;
    }
    if (protection) {
      protectedFiles.push({rel, state: 'differs from the template', reason: protection.reason});
      continue;
    }
    if (options.force) {
      if (!options.dryRun) fs.copyFileSync(sourceFile, targetFile);
      updated.push(rel);
      continue;
    }
    conflicts.push({rel, ...diffSummary(sourceFile, targetFile)});
  }

  for (const rel of targetFiles) {
    if (sourceFiles.includes(rel)) continue;
    const protection = isProtected(rel);
    if (protection) {
      protectedFiles.push({rel, state: 'not in the template', reason: protection.reason});
    }
    // A target-only file outside the protected list is a local tool this
    // repository added on purpose; sync never deletes.
  }

  const lines = [];
  const say = (text = '') => lines.push(text);
  say(`sync:tools  target=${targetName}${options.dryRun ? '  (dry run)' : ''}${options.force ? '  (force)' : ''}`);
  say(`  source      ${path.relative(REPO, SOURCE)}  (${sourceFiles.length} files)`);
  say();
  say(`  copied      ${String(copied.length).padStart(3)}${options.dryRun ? '  (would copy)' : ''}`);
  say(`  updated     ${String(updated.length).padStart(3)}${options.dryRun ? '  (would overwrite)' : ''}`);
  say(`  unchanged   ${String(unchanged.length).padStart(3)}`);
  say(`  conflicts   ${String(conflicts.length).padStart(3)}`);
  say(`  protected   ${String(protectedFiles.length).padStart(3)}  (never written)`);
  say();

  if (copied.length) {
    say(options.dryRun ? 'would copy:' : 'copied:');
    for (const rel of copied) say(`  + ${rel}`);
    say();
  }
  if (updated.length) {
    say(options.dryRun ? 'would overwrite:' : 'overwritten:');
    for (const rel of updated) say(`  ~ ${rel}`);
    say();
  }
  if (protectedFiles.length) {
    say('protected (left alone):');
    for (const item of protectedFiles) say(`  = ${item.rel} — ${item.state}; ${item.reason}`);
    say();
  }
  if (conflicts.length) {
    say('conflicts (differ on both sides — resolve by hand, or re-run with --force):');
    for (const item of conflicts) {
      say(`  ! ${item.rel}`);
      say(
        `      ${item.sourceLines} lines here vs ${item.targetLines} in ${targetName}; ` +
          `first difference at line ${item.firstDifferingLine}`,
      );
      say(`      here:   ${item.source}`);
      say(`      target: ${item.target}`);
    }
    say();
  }

  if (!copied.length && !updated.length && !conflicts.length) {
    say(`${targetName}: already in sync with the template.`);
  } else if (conflicts.length) {
    say(
      `${targetName}: ${conflicts.length} file(s) differ and were left untouched — ` +
        'confirm the local changes before re-running with --force.',
    );
  } else {
    say(`${targetName}: ${copied.length} copied, ${updated.length} overwritten.`);
  }
  if (copied.length || updated.length) {
    say('Next: review the diff, commit in that repository, and run its verify commands.');
  }

  console.log(lines.join('\n'));
  return {copied, updated, unchanged, conflicts, protectedFiles};
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`sync:tools: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  if (!fs.existsSync(SOURCE)) {
    console.error(`sync:tools: template not found at ${path.relative(REPO, SOURCE)}`);
    return 1;
  }

  let targets;
  try {
    targets = options.all ? discoverTargets() : [resolveTarget(options.to)];
  } catch (error) {
    console.error(`sync:tools: ${error.message}`);
    return 2;
  }

  const results = targets.map((target) => syncTarget(target, options));

  if (targets.length > 1) {
    console.log(`\n${targets.length} repositories processed:`);
    for (const [index, target] of targets.entries()) {
      const result = results[index];
      console.log(
        `  ${path.basename(target)}: copied=${result.copied.length} updated=${result.updated.length} ` +
          `unchanged=${result.unchanged.length} conflicts=${result.conflicts.length} ` +
          `protected=${result.protectedFiles.length}`,
      );
    }
  }

  const conflicts = results.reduce((total, result) => total + result.conflicts.length, 0);
  if (conflicts && !options.force) {
    console.error(
      `\nsync:tools: ${conflicts} conflict(s) need a human. Run again with --force to overwrite, ` +
        'or copy the file by hand after reviewing the difference.',
    );
    return 1;
  }
  return 0;
}

process.exitCode = main();
