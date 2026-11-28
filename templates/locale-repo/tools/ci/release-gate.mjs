#!/usr/bin/env node
/**
 * Unified release gate: one decision for the local drill and for CI.
 *
 * NEVER replace this with a bare `npm run build`. A build that exits 0 only
 * proves Docusaurus rendered the current tree — it does not prove the
 * translation is finished. Local rehearsals must call this script:
 *
 *   node tools/ci/release-gate.mjs           # runs every check itself
 *   node tools/ci/release-gate.mjs --json    # machine-readable decision
 *
 * CI normally already has the results; pass them in instead of re-running:
 *
 *   node tools/ci/release-gate.mjs \
 *     --pending-json="$RUNNER_TEMP/pending.json" \
 *     --translate-verify-exit="$VERIFY_EXIT" \
 *     --verify-log="$RUNNER_TEMP/verify.log" \
 *     --verify-deploy-exit="$DEPLOY_EXIT" \
 *     --checkpoint-stopped="$CHECKPOINT_STOPPED" \
 *     --gate="verify:cli:$CLI_EXIT" --gate="verify:images:$IMAGES_EXIT" \
 *     --json
 *
 * Decision (no real threshold is relaxed here — an omitted check is UNKNOWN,
 * and an unknown check fails the gate):
 *   pending == 0 && translate:verify exit == 0 && verify:deploy exit == 0
 *   && every additional content gate exit == 0
 *   && the checkpoint is terminal (not running/error)
 *   => release=pass (exit 0); otherwise release=fail (exit 1) with the exact
 *   pending / untranslatedBlocks / heading / description / anchor numbers.
 *
 * An English source repo has no translation overlay and no translate tooling:
 * pending and translate:verify are recorded as N/A (satisfied), not as invented
 * debt. Identity is not inferred from the scripts alone: a locale checkout
 * that lost its scripts is fail-closed, never relabelled "English, N/A".
 * A missing checkpoint file is a SKIP only in the English source repo; in a
 * locale repo a missing assertion script or checkpoint record fails the gate.
 *
 * `--pre-build-check` marks a pre-build invocation where `verify:deploy` cannot
 * be measured yet (CI passes 0 only as a placeholder). In that mode the deploy
 * gate is recorded as SKIPPED/unknown, never as a passing gate, and the human
 * summary says "前置检查通过；deploy 门禁待 build 复核" instead of a bare
 * release=pass. The build job re-runs the full gate for real.
 */

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const MODULE_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_OUTPUT = 64 * 1024 * 1024;
const TERMINAL_STOPS = new Set(['done', 'budget', 'signal']);
const BAD_STOPS = new Set(['running', 'error']);
const DEBT_KEYS = [
  'untranslatedBlocks',
  'untranslatedAdmonitions',
  'untranslatedHeadings',
  'descriptionEnglish',
  'overlayInflation',
  'anchorMismatch',
  'mdxErrors',
  'structural',
];

function usage() {
  return [
    'usage: node tools/ci/release-gate.mjs [options]',
    '  --repo=DIR                  repository root (default: this script\'s ../../..)',
    '  --json                      emit one JSON object on stdout',
    '  --no-run                    never spawn commands; missing values stay unknown',
    '  --pre-build-check           pre-build invocation: verify:deploy is a skipped placeholder',

    '  --pending=N                 override the pending total',
    '  --pending-json=PATH         read `translate:pending --json` output from PATH',
    '  --translate-verify-exit=N   override the translate:verify exit code',
    '  --verify-log=PATH           captured translate:verify stdout (debt numbers)',
    '  --verify-deploy-exit=N      override the verify:deploy exit code',
    '  --checkpoint-stopped=STATUS override checkpoint.stopped',
    '  --checkpoint-json=PATH      read checkpoint JSON from PATH',
    '  --checkpoint-exit=N         override the checkpoint assertion exit code',
    '  --gate=NAME:EXIT            extra content gate (repeatable)',
    '  --help                      show this text',
  ].join('\n');
}

