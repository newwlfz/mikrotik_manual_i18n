#!/usr/bin/env node
/**
 * Assert the explicit translate checkpoint is coherent with what it claims.
 *
 * A checkpoint is written at batch start, on every page flush and at the stop
 * (budget / signal / done / error). This gate reads it back and checks:
 *
 *   1. schema / locale / stopped / limit are legal;
 *   2. `deadline - elapsed >= 0` (headroom), i.e. the stop was recorded in time;
 *   3. run.json, state/translation-state.json and work/translate/shards/ exist;
 *   4. the durable TM (model-memory baseline + shards) has not shrunk — neither
 *      since the previous run nor since this checkpoint was written;
 *   5. `llm_translated + tm_reused == translated` in both the checkpoint and
 *      run.json, and the two agree once the run is final.
 *
 * No checkpoint yet is a clean SKIP (a fresh scaffold has never run a batch),
 * so this can sit in tools/pipeline/verify.mjs without false failures.
 *
 *   node tools/verify/checkpoint.mjs
 *   node tools/verify/checkpoint.mjs --repo=/path/to/locale-repo
 *   node tools/verify/checkpoint.mjs --work-dir=/path/to/work/translate
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readModelMemory, shardFiles} from '../translate/lib/model-memory.mjs';

// The checkpoint record helpers live in tools/translate/lib/checkpoint.mjs in
// locale repositories. The English hub and a fresh scaffold do not carry that
// library, but this gate must still run in every repo (it SKIPs cleanly while no
// batch has run). Prefer the real lib where it exists; otherwise use the same
// pure helpers inlined below. No assertion or threshold differs between paths.
let cpLib;
try {
  cpLib = await import('../translate/lib/checkpoint.mjs');
} catch {
  cpLib = null;
}
const {
  CHECKPOINT_SCHEMA,
  LIMIT_VALUES,
  STOPPED_VALUES,
  TRANSLATED_COUNT_KEYS,
  checkpointPath,
  tmCounts,
  translatedCounts,
} = cpLib ?? {
  CHECKPOINT_SCHEMA: 1,
  LIMIT_VALUES: Object.freeze(['budget-minutes', 'max-blocks', 'signal']),
  STOPPED_VALUES: Object.freeze(['running', 'done', 'budget', 'signal', 'error']),
  TRANSLATED_COUNT_KEYS: Object.freeze(['translated', 'llm_translated', 'tm_reused']),
  checkpointPath: (workDir) => path.join(workDir, 'checkpoint.json'),
  translatedCounts: (record = {}) => ({
    translated: Number(record.translated ?? record.translated_blocks),
    llm_translated: Number(record.llm_translated),
    tm_reused: Number(record.tm_reused),
  }),
  tmCounts: (workDir) => {
    // Same rule as the locale lib: effective TM = baseline merged with shards.
    const files = shardFiles(workDir);
    let shardEntries = 0;
    for (const file of files) {
      try {
        const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (payload?.entries && typeof payload.entries === 'object') {
          shardEntries += Object.keys(payload.entries).length;
        }
      } catch {
        // A malformed shard can only lose entries, never corrupt the count.
      }
    }
    const baselineFile = path.join(workDir, 'model-memory.json');
    let baselineEntries = 0;
    if (fs.existsSync(baselineFile)) {
      try {
        baselineEntries = Object.keys(JSON.parse(fs.readFileSync(baselineFile, 'utf8'))).length;
      } catch {
        baselineEntries = 0;
      }
    }
    return {
      baseline_entries: baselineEntries,
      shard_files: files.length,
      shard_entries: shardEntries,
      merged_entries: readModelMemory({workDir}).size,
    };
  },
};

const MODULE_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || !['repo', 'work-dir'].includes(match[1])) {
      throw new Error(`usage: node tools/verify/checkpoint.mjs [--repo=DIR] [--work-dir=DIR] (got ${arg})`);
    }
    args[match[1]] = match[2];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const repo = args.repo ? path.resolve(args.repo) : MODULE_REPO;
const workDir = args['work-dir']
  ? path.resolve(args['work-dir'])
  : path.join(repo, 'work/translate');
const file = checkpointPath(workDir);
const stateFile = path.join(repo, 'state/translation-state.json');

const failures = [];
const notes = [];
const fail = (message) => failures.push(message);

if (!fs.existsSync(file)) {
  console.log(`checkpoint: no ${path.relative(repo, file)} yet — SKIP (no batch has run)`);
  process.exit(0);
}

let cp;
try {
  cp = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  fail(`checkpoint.json is not valid JSON: ${error.message}`);
  cp = null;
}

if (cp) {
  // 1. schema / locale / stopped / limit ------------------------------------
  if (cp.schema !== CHECKPOINT_SCHEMA) {
    fail(`schema=${JSON.stringify(cp.schema)}, expected ${CHECKPOINT_SCHEMA}`);
  }
  const locale = cp.locale;
  if (typeof locale !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale)) {
    fail(`locale=${JSON.stringify(locale)} is not a locale tag`);
  } else if (locale.toLowerCase().startsWith('en')) {
    fail(`locale=${locale} is the English source locale, not a translation target`);
  }
  if (!STOPPED_VALUES.includes(cp.stopped)) {
    fail(`stopped=${JSON.stringify(cp.stopped)}, expected one of ${STOPPED_VALUES.join('|')}`);
  }
  if (!Array.isArray(cp.completed) || cp.completed_pages !== cp.completed.length) {
    fail(`completed_pages=${cp.completed_pages} but completed has ${cp.completed?.length ?? 0} rows`);
  }
  const limit = cp.limit;
  if (cp.stopped === 'signal' && limit !== 'signal') {
    fail(`stopped=signal but limit=${JSON.stringify(limit)} (expected "signal")`);
  } else if (cp.stopped === 'budget' && !['budget-minutes', 'max-blocks'].includes(limit)) {
    fail(`stopped=budget but limit=${JSON.stringify(limit)} (budget-minutes|max-blocks expected)`);
  } else if (['running', 'done', 'error'].includes(cp.stopped) && limit !== null) {
    fail(`stopped=${cp.stopped} but limit=${JSON.stringify(limit)} (expected null)`);
  } else if (limit !== null && !LIMIT_VALUES.includes(limit)) {
    fail(`limit=${JSON.stringify(limit)} is not a known cap`);
  }

  // 2. deadline - elapsed >= 0 ---------------------------------------------
  const elapsed = Number(cp.elapsed_ms);
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    fail(`elapsed_ms=${JSON.stringify(cp.elapsed_ms)} must be a non-negative number`);
  }
  if (cp.deadline_ms === null || cp.deadline_ms === undefined) {
    if (cp.headroom_ms !== null) fail('no deadline but headroom_ms is set');
    notes.push('no time budget on this run (headroom not applicable)');
  } else {
    if (cp.stopped_ms === null || cp.stopped_ms === undefined) {
      fail('deadline set but stopped_ms missing — cannot prove the stop was in time');
    } else {
      const headroom = Number(cp.deadline_ms) - Number(cp.stopped_ms);
      if (!Number.isFinite(headroom) || headroom < 0) {
        fail(
          `deadline - elapsed = ${headroom} ms (< 0): stop recorded after the deadline ` +
            `(deadline_ms=${cp.deadline_ms}, stopped_ms=${cp.stopped_ms})`,
        );
      }
      if (Number(cp.headroom_ms) !== headroom) {
        fail(`headroom_ms=${JSON.stringify(cp.headroom_ms)} but deadline-stopped=${headroom}`);
      }
      notes.push(`deadline - stopped = ${headroom} ms (must be >= 0)`);
    }
  }

  // 3. companion files ------------------------------------------------------
  const shardDir = path.join(workDir, 'shards');
  for (const [label, target] of [
    ['run.json', path.join(workDir, 'run.json')],
    ['state/translation-state.json', stateFile],
    ['work/translate/shards/', shardDir],
  ]) {
    if (!fs.existsSync(target)) fail(`missing ${label}`);
  }

  // 4. TM merged entries never decrease ------------------------------------
  const tm = cp.tm || {};
  const merged = Number(tm.merged_entries);
  if (!Number.isFinite(merged) || merged < 0) {
    fail(`tm.merged_entries=${JSON.stringify(tm.merged_entries)} is not a count`);
  } else {
    const previous = Number(cp.previous_run?.tm_merged_entries ?? 0);
    if (merged < previous) {
      fail(`TM shrank across runs: ${previous} -> ${merged} entries`);
    }
    if (fs.existsSync(shardDir)) {
      const current = tmCounts(workDir).merged_entries;
      if (current < merged) {
        fail(`TM shrank since the checkpoint: ${merged} -> ${current} entries`);
      }
      notes.push(`TM merged entries ${previous} (prev) -> ${merged} (checkpoint) -> ${current} (now)`);
    }
  }

  // 5. the split invariant, in both records --------------------------------
  // Both records use the same three names; `translatedCounts` is the shared
  // reader (it falls back to run.json's legacy `translated_blocks` spelling).
  const counts = translatedCounts(cp.counts || {});
  const sum = counts.llm_translated + counts.tm_reused;
  if (sum !== counts.translated) {
    fail(
      `checkpoint: llm_translated(${counts.llm_translated}) + tm_reused(${counts.tm_reused}) ` +
        `= ${sum} != translated(${counts.translated})`,
    );
  }
  const runPath = path.join(workDir, 'run.json');
  if (fs.existsSync(runPath)) {
    let run;
    try {
      run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    } catch (error) {
      fail(`run.json is not valid JSON: ${error.message}`);
    }
    if (run) {
      const runCounts = translatedCounts(run);
      const runSum = runCounts.llm_translated + runCounts.tm_reused;
      if (runSum !== runCounts.translated) {
        fail(
          `run.json: llm_translated(${runCounts.llm_translated}) + tm_reused(${runCounts.tm_reused}) ` +
            `= ${runSum} != translated(${runCounts.translated})`,
        );
      }
      if (cp.stopped !== 'running') {
        for (const key of TRANSLATED_COUNT_KEYS) {
          if (counts[key] !== runCounts[key]) {
            fail(`final checkpoint.${key}=${counts[key]} but run.json.${key}=${runCounts[key]}`);
          }
        }
        // run.json's `stopped` is the *final status string* written by
        // writeRunJournal() ('done' | 'budget' | 'error'), not a boolean
        // "a cap was hit" flag. Reading a truthy 'done' as 'budget' made every
        // clean batch fail this gate. Honour the recorded vocabulary; only a
        // legacy truthy non-status value keeps the old 'budget' fallback.
        // `limit: signal` still carries the signal reason, which the journal
        // collapses into 'budget'.
        const journalStopped = STOPPED_VALUES.includes(run.stopped) && run.stopped !== 'running'
          ? run.stopped
          : run.stopped
            ? 'budget'
            : 'done';
        const expected = run.error
          ? 'error'
          : run.limit === 'signal'
            ? 'signal'
            : journalStopped;
        if (cp.stopped !== expected) {
          fail(`checkpoint.stopped=${cp.stopped} but run.json implies ${expected}`);
        }
      }
    }
  }
}

console.log(`checkpoint: ${path.relative(repo, file)} run=${cp?.run_id ?? '?'} stopped=${cp?.stopped ?? '?'}`);
for (const note of notes) console.log(`  ${note}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`);
  console.error(`checkpoint: ${failures.length} assertion(s) failed.`);
  process.exit(1);
}
console.log(`checkpoint: ${failures.length} failures — OK`);
