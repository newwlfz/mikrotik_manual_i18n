#!/usr/bin/env node
/**
 * Pipeline entry point: rebuild the Chinese overlays.
 *
 * Thin wrapper over the one stage list in `translate-stages.mjs`, so the chain
 * is the same whether it is started here, from `translate:apply/derive`, or
 * from CI. `--plan` prints the exact commands without touching anything;
 * `--from` / `--only` narrow the run and the journal in `.work/translate-run.json`
 * records what each stage did.
 *
 *   node tools/pipeline/translate.mjs                        # both: harvest → apply → derive → 尾部
 *   node tools/pipeline/translate.mjs --mode=apply           # 旧 `npm run translate:apply`
 *   node tools/pipeline/translate.mjs --mode=derive          # 旧 `npm run translate:derive`
 *   node tools/pipeline/translate.mjs --plan --mode=apply    # 只打印命令
 *   node tools/pipeline/translate.mjs --from=generate-ui     # 从某个 stage 续跑
 *   node tools/pipeline/translate.mjs --only=fix-enum-cells --dry-run
 *   node tools/pipeline/translate.mjs --section=hardware --limit=50
 *
 * Every stage sees only the options it declares (see `forwards` in
 * `translate-stages.mjs`); other options are reported and ignored.
 */
import {MODES, VERIFY_STAGE, buildStages} from './translate-stages.mjs';
import {runStages} from './stages.mjs';

const USAGE = `usage: node tools/pipeline/translate.mjs [--mode=${MODES.join('|')}] [--from=ID] [--only=ID[,ID]]
       [--plan] [--dry-run] [--section=NAME] [--limit=N] [--locale=NAME] [--verify]`;

const VALUE_OPTIONS = new Set(['mode', 'from', 'only', 'section', 'limit', 'locale']);

function parseArgs(argv) {
  const options = {mode: 'both', from: null, only: null, plan: false, dryRun: false, section: null, limit: null, locale: null, verify: false};
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    }
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`unexpected argument: ${arg}\n${USAGE}`);
    const [, name, value] = match;
    if (name === 'plan' || name === 'dry-run' || name === 'verify') {
      if (value !== undefined) throw new Error(`--${name} takes no value\n${USAGE}`);
      options[name === 'dry-run' ? 'dryRun' : name] = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) throw new Error(`unknown option --${name}\n${USAGE}`);
    if (!value) throw new Error(`option --${name} needs a value written with "=" (--${name}=VALUE)\n${USAGE}`);
    if (name === 'only') {
      options.only = value.split(',').map((id) => id.trim()).filter(Boolean);
      if (!options.only.length) throw new Error(`--only needs at least one stage id\n${USAGE}`);
    } else if (name === 'mode') options.mode = value;
    else options[name] = value;
  }
  if (!MODES.includes(options.mode)) throw new Error(`unknown mode "${options.mode}"; expected ${MODES.join('|')}\n${USAGE}`);
  return options;
}

function main() {
  let options;
  let stages;
  try {
    options = parseArgs(process.argv.slice(2));
    stages = buildStages(options.mode);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
  if (options.verify) stages = [...stages, VERIFY_STAGE];

  const forward = {section: options.section, limit: options.limit, locale: options.locale};

  try {
    const result = runStages(stages, {
      from: options.from,
      only: options.only,
      plan: options.plan,
      dryRun: options.dryRun,
      forward,
      meta: {mode: options.mode},
    });
    if (!result.ok) {
      if (options.dryRun && result.failures?.length) {
        const ids = result.failures.map((entry) => `${entry.id} (exit ${entry.exit_code ?? '?'})`).join(', ');
        process.stderr.write(`translate: --dry-run reported pending work in ${ids}\n`);
      } else {
        const failed = result.failed ?? result.failures?.[0];
        process.stderr.write(`translate: stage ${failed.id} failed (exit ${failed.exit_code ?? '?'})\n`);
      }
      return 1;
    }
    if (options.plan) {
      process.stdout.write(`\nplan: ${result.planned.length} stages, nothing executed\n`);
      return 0;
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

process.exit(main());