function parseArgs(argv) {
  const flags = new Set(['json', 'no-run', 'pre-build-check', 'help']);
  const values = new Set([
    'repo', 'pending', 'pending-json', 'translate-verify-exit', 'verify-log',
    'verify-deploy-exit', 'checkpoint-stopped', 'checkpoint-json',
    'checkpoint-exit', 'gate',
  ]);
  const out = {json: false, noRun: false, preBuildCheck: false, help: false, gates: []};
  for (const arg of argv) {
    if (arg === '--json') { out.json = true; continue; }
    if (arg === '--no-run') { out.noRun = true; continue; }
    if (arg === '--pre-build-check') { out.preBuildCheck = true; continue; }
    if (arg === '--help' || arg === '-h') { out.help = true; continue; }
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || (!values.has(match[1]) && !flags.has(match[1]))) {
      throw new Error(`unknown argument: ${arg}`);
    }
    const [key, value] = [match[1], match[2]];
    if (key === 'gate') out.gates.push(value);
    else out[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out;
}

function asExit(raw, name) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!/^\d+$/.test(String(raw).trim())) throw new Error(`${name} must be a non-negative integer (got ${raw})`);
  return Number(String(raw).trim());
}

function readJson(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} missing: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON (${file}): ${error.message}`);
  }
}

function runNode(repo, script, args) {
  const file = path.join(repo, script);
  if (!fs.existsSync(file)) return {exit: null, stdout: '', stderr: '', unavailable: true};
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
    env: process.env,
  });
  return {
    exit: result.error ? null : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  };
}

function npmScriptExists(repo, script) {
  const pkgFile = path.join(repo, 'package.json');
  if (!fs.existsSync(pkgFile)) return false;
  try { return Boolean(JSON.parse(fs.readFileSync(pkgFile, 'utf8')).scripts?.[script]); }
  catch { return false; }
}

/**
 * Is this checkout the English source repo, so a missing translate chain may
 * honestly be recorded as N/A?
 *
 * Every checkout carries the same root `locales.json` registry, so the mere
 * presence of other available locales is not enough to identify this one.
 * Resolve the checkout's own locale first (`SITE_LOCALE`, then the repo tail
 * in each entry's `repo` field — the same convention as tools/build/index.mjs
 * and tools/build/slim.mjs), then require it to be the default locale.
 *
 * Fail closed for: an unreadable registry, a multi-locale registry that cannot
 * identify this checkout, or a non-default locale checkout. Only an absent
 * registry, a registry with no available locale besides the default, or the
 * default-locale repo itself counts as the English source. This is what stops
 * a locale repo that dropped its scripts from being relabelled "English, N/A".
 */
function englishSourceCheck(repo) {
  const file = path.join(repo, 'locales.json');
  if (!fs.existsSync(file)) return {english: true, reason: 'no-locales-json'};
  let registry;
  try { registry = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return {english: false, reason: 'unreadable-locales-json'}; }
  const entries = registry && typeof registry.locales === 'object' && registry.locales
    ? Object.entries(registry.locales) : [];
  const defaultLocale = String(registry?.default || 'en');
  const otherAvailable = entries.filter(([code, entry]) =>
    code !== defaultLocale && entry && entry.available !== false);
  if (otherAvailable.length === 0) return {english: true, reason: 'single-default-locale'};
  const siteLocale = String(process.env.SITE_LOCALE || '').trim();
  const repoName = path.basename(repo);
  const repoTail = (entry) =>
    String(entry?.repo || '').trim().replace(/\/+$/, '').split('/').pop() || '';
  let ownLocale = null;
  if (siteLocale && entries.some(([code]) => code === siteLocale)) ownLocale = siteLocale;
  else {
    const match = entries.find(([, entry]) => repoTail(entry) === repoName);
    if (match) ownLocale = match[0];
  }
  if (!ownLocale) return {english: false, reason: 'unidentified-checkout-in-multi-locale-registry'};
  return ownLocale === defaultLocale
    ? {english: true, reason: 'default-locale-repo'}
    : {english: false, reason: 'non-default-locale-repo'};
}

function runNpm(repo, script) {
  if (!npmScriptExists(repo, script)) return {exit: null, stdout: '', stderr: '', unavailable: true};
  const result = spawnSync('npm', ['run', script], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
    env: process.env,
  });
  return {
    exit: result.error ? null : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  };
}

/** Aggregate the per-section summary lines and the totals line of `verify`. */
function parseDebt(output) {
  const debt = Object.fromEntries(DEBT_KEYS.map((key) => [key, null]));
  const sums = Object.fromEntries(DEBT_KEYS.map((key) => [key, 0]));
  let sections = 0;
  for (const line of String(output || '').split('\n')) {
    const match = /^(\S+): (\{.*\})$/.exec(line.trim());
    if (match) {
      try {
        const stat = JSON.parse(match[2]);
        if (stat && typeof stat === 'object') {
          sections++;
          for (const key of DEBT_KEYS) {
            if (typeof stat[key] === 'number') sums[key] += stat[key];
          }
          // `missing`/`extra`/`emptyOverlays` are structural, not language debt.
          sums.structural += (stat.missing || 0) + (stat.extra || 0) + (stat.emptyOverlays || 0);
        }
      } catch {}
      continue;
    }
    for (const key of DEBT_KEYS) {
      const kv = new RegExp(`\\b${key}=(\\d+)\\b`).exec(line);
      if (kv) debt[key] = Math.max(debt[key] ?? 0, Number(kv[1]));
    }
  }
  const out = {sections_seen: sections};
  for (const key of DEBT_KEYS) {
    // An explicit totals line wins; otherwise fall back to the section sum.
    out[key] = debt[key] !== null ? debt[key] : (sections ? sums[key] : null);
  }
  return out;
}

export function decide(args) {
  const repo = args.repo ? path.resolve(args.repo) : MODULE_REPO;
  const identity = englishSourceCheck(repo);
  const englishSource = identity.english;
  // A source-only English checkout has no translation job at all. The npm
  // contract alone is not proof of identity: verify the repo against
  // locales.json too, so a locale repo that lost its scripts fails closed.
  const hasTranslateChain = !args.noRun &&
    npmScriptExists(repo, 'translate:pending') && npmScriptExists(repo, 'translate:verify');
  const chainMissingOnLocaleRepo = !hasTranslateChain && !englishSource;
  const gates = [];
  const reasons = [];
  const warnings = [];
  const notes = [];
  let pending = null;
  let pendingSource = 'unknown';
  let verifyExit = null;
  let verifySource = 'unknown';
  let deployExit = null;
  let deploySource = 'unknown';
  let stopped = null;
  let stoppedSource = 'unknown';
  let checkpointExit = null;
  let verifyOutput = '';
  let deployOutput = '';

  // 1) pending — the same plan `translate` would execute. --------------------
  if (args.pending !== undefined) {
    if (!/^\d+$/.test(args.pending)) throw new Error(`--pending must be a non-negative integer (got ${args.pending})`);
    pending = Number(args.pending);
    pendingSource = 'override';
  } else if (args.pendingJson) {
    const payload = readJson(args.pendingJson, '--pending-json');
    if (!Number.isInteger(payload?.pending)) throw new Error(`--pending-json has no integer pending: ${args.pendingJson}`);
    pending = payload.pending;
    pendingSource = 'pending-json';
  } else if (chainMissingOnLocaleRepo) {
    // A locale repo without the translate chain is not an English source;
    // inventing pending=0 here is the fail-open this guard closes.
    pending = null;
    pendingSource = 'missing_chain_locale_repo';
  } else if (!hasTranslateChain) {
    pending = 0;
    pendingSource = args.noRun ? 'unknown' : 'not_applicable';
  } else if (!args.noRun) {
    const result = runNode(repo, 'tools/translate/index.mjs', ['pending', '--json']);
    verifyOutputNote(result.stderr);
    try {
      const payload = JSON.parse(result.stdout);
      if (result.exit === 0 && Number.isInteger(payload?.pending)) {
        pending = payload.pending;
        pendingSource = 'command';
      } else {
        warnings.push(`pending command exit=${result.exit} or bad JSON`);
      }
    } catch (error) {
      warnings.push(`pending JSON parse failed: ${error.message}`);
    }
  }

  // 2) translate:verify — also supplies the exact debt numbers. -------------
  if (args.translateVerifyExit !== undefined) {
    verifyExit = asExit(args.translateVerifyExit, '--translate-verify-exit');
    verifySource = 'override';
  } else if (chainMissingOnLocaleRepo) {
    verifyExit = null;
    verifySource = 'missing_chain_locale_repo';
  } else if (!hasTranslateChain) {
    verifyExit = 0;
    verifySource = args.noRun ? 'unknown' : 'not_applicable';
  } else if (!args.noRun) {
    const result = runNpm(repo, 'translate:verify');
    verifyExit = result.exit;
    verifySource = result.unavailable ? 'unavailable' : (result.error ? 'error' : 'command');
    verifyOutput = `${result.stdout}\n${result.stderr}`;
    if (result.unavailable) warnings.push('npm script translate:verify is unavailable');
    if (result.error) warnings.push(`translate:verify: ${result.error}`);
    if (result.exit !== 0) warnings.push(`translate:verify output: ${tail(result.stdout + '\n' + result.stderr)}`);
  }
  if (args.verifyLog) {
    if (!fs.existsSync(args.verifyLog)) throw new Error(`--verify-log missing: ${args.verifyLog}`);
    verifyOutput = `${verifyOutput}\n${fs.readFileSync(args.verifyLog, 'utf8')}`;
  }
  const debt = parseDebt(verifyOutput);
  gates.push({name: 'translate:verify', exit: verifyExit, source: verifySource});

  // 3) verify:deploy — the content/asset gate after the build. --------------
  const deploySkipped = Boolean(args.preBuildCheck);
  if (deploySkipped) {
    // Pre-build invocation: there is no build/ to verify yet, so CI's
    // `--verify-deploy-exit=0` is only a placeholder. Record the gate as
    // skipped/unknown — never as a passing gate. The build job re-runs the
    // full gate with the real exit value before deploy.
    deployExit = null;
    deploySource = 'pre_build_placeholder';
  } else if (args.verifyDeployExit !== undefined) {
    deployExit = asExit(args.verifyDeployExit, '--verify-deploy-exit');
    deploySource = 'override';
  } else if (!args.noRun) {
    const result = runNpm(repo, 'verify:deploy');
    deployExit = result.exit;
    deploySource = result.unavailable ? 'unavailable' : (result.error ? 'error' : 'command');
    deployOutput = `${result.stdout}\n${result.stderr}`;
    if (result.unavailable) warnings.push('npm script verify:deploy is unavailable');
    if (result.error) warnings.push(`verify:deploy: ${result.error}`);
    if (result.exit !== 0) warnings.push(`verify:deploy output: ${tail(result.stdout + '\n' + result.stderr)}`);
  }
  gates.push({
    name: 'verify:deploy', exit: deployExit, source: deploySource,
    ...(deploySkipped ? {status: 'skipped'} : {}),
  });

  // 4) checkpoint — a still-running or errored batch is an intermediate. ----
  let checkpointData = null;
  const cpScript = path.join(repo, 'tools/verify/checkpoint.mjs');
  const cpFile = args.checkpointJson || path.join(repo, 'work/translate/checkpoint.json');
  const hasCheckpointScript = fs.existsSync(cpScript);
  const hasCheckpointState = fs.existsSync(cpFile);
  // In a locale checkout a missing assertion script or checkpoint record is a
  // real gap, not a fresh-scaffold SKIP. Fail closed even when CI passes
  // `--checkpoint-exit=0` because the script was absent and nobody ran it.
  const localeCheckpointGap = !englishSource && (!hasCheckpointScript || !hasCheckpointState);
  const gapSource = !hasCheckpointScript ? 'missing_script_locale_repo' : 'missing_state_locale_repo';
  let checkpointSource = 'assertion';
  if (localeCheckpointGap) {
    checkpointExit = 1;
    checkpointSource = gapSource;
  }
  if (args.checkpointStopped !== undefined) {
    stopped = args.checkpointStopped;
    stoppedSource = 'override';
    if (localeCheckpointGap && !TERMINAL_STOPS.has(stopped)) {
      // A claimed not_applicable/empty state from a locale repo cannot stand
      // in for a real checkpoint.
      stopped = null;
      stoppedSource = gapSource;
    }
  } else if (hasCheckpointState) {
    try {
      checkpointData = JSON.parse(fs.readFileSync(cpFile, 'utf8'));
      stopped = typeof checkpointData.stopped === 'string' ? checkpointData.stopped : null;
      stoppedSource = 'checkpoint-json';
    } catch (error) {
      warnings.push(`checkpoint JSON unreadable: ${error.message}`);
      stopped = null;
      stoppedSource = 'invalid';
    }
  } else if (englishSource) {
    // English source checkout: the clean SKIP `checkpoint.mjs` gives a fresh
    // scaffold. A locale repo takes the fail-closed path above.
    stopped = 'not_applicable';
    stoppedSource = 'missing_skip_english_source';
  } else {
    stopped = null;
    stoppedSource = gapSource;
  }
  if (args.checkpointExit !== undefined) {
    checkpointExit = asExit(args.checkpointExit, '--checkpoint-exit');
    if (localeCheckpointGap) {
      checkpointExit = 1;
      checkpointSource = gapSource;
    }
  } else if (!args.noRun && hasCheckpointScript && !localeCheckpointGap) {
    const result = runNode(repo, 'tools/verify/checkpoint.mjs', []);
    checkpointExit = result.exit;
    if (result.error) warnings.push(`checkpoint assertion: ${result.error}`);
  } else if (!hasCheckpointScript && englishSource) {
    checkpointExit = 0;
    checkpointSource = 'skip_english_source';
  }
  gates.push({name: 'checkpoint', exit: checkpointExit, source: checkpointSource});

  // 5) Any extra content gates CI already ran. ------------------------------
  for (const item of args.gates) {
    const match = /^([^:]+):([^:]+)$/.exec(item);
    if (!match) throw new Error(`--gate must be NAME:EXIT (got ${item})`);
    const exit = asExit(match[2], `--gate ${match[1]}`);
    gates.push({name: match[1], exit, source: 'override'});
  }

  // TERMINAL_STOPS is deliberately unchanged: running/error stay fatal.
  const checkpointOk = TERMINAL_STOPS.has(stopped) || stopped === 'not_applicable';
  const pendingOk = pending === 0;
  const verifyOk = verifyExit === 0;
  // A pre-build placeholder is not a passing deploy gate. It is skipped from
  // this invocation's conjunction and re-checked by the build job for real.
  const deployOk = deploySkipped ? null : deployExit === 0;
  const gatesOk = gates.every((gate) => gate.status === 'skipped' || gate.exit === 0)
    && checkpointExit === 0;
  const pass = pendingOk && verifyOk && (deploySkipped || deployOk) && gatesOk && checkpointOk;
  if (deploySkipped) {
    notes.push(pass
      ? '前置检查通过；deploy 门禁待 build 复核'
      : '前置检查未通过；deploy 门禁待 build 复核');
  }

  if (chainMissingOnLocaleRepo) {
    reasons.push('locale repo lost translate:pending/translate:verify scripts — N/A (English source) refused; fail-closed');
  }
  if (!pendingOk) reasons.push(`pending=${pending ?? 'unknown'} (must be 0)`);
  if (!verifyOk) reasons.push(`translate:verify exit=${verifyExit ?? 'unknown'} (must be 0)`);
  if (!deployOk && !deploySkipped) reasons.push(`verify:deploy exit=${deployExit ?? 'unknown'} (must be 0)`);
  if (localeCheckpointGap) {
    reasons.push(`locale repo checkpoint ${gapSource} — N/A refused; fail-closed`);
  }
  if (!checkpointOk) reasons.push(`checkpoint stopped=${JSON.stringify(stopped)} (terminal done|budget|signal required; running/error/invalid fails)`);
  if (checkpointExit !== 0) reasons.push(`checkpoint assertion exit=${checkpointExit ?? 'unknown'} (must be 0)`);
  const named = new Set(['translate:verify', 'verify:deploy', 'checkpoint']);
  for (const gate of gates.filter((g) => g.exit !== 0 && !named.has(g.name))) {
    reasons.push(`content gate ${gate.name} exit=${gate.exit ?? 'unknown'} (must be 0)`);
  }
  if (!pass && Object.values(debt).some((value) => typeof value === 'number' && value > 0)) {
    reasons.push(
      `debt: untranslatedBlocks=${debt.untranslatedBlocks} ` +
      `untranslatedHeadings=${debt.untranslatedHeadings} ` +
      `untranslatedAdmonitions=${debt.untranslatedAdmonitions} ` +
      `descriptionEnglish=${debt.descriptionEnglish} ` +
      `overlayInflation=${debt.overlayInflation} ` +
      `anchorMismatch=${debt.anchorMismatch} mdxErrors=${debt.mdxErrors}`,
    );
  }

  const result = {
    // `release` keeps its CI meaning: the checks that could be measured in
    // this invocation all passed. In pre-build mode it is a *preflight* pass,
    // surfaced as `release=preflight-pass` in the human summary and with the
    // deploy gate recorded as skipped below — never a deploy-gate pass.
    release: pass ? 'pass' : 'fail',
    mode: deploySkipped ? 'pre-build' : 'full',
    repo,
    repo_identity: identity,
    has_translate_chain: hasTranslateChain,
    decision: {
      pending_zero: pendingOk,
      translate_verify_zero: verifyOk,
      verify_deploy_zero: deployOk,
      deploy_gate: deploySkipped ? 'skipped-pending-build' : 'measured',
      checkpoint_terminal: checkpointOk,
      content_gates_zero: gatesOk,
    },
    inputs: {
      pending,
      pending_source: pendingSource,
      translate_verify_exit: verifyExit,
      translate_verify_source: verifySource,
      verify_deploy_exit: deployExit,
      verify_deploy_source: deploySource,
      checkpoint_stopped: stopped,
      checkpoint_stopped_source: stoppedSource,
      checkpoint_exit: checkpointExit,
      checkpoint_exit_source: checkpointSource,
    },
    debt,
    gates,
    reasons,
    warnings,
    notes,
    diagnostics: {
      translate_verify_tail: verifyExit === 0 ? null : tail(verifyOutput),
      verify_deploy_tail: deployExit === 0 ? null : tail(deployOutput),
    },
  };
  return result;
}

function tail(text, lines = 8, chars = 240) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-lines)
    .map((line) => line.slice(0, chars))
    .join(' | ');
}

function verifyOutputNote(stderr) {
  if (stderr && stderr.trim()) process.stderr.write(`${stderr.trimEnd()}\n`);
}

function printHuman(result) {
  const i = result.inputs;
  const d = result.debt;
  const pre = result.mode === 'pre-build';
  // In pre-build mode never print a bare release=pass: the deploy gate has
  // not run yet. Show a distinct preflight label and the explicit note.
  const label = pre
    ? `release=preflight-${result.release}`
    : `release=${result.release}`;
  const out = [
    `${label}  mode=${result.mode}  repo=${result.repo}`,
    `  repo identity: ${result.repo_identity.english ? 'english-source' : 'locale-repo'} (${result.repo_identity.reason}); translate chain: ${result.has_translate_chain}`,
    `  pending=${i.pending ?? 'unknown'} (${i.pending_source}) — 必须为 0`,
    `  translate:verify exit=${i.translate_verify_exit ?? 'unknown'} (${i.translate_verify_source}) — 必须为 0`,
    `  verify:deploy   exit=${i.verify_deploy_exit ?? 'unknown'} (${i.verify_deploy_source}) — ${pre ? '前置占位，待 build 复核；不计为通过' : '必须为 0'}`,
    `  checkpoint stopped=${i.checkpoint_stopped ?? 'unknown'} (${i.checkpoint_stopped_source}), assertion exit=${i.checkpoint_exit ?? 'unknown'} (${i.checkpoint_exit_source})`,
    `  content gates: ${result.gates.map((g) => `${g.name}=${g.exit ?? 'unknown'}${g.status ? `/${g.status}` : ''}`).join(' ')}`,
    `  debt: untranslatedBlocks=${d.untranslatedBlocks ?? 'unknown'}` +
      ` untranslatedHeadings=${d.untranslatedHeadings ?? 'unknown'}` +
      ` untranslatedAdmonitions=${d.untranslatedAdmonitions ?? 'unknown'}` +
      ` descriptionEnglish=${d.descriptionEnglish ?? 'unknown'}` +
      ` overlayInflation=${d.overlayInflation ?? 'unknown'}` +
      ` anchorMismatch=${d.anchorMismatch ?? 'unknown'}` +
      ` mdxErrors=${d.mdxErrors ?? 'unknown'}` +
      ` structural=${d.structural ?? 'unknown'}`,
  ];
  if (pre && result.release === 'pass') {
    out.push('  前置检查通过；deploy 门禁待 build 复核');
  }
  if (result.notes.length) out.push(`  notes: ${result.notes.join('; ')}`);
  if (result.warnings.length) out.push(`  warnings: ${result.warnings.join('; ')}`);
  if (result.reasons.length) {
    out.push('  reasons:');
    for (const reason of result.reasons) out.push(`    - ${reason}`);
  }
  process.stdout.write(`${out.join('\n')}\n`);
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n${usage()}\n`); process.exitCode = 2; return; }
  if (args.help) { process.stdout.write(`${usage()}\n`); return; }
  let result;
  try { result = decide(args); }
  catch (error) { process.stderr.write(`release-gate: ${error.message}\n`); process.exitCode = 2; return; }
  if (args.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else printHuman(result);
  process.exitCode = result.release === 'pass' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
