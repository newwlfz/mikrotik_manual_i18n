/**
 * Explicit batch checkpoint for `translate` (work/translate/checkpoint.json).
 *
 * The pipeline already resumes from committed overlays + state + TM shards: the
 * planner is re-derived from what is on disk, so a cursor is an *audit record*,
 * not an instruction to skip work. This module writes the record at three
 * points — batch start, every per-page checkpoint, and the stop — so a reader
 * (or tools/verify/checkpoint.mjs) can answer without guesswork:
 *
 *   - which run this was (run_id / locale / started_at / previous_run),
 *   - what the time budget and deadline were, and that the stop was *before*
 *     the deadline (`deadline_ms - stopped_ms >= 0`, i.e. deadline-elapsed >= 0),
 *   - how far it got (cursor / completed / pending recomputed from the planner),
 *   - how much of the TM is now durable (baseline + shards merged entry count),
 *   - the stop reason (budget / signal / done / error) and its exact limit.
 *
 * All state transitions here are pure apart from `writeCheckpoint`, which is a
 * small atomic file write. That makes the stop/headroom semantics probeable
 * without running a translation batch.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {WORK_DIR, ensureDir} from './paths.mjs';
import {readModelMemory, shardFiles} from './model-memory.mjs';

export const CHECKPOINT_SCHEMA = 1;
export const CHECKPOINT_FILE = 'checkpoint.json';

/** Non-final `running` is allowed: a killed runner stops at the last page write. */
export const STOPPED_VALUES = Object.freeze(['running', 'done', 'budget', 'signal', 'error']);
/** `limit` names the exact cap; `signal` is the SIGTERM/SIGINT stop reason. */
export const LIMIT_VALUES = Object.freeze(['budget-minutes', 'max-blocks', 'signal']);

/**
 * The canonical translated-count triple, shared by this checkpoint record and
 * `work/translate/run.json` (tools/verify/checkpoint.mjs reads both through it).
 *
 *   translated = llm_translated + tm_reused
 *
 * `translated_blocks` is the older run.json spelling of the *model-written*
 * part. A pre-fix journal has no `translated` at all, so readers fall back to
 * that alias rather than reading `undefined` and reporting a bogus mismatch.
 */
export const TRANSLATED_COUNT_KEYS = Object.freeze(['translated', 'llm_translated', 'tm_reused']);

export function translatedCounts(record = {}) {
  return {
    translated: Number(record.translated ?? record.translated_blocks),
    llm_translated: Number(record.llm_translated),
    tm_reused: Number(record.tm_reused),
  };
}

export function checkpointPath(workDir = WORK_DIR) {
  return path.join(workDir, CHECKPOINT_FILE);
}

/** UTC, second precision, plus 3 random bytes: unique even for back-to-back runs. */
export function newRunId(now = new Date()) {
  const iso = now.toISOString();
  const stamp = `${iso.slice(0, 10).replace(/-/g, '')}T${iso.slice(11, 19).replace(/:/g, '')}Z`;
  return `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

/** Count the *effective* translation memory: baseline merged with every shard. */
export function tmCounts(workDir = WORK_DIR) {
  const files = shardFiles(workDir);
  let shardEntries = 0;
  for (const file of files) {
    try {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (payload?.entries && typeof payload.entries === 'object') {
        shardEntries += Object.keys(payload.entries).length;
      }
    } catch {
      // A malformed shard is skipped by `readModelMemory` too; it can only lose
      // entries, never corrupt the merged count used for the audit.
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
}

/** The audit subset copied from the previous checkpoint at batch start. */
export function previousRunOf(cp) {
  if (!cp) return null;
  return {
    run_id: cp.run_id ?? null,
    locale: cp.locale ?? null,
    started_at: cp.started_at ?? null,
    finished_at: cp.finished_at ?? null,
    stopped: cp.stopped ?? null,
    limit: cp.limit ?? null,
    translated: cp.counts?.translated ?? 0,
    tm_merged_entries: cp.tm?.merged_entries ?? 0,
  };
}

/** Build the initial record. Nothing here touches the planner or the provider. */
export function newCheckpoint({
  locale,
  runId = newRunId(),
  startedAt = new Date(),
  budgetMinutes = null,
  maxBlocks = null,
  pending = null,
  tm = null,
  previousRun = null,
} = {}) {
  const startedMs = startedAt.getTime();
  const deadlineMs = budgetMinutes === null || budgetMinutes === undefined
    ? null
    : startedMs + Number(budgetMinutes) * 60000;
  return {
    schema: CHECKPOINT_SCHEMA,
    locale: String(locale ?? ''),
    run_id: runId,
    started_at: startedAt.toISOString(),
    started_ms: startedMs,
    budget_minutes: budgetMinutes ?? null,
    max_blocks: maxBlocks ?? null,
    deadline_ms: deadlineMs,
    deadline: deadlineMs === null ? null : new Date(deadlineMs).toISOString(),
    // `running` until a stop is recorded. A hard kill leaves this value, which
    // is still a valid checkpoint: the next run resumes from disk, not cursor.
    stopped: 'running',
    limit: null,
    finished_at: null,
    stopped_ms: null,
    elapsed_ms: 0,
    // deadline - elapsed, recorded only once the run stops. The verifier
    // asserts this is >= 0: the batch stopped *before* its deadline.
    headroom_ms: null,
    cursor: null,
    completed: [],
    completed_pages: 0,
    pending,
    tm,
    counts: {translated: 0, llm_translated: 0, tm_reused: 0, titles: 0, labels: 0, comments: 0},
    previous_run: previousRun,
  };
}

/** Read a checkpoint; `null` means "no checkpoint yet", never an empty record. */
export function readCheckpoint(workDir = WORK_DIR) {
  const file = checkpointPath(workDir);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Atomic write: a killed writer leaves the previous checkpoint intact. */
export function writeCheckpoint(workDir = WORK_DIR, checkpoint) {
  ensureDir(workDir);
  const file = checkpointPath(workDir);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(checkpoint, null, 1)}\n`);
  fs.renameSync(tmp, file);
  return file;
}

