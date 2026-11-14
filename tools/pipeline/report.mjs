#!/usr/bin/env node
/**
 * Pipeline entry point: write the machine-readable reports used by the mirror
 * dashboard and by the next session (materialise diff, table coverage).
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const steps = [
  ['node', ['tools/sync/materialize.mjs', '--version=' + (process.argv[2] || '7.26'), '--all', '--check']],
  ['node', ['tools/verify/table-coverage.mjs', '--pages']],
];
for (const [command, args] of steps) {
  spawnSync(command, args, {cwd: REPO, stdio: 'inherit'});
}
