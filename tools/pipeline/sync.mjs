#!/usr/bin/env node
/**
 * Pipeline entry point: follow the official site.
 *
 * Thin wrapper over `tools/sync/index.mjs` so the five entry points are stable
 * (`pipeline/{sync,translate,verify,build,report}.mjs`) and nothing has to know
 * which stage script implements a step.
 *
 *   node tools/pipeline/sync.mjs --update
 *   node tools/pipeline/sync.mjs --update --to=7.27 --dry-run
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = spawnSync(process.execPath, ['tools/sync/index.mjs', ...process.argv.slice(2)], {
  cwd: REPO,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