/**
 * Headroom of the time budget at a given instant. `null` when the run had no
 * deadline; a negative value would mean the stop was recorded *after* the
 * deadline, which the verifier treats as a failed "stopped in time" proof.
 */
export function deadlineHeadroom(checkpoint, atMs = null) {
  if (!checkpoint || checkpoint.deadline_ms === null || checkpoint.deadline_ms === undefined) {
    return null;
  }
  const startedMs = checkpoint.started_ms ?? Date.parse(checkpoint.started_at);
  const elapsed = atMs === null
    ? (checkpoint.elapsed_ms ?? 0)
    : Math.max(0, atMs - startedMs);
  return checkpoint.deadline_ms - (startedMs + elapsed);
}

/** Record one finished page. The cursor is informational for the next run. */
export function recordPage(
  checkpoint,
  {section, fileRel, pageIndex, pending, tm, counts, atMs = Date.now()} = {},
) {
  if (!checkpoint) return null;
  if (section !== undefined || fileRel !== undefined || pageIndex !== undefined) {
    checkpoint.cursor = {
      section: section ?? null,
      file_rel: fileRel ?? null,
      page_index: pageIndex ?? null,
    };
    if (section && fileRel) {
      checkpoint.completed.push(`${section}/${fileRel}`);
      checkpoint.completed_pages = checkpoint.completed.length;
    }
  }
  if (pending !== undefined) checkpoint.pending = pending;
  if (tm !== undefined) checkpoint.tm = tm;
  if (counts !== undefined) checkpoint.counts = {...counts};
  checkpoint.elapsed_ms = Math.max(0, atMs - (checkpoint.started_ms ?? atMs));
  return checkpoint;
}

/**
 * Record the stop. A final state is sticky: SIGTERM arriving after a budget
 * stop must not rewrite `budget` into `signal` (or erase finished_at).
 */
export function recordStop(
  checkpoint,
  {stopped, limit = null, counts, tm, pending, error = null, atMs = Date.now()} = {},
) {
  if (!checkpoint) return null;
  if (!STOPPED_VALUES.includes(stopped)) {
    throw new Error(`invalid checkpoint stopped value: ${stopped}`);
  }
  if (!['running', null, undefined].includes(checkpoint.stopped)) {
    // A page already in flight can finish after the stop was recorded. Keep the
    // stop time / limit / headroom sticky (that is the proof), but refresh the
    // counters so the final checkpoint agrees with run.json. A later per-page
    // flush may have advanced elapsed_ms past the deadline; put it back to the
    // stop instant so elapsed_ms and headroom_ms describe the same event.
    checkpoint.elapsed_ms = Math.max(
      0,
      (checkpoint.stopped_ms ?? (checkpoint.started_ms ?? 0)) - (checkpoint.started_ms ?? 0),
    );
    if (counts !== undefined) checkpoint.counts = {...counts};
    if (tm !== undefined) checkpoint.tm = tm;
    if (pending !== undefined) checkpoint.pending = pending;
    return checkpoint;
  }
  const stoppedMs = atMs;
  checkpoint.stopped = stopped;
  checkpoint.limit = limit ?? null;
  checkpoint.stopped_ms = stoppedMs;
  checkpoint.finished_at = new Date(stoppedMs).toISOString();
  checkpoint.elapsed_ms = Math.max(0, stoppedMs - (checkpoint.started_ms ?? stoppedMs));
  checkpoint.headroom_ms = deadlineHeadroom(checkpoint);
  if (counts !== undefined) checkpoint.counts = {...counts};
  if (tm !== undefined) checkpoint.tm = tm;
  if (pending !== undefined) checkpoint.pending = pending;
  if (error !== null) checkpoint.error = error;
  return checkpoint;
}
