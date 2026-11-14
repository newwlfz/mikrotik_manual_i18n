#!/usr/bin/env node
/**
 * Pipeline entry point: build the site.
 *
 * Thin wrapper over `tools/build/index.mjs` so the five entry points are stable
 * (`pipeline/{sync,translate,build,verify,report}.mjs`) and nothing has to know
 * which stage script implements a step. That script runs the chain
 * `cli:build` → `docusaurus build` → `pagefind --site build`.
 *
 * The 10 GiB heap is set here as well as in `tools/build/index.mjs`, because a
 * CI or npm-run-script shell may already export NODE_OPTIONS: an existing
 * `--max-old-space-size` wins (it is the operator's explicit choice), otherwise
 * the flag is appended to whatever is already there instead of clobbering it.
 *
 *   node tools/pipeline/build.mjs
 *   node tools/pipeline/build.mjs --locale zh-Hans   # extra args go to docusaurus build
 *   BUILD_HEAP_MB=8192 node tools/pipeline/build.mjs # smaller heap for low-RAM boxes
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HEAP_MB = Number(process.env.BUILD_HEAP_MB || 10240);
const current = process.env.NODE_OPTIONS || '';
const nodeOptions = /--max-old-space-size=/.test(current)
  ? current
  : `${current} --max-old-space-size=${HEAP_MB}`.trim();

const result = spawnSync(process.execPath, ['tools/build/index.mjs', ...process.argv.slice(2)], {
  cwd: REPO,
  stdio: 'inherit',
  env: {...process.env, NODE_OPTIONS: nodeOptions},
});
process.exit(result.status ?? 1);
