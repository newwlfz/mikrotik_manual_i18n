/**
 * Blocks translated by the model, kept so a later offline `apply` cannot throw
 * them away. The legacy memory is read-only and rebuilt from the old projects;
 * this file is the append-only record of everything this pipeline produced.
 *
 * `model-memory.json` is ~26 MB and therefore gitignored, which means a CI run
 * used to translate a batch and then lose it: the only copy lived in a file the
 * workflow refuses to commit. Every save now also writes a **shard** under
 * `work/translate/shards/` that contains just the keys added or changed by that
 * save. Shards are small, JSON, sorted by key and tracked by git; loading merges
 * `model-memory.json` first and then every shard in filename order, so a shard
 * always wins over the big file it was split out of. See
 * `work/translate/README.md` § 分片 for the policy and the size limits.
 */

import fs from 'node:fs';
import path from 'node:path';
import {DEFAULT_TARGET_LOCALE, WORK_DIR, ensureDir} from './paths.mjs';

export const MODEL_MEMORY = path.join(WORK_DIR, 'model-memory.json');
export const SHARD_DIR_NAME = 'shards';
export const SHARD_SCHEMA = 1;

/** `YYYYMMDD-HHMMSS-<locale>.json`; the timestamp is UTC like `created_at`. */
const SHARD_NAME = /^\d{8}-\d{6}-.+\.json$/;
/** A single shard above this size (or this many entries) prints a warning. */
const SHARD_WARN_BYTES = 2_000_000;
const SHARD_WARN_ENTRIES = 5000;

function shardDir(workDir) {
  return path.join(workDir, SHARD_DIR_NAME);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Shard paths for one work directory, oldest first (the names sort by time). */
export function shardFiles(workDir = WORK_DIR) {
  const dir = shardDir(workDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => SHARD_NAME.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

/**
 * Merge `model-memory.json` and every shard into one Map.
 *
 * Shards are replayed in filename order, so a later save overrides an earlier
 * one, and any shard overrides the big file. A malformed shard is skipped rather
 * than failing the whole run: it can only lose the entries it would have added,
 * and the next batch re-translates those.
 */
export function readModelMemory({workDir = WORK_DIR} = {}) {
  const merged = new Map(
    Object.entries(readJson(path.join(workDir, 'model-memory.json'), {})),
  );
  for (const file of shardFiles(workDir)) {
    let payload;
    try {
      payload = readJson(file, null);
    } catch {
      continue;
    }
    const entries = payload?.entries;
    if (!entries || typeof entries !== 'object') continue;
    for (const [key, value] of Object.entries(entries)) merged.set(key, value);
  }
  return merged;
}

export function loadModelMemory(options = {}) {
  return readModelMemory(options);
}

/** `20260102-030405` from a Date, in UTC so it matches `created_at`. */
export function shardStamp(now = new Date()) {
  const iso = now.toISOString();
  return `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 19).replace(/:/g, '')}`;
}

/**
 * Write one incremental shard.
 *
 * `entries` must already be limited to the keys this save changed. Writing twice
 * in the same second merges into the existing file instead of overwriting it, so
 * a checkpoint pair never drops entries.
 */
export function writeMemoryShard(
  entries,
  {
    workDir = WORK_DIR,
    locale = DEFAULT_TARGET_LOCALE,
    now = new Date(),
    warn = (message) => process.stderr.write(`${message}\n`),
  } = {},
) {
  const file = path.join(shardDir(workDir), `${shardStamp(now)}-${locale}.json`);
  ensureDir(path.dirname(file));
  const merged = new Map();
  const existing = readJson(file, null);
  if (existing?.entries && typeof existing.entries === 'object') {
    for (const [key, value] of Object.entries(existing.entries)) merged.set(key, value);
  }
  for (const [key, value] of entries) merged.set(key, value);
  const sorted = [...merged].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const text = JSON.stringify({
    schema: SHARD_SCHEMA,
    locale,
    created_at: now.toISOString(),
    entries: Object.fromEntries(sorted),
  });
  fs.writeFileSync(file, `${text}\n`);

  const count = sorted.length;
  const bytes = Buffer.byteLength(text) + 1;
  const relative = path.relative(workDir, file);
  if (count > SHARD_WARN_ENTRIES) {
    warn(
      `warning: ${relative} has ${count} entries (> ${SHARD_WARN_ENTRIES}); ` +
        'consider compacting the shards (work/translate/README.md § 分片)',
    );
  }
  if (bytes > SHARD_WARN_BYTES) {
    warn(
      `warning: ${relative} is ${(bytes / 1_000_000).toFixed(1)} MB (> 2 MB); ` +
        'consider compacting the shards (work/translate/README.md § 分片)',
    );
  }
  return {file, entries: count, bytes};
}

/**
 * Persist the model memory and, when something changed, one incremental shard.
 *
 * The baseline is the *merged* memory (big file + existing shards), not the big
 * file alone: a CI checkout may have no `model-memory.json` at all and must not
 * re-write every already-committed entry into a new shard on every run.
 *
 * `model-memory.json` is a **committed baseline snapshot** since the refresh
 * work (see `work/translate/README.md`): the 26 MB file must not be rewritten by
 * a batch, because that would put a new copy of it into every batch commit. A
 * batch passes `{writeBaseline: false}` and appends a small `shards/*.json`
 * instead. Offline maintenance commands (`harvest`, the table pass, the title
 * normalisers) keep the default and rewrite the baseline deliberately.
 */
export function saveModelMemory(
  memory,
  {
    workDir = WORK_DIR,
    locale = DEFAULT_TARGET_LOCALE,
    now = new Date(),
    shard = true,
    writeBaseline = true,
    warn,
  } = {},
) {
  const previous = readModelMemory({workDir});
  ensureDir(workDir);
  const baselineFile = path.join(workDir, 'model-memory.json');
  if (writeBaseline) {
    fs.writeFileSync(baselineFile, JSON.stringify(Object.fromEntries(memory)));
  }
  if (!shard) return null;
  const changed = new Map();
  for (const [key, value] of memory) {
    if (previous.get(key) !== value) changed.set(key, value);
  }
  if (changed.size === 0) return null;
  return writeMemoryShard(changed, {workDir, locale, now, warn});
}
