/**
 * Generic stage executor for the `pipeline/*.mjs` entry points.
 *
 * A stage is a separate process, exactly like `tools/sync/lib/update.mjs`:
 *
 *   {id, title, run: [script, argv], forwards?, dryRun?, optional?}
 *
 * `run` holds a repo-relative script and its arguments; the executor spawns
 * `node <script> <argv>` so the journal records the command a human would type.
 * `forwards` names the CLI options the script understands (`section`, `limit`,
 * `locale`), and `dryRun` — when it is an array — replaces `argv` for
 * `--dry-run` (an empty array means "report-only without the write flag").
 * Omitting `dryRun` means the stage has no read-only form and is skipped.
 *
 * The journal (`.work/translate-run.json`) holds one entry per stage: the exact
 * command, status, exit code and wall clock. A failed run therefore names the
 * stage that broke, and `--from=<id>` restarts there.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_JOURNAL = path.join(REPO, '.work', 'translate-run.json');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: REPO, encoding: 'utf8'});
  return result.status === 0 ? result.stdout.trim() : null;
}

/** The command line as it appears in the journal and in `--plan` output. */
export function formatCommand(stage, argv = stage.run[1]) {
  return `node ${[stage.run[0], ...argv].join(' ')}`.trim();
}

/**
 * The argv a stage would run with. `dryRun` stages use their declared read-only
 * argv; `null` means this stage cannot be dry-run (caller skips it).
 */
export function stageArgv(stage, {dryRun = false, forward = {}} = {}) {
  if (dryRun && !Array.isArray(stage.dryRun)) return null;
  const base = dryRun ? stage.dryRun : stage.run[1];
  const extra = [];
  for (const name of stage.forwards || []) {
    const value = forward[name];
    if (value === undefined || value === null || value === '') continue;
    extra.push(`--${name}=${value}`);
  }
  return [...base, ...extra];
}

/** Options that were given but that no selected stage understands. */
export function unusedForward(stages, forward) {
  return Object.entries(forward)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .filter(([name]) => !stages.some((stage) => (stage.forwards || []).includes(name)))
    .map(([name, value]) => (value === true ? `--${name}` : `--${name}=${value}`));
}

/** Apply `--only` (plan order, not argument order) and then `--from`. */
export function resolveStages(stages, {from = null, only = null} = {}) {
  let selected = stages;
  if (only?.length) {
    const known = [...new Set(stages.map((stage) => stage.id))];
    const unknown = only.filter((id) => !known.includes(id));
    if (unknown.length) throw new Error(`unknown stage(s): ${unknown.join(', ')}; known: ${known.join(', ')}`);
    selected = stages.filter((stage) => only.includes(stage.id));
  }
  if (from) {
    const index = selected.findIndex((stage) => stage.id === from);
    if (index === -1) {
      throw new Error(`--from=${from} is not in the selected stages: ${selected.map((s) => s.id).join(', ')}`);
    }
    selected = selected.slice(index);
  }
  return selected;
}

/**
 * Run (or plan) `stages`. Returns `{ok, journal, completed, failed}`; a stage
 * failure is recorded rather than thrown, so the journal is always flushed and
 * the caller decides the exit code.
 *
 * `--plan` prints the resolved chain and touches nothing. `--dry-run` executes
 * the stages that declare a read-only argv and skips the rest; it keeps going
 * after a non-zero exit because fixer `--check` modes report pending work with
 * exit 1 and one check should not hide the others.
 */
export function runStages(
  stages,
  {from = null, only = null, plan = false, dryRun = false, forward = {}, journal = DEFAULT_JOURNAL, meta = {}, env = {}} = {},
) {
  const selected = resolveStages(stages, {from, only});
  if (!selected.length) throw new Error('no stage selected');
  for (const ignored of unusedForward(selected, forward)) {
    process.stderr.write(`note: no selected stage accepts ${ignored}; ignored\n`);
  }

  const header = {
    schema: 1,
    started_at: new Date().toISOString(),
    git_head: gitHead(),
    mode: meta.mode ?? null,
    from: from ?? null,
    only: only ?? null,
    dry_run: dryRun,
    stages: [],
  };

  if (plan) {
    process.stdout.write(
      `plan: mode=${header.mode ?? '-'} stages=${selected.length}` +
        `${from ? ` from=${from}` : ''}${dryRun ? ' (dry-run)' : ''}\n`,
    );
    for (const stage of selected) {
      // A plan shows the command the run would actually execute, forwarded
      // options (`--locale`, `--section`, ...) included; a stage without a
      // read-only form falls back to its normal argv.
      const argv = stageArgv(stage, {dryRun, forward}) ?? stage.run[1];
      process.stdout.write(`\n=== ${stage.id}: ${stage.title}\n$ ${formatCommand(stage, argv)}\n`);
    }
    return {ok: true, planned: selected, journal: header, completed: [], failed: null};
  }

  writeJson(journal, header);
  const completed = [];
  const failures = [];
  let failed = null;

  for (const [index, stage] of selected.entries()) {
    const seq = index + 1;
    const argv = stageArgv(stage, {dryRun, forward});
    const startedAt = new Date();
    const started = Date.now();
    const entry = {
      seq,
      id: stage.id,
      title: stage.title,
      command: formatCommand(stage, argv ?? stage.run[1]),
      dry_run: dryRun || undefined,
    };

    if (argv === null) {
      process.stdout.write(`\n=== ${stage.id}: ${stage.title}\n(no read-only form; skipped by --dry-run)\n`);
      Object.assign(entry, {
        status: 'skipped',
        exit_code: null,
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
      });
      header.stages.push(entry);
      writeJson(journal, header);
      continue;
    }

    process.stdout.write(`\n=== ${stage.id}: ${stage.title}\n$ ${entry.command}\n`);
    const result = spawnSync(process.execPath, [stage.run[0], ...argv], {
      cwd: REPO,
      stdio: 'inherit',
      env: {...process.env, ...env},
    });
    Object.assign(entry, {
      status: result.status === 0 ? 'ok' : 'failed',
      exit_code: result.status,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
    });
    if (result.error) entry.error = result.error.message;
    header.stages.push(entry);
    header.updated_at = new Date().toISOString();
    writeJson(journal, header);

    if (entry.status !== 'ok') {
      if (stage.optional) {
        process.stdout.write(`(optional stage ${stage.id} failed; continuing)\n`);
        continue;
      }
      failures.push(entry);
      if (!dryRun) {
        failed = entry;
        break;
      }
      process.stdout.write(`(dry run continues after ${stage.id}; the check reports pending work)\n`);
      continue;
    }
    completed.push(stage.id);
  }

  header.finished_at = new Date().toISOString();
  if (failed) {
    header.failed_stage = failed.id;
    writeJson(journal, header);
    return {ok: false, journal: header, completed, failed};
  }
  if (failures.length) {
    header.failed_stages = failures.map((entry) => entry.id);
    writeJson(journal, header);
    return {ok: false, journal: header, completed, failed: failures[0], failures};
  }
  writeJson(journal, header);
  return {ok: true, journal: header, completed, failed: null};
}
