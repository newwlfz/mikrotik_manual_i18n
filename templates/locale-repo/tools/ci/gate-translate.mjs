#!/usr/bin/env node
/**
 * Turn the preflight/batch results into the deploy gate `translate` needs.
 *
 * The workflow used to fail the translate job whenever the batch stopped on an
 * API error, which is safe but has no way to say "I know the quota is gone, the
 * overlays are structurally fine, publish what is translated". This script is
 * that decision, in one testable place:
 *
 *   - a run is *failed* when the preflight failed, when the batch exited
 *     non-zero, or when the preflight passed but the batch never produced an
 *     exit code (crash between the two steps);
 *   - the run may still publish (`publish_allowed`) when it failed on one of the
 *     LLM statuses 401/402/403/429 **and** `publish_on_llm_error` is true;
 *   - anything else (timeout, network, 5xx, missing config, a budget stop with a
 *     non-zero exit) keeps the job failing.
 *
 * Note what `failed` does **not** include: a batch that exits 0 with pending
 * work left. That is the normal "budget exhausted" outcome — the job succeeds
 * and `build` decides on `pending == 0`.
 *
 * It also writes the job summary section: pending, llm_error, whether the run
 * was let through, and which pages are still English (from
 * `translate:pending --json --pages`, the same plan the deploy gate uses).
 *
 * Usage:
 *   node tools/ci/gate-translate.mjs \
 *     --preflight-ok "$PREFLIGHT_OK" --preflight-llm-error "$PREFLIGHT_ERROR" \
 *     --batch-exit "$BATCH_EXIT" --pending "$BATCH_PENDING" \
 *     --stopped "$BATCH_STOPPED" --llm-error "$BATCH_LLM_ERROR" \
 *     --publish-on-error "$PUBLISH_ON_ERROR" \
 *     --pending-json "$RUNNER_TEMP/pending.json" \
 *     >> "$GITHUB_OUTPUT"
 *
 * Outputs (always all three, so a missing value reads as "no" rather than
 * letting a comparison fail open):
 *   llm_error=<status|empty>
 *   publish_allowed=true|false
 *   gate=pass|fail
 */

import fs from 'node:fs';

/** Statuses the `publish_on_llm_error` escape hatch covers. */
const LLM_ERROR_STATUSES = new Set(['401', '402', '403', '429']);
const DEFAULT_LIMIT = 15;

const ARGUMENTS = [
  'preflight-ok',
  'preflight-llm-error',
  'batch-exit',
  'pending',
  'stopped',
  'llm-error',
  'publish-on-error',
  'pending-json',
  'limit',
  'summary-out',
];

function parseArgs(argv) {
  const raw = {limit: String(DEFAULT_LIMIT)};
  for (const name of ARGUMENTS) raw[name] ??= '';
  const known = new Set(ARGUMENTS);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith('--') || !known.has(flag.slice(2))) {
      throw new Error(`unknown argument: ${flag}`);
    }
    if (i + 1 >= argv.length) throw new Error(`missing value for ${flag}`);
    raw[flag.slice(2)] = argv[++i];
  }
  // One camelCase shape for the rest of the file: mixing hyphenated GitHub
  // output names into the decision logic is how a gate silently reads undefined.
  return {
    preflightOk: raw['preflight-ok'],
    preflightLlmError: raw['preflight-llm-error'],
    batchExit: raw['batch-exit'],
    pending: raw.pending,
    stopped: raw.stopped,
    llmError: raw['llm-error'],
    publishOnError: raw['publish-on-error'],
    pendingJson: raw['pending-json'],
    limit: raw.limit,
    summaryOut: raw['summary-out'],
  };
}

const text = (value) => String(value ?? '').trim();

/** `true` only for the literal `true`; an empty input is "no". */
function isTrue(value) {
  return text(value).toLowerCase() === 'true';
}

/**
 * The gate decision, separated from the reporting so it can be read (and
 * reasoned about) on its own.
 */
export function decide({preflightOk, preflightLlmError, batchExit, batchLlmError, publishOnError}) {
  const preflightPassed = isTrue(preflightOk);
  const batchRan = text(batchExit) !== '';
  const batchFailed = batchRan && text(batchExit) !== '0';
  // Preflight passed but the batch step produced no exit code: the step crashed
  // before its own `echo` (checkout failed, the runner died). Treat it as a
  // failure, never as "nothing to translate".
  const batchMissing = preflightPassed && !batchRan;

  const failed = !preflightPassed || batchFailed || batchMissing;
  const llmError = text(batchLlmError) || text(preflightLlmError);
  const publishAllowed = failed && LLM_ERROR_STATUSES.has(llmError) && isTrue(publishOnError);

  return {
    failed,
    batchRan,
    batchFailed,
    batchMissing,
    llmError,
    publishAllowed,
    gate: failed && !publishAllowed ? 'fail' : 'pass',
  };
}

function readPendingJson(file) {
  if (!file) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** One table cell that cannot break the table. */
function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function describePreflight({preflightOk, preflightLlmError}) {
  if (!isTrue(preflightOk)) {
    const code = text(preflightLlmError);
    return code ? `❌ 失败（\`llm_error=${code}\`）` : '❌ 失败（非额度/鉴权错误）';
  }
  return '✅ 通过（HTTP 2xx，`max_tokens=8`）';
}

function describeBatch({preflightOk, batchExit, stopped, llmError}) {
  if (!isTrue(preflightOk)) return '⏸ 未启动（预检失败，未花费任何翻译额度）';
  if (text(batchExit) === '') return '⚠️ 未运行（步骤没有退出码）';
  if (text(batchExit) === '0') {
    return `✅ 已跑完（exit 0，\`stopped=${text(stopped) || 'unknown'}\`）`;
  }
  const code = text(llmError);
  return `❌ 失败（exit ${text(batchExit)}，\`stopped=${text(stopped) || 'unknown'}\`${
    code ? `，HTTP ${code}` : ''
  }）`;
}

function buildSummary({input, decision, pendingJson}) {
  const pending = text(input.pending);
  const pendingText = pending === '' ? '未知（没有批次摘要）' : `\`${pending}\``;
  const publishOnError = isTrue(input.publishOnError);
  const lines = [];

  lines.push('### 中文站：LLM 预检与发布决策', '');
  lines.push('| 项目 | 值 |');
  lines.push('| --- | --- |');
  lines.push(`| LLM 预检（\`verify:llm --quick\`） | ${describePreflight(input)} |`);
  lines.push(`| 批量翻译 | ${describeBatch({...input, llmError: decision.llmError})} |`);
  lines.push(`| 剩余待译单位 \`pending\` | ${pendingText} |`);
  lines.push(`| \`llm_error\` | ${decision.llmError ? `\`${decision.llmError}\`` : '（无）'} |`);
  lines.push(
    `| \`publish_on_llm_error\` | \`${publishOnError}\`${publishOnError ? '' : '（默认：不放行）'} |`,
  );
  if (decision.publishAllowed) {
    lines.push('| 决策 | ✅ **放行**：继续 `build`，未译内容保持英文发布 |');
  } else if (decision.gate === 'fail') {
    lines.push('| 决策 | ⛔ **不放行**：`build` 不跑，线上保持上一个成功版本 |');
  } else {
    lines.push('| 决策 | ✅ 正常结束：由 `pending` 决定是否 `build` |');
  }
  lines.push('');

  if (decision.publishAllowed) {
    lines.push(
      '> ⚠️ **本次是放行发布**：`publish_on_llm_error=true`，翻译在 LLM 失败后停止。',
      '> 构建仍会跑 `npm run translate:verify` 与全部部署门禁，但**未译内容会以英文上线**。',
      '> 额度恢复后重跑一次即可补齐；`pending` 会继续下降。',
      '',
    );
  } else if (decision.gate === 'fail') {
    lines.push(
      '> 本次 `translate` job 失败：`build` 不跑，线上保持上一个成功版本。',
      '> 已完成的块（如果有）已经提交，额度/密钥修好后重跑会从断点继续。',
      '',
    );
  } else if (pending === '0') {
    lines.push('> 翻译已全部完成：进入 `build`。', '');
  } else if (pending === '') {
    lines.push(
      '> 批次没有报告 `pending`（摘要缺失），因此不会进入 `build`；线上保持旧版。',
      '> 检查 `Translate one batch` 的日志：通常是翻译在打出摘要前就崩了。',
      '',
    );
  } else {
    lines.push(
      `> 还有 \`${pending}\` 个待译单位：本次不构建，线上保持旧版；下一次 push 或手动触发继续。`,
      '',
    );
  }

  lines.push(
    ...describeEnglishPages({
      pending,
      pendingJson,
      limit: Number(input.limit) || DEFAULT_LIMIT,
    }),
  );
  return `${lines.join('\n')}\n`;
}

/**
 * Which pages are still English.
 *
 * The list comes from `translate:pending --json --pages`, i.e. the same plan the
 * deploy gate reads, *not* from `state/translation-state.json`: the state's
 * `pendingBlocks` also counts blocks that are kept in English on purpose, so it
 * never reaches zero and would name hundreds of finished pages.
 *
 * `pending` is the batch summary's number. Both are computed from the same plan,
 * so they normally agree; when they do not (the plan was recomputed after the
 * batch) the summary says so instead of claiming "nothing left" over a pending
 * count it was just given.
 */
function describeEnglishPages({pending, pendingJson, limit}) {
  if (!pendingJson) {
    return [
      '### 仍为英文的页面',
      '',
      '（未读取到待译页面清单：`npm run translate:pending -- --json --pages` 没有产出。）',
      '',
    ];
  }
  const reported = text(pending);
  const reportedNumber = reported === '' ? null : Number(reported);
  const planPending = Number.isFinite(pendingJson.pending) ? pendingJson.pending : null;
  const mismatch =
    reportedNumber !== null &&
    Number.isFinite(reportedNumber) &&
    planPending !== null &&
    reportedNumber !== planPending
      ? `> 注意：批次摘要 \`pending=${reported}\`，清单重算为 \`pending=${planPending}\`；` +
        '清单以重算结果为准。'
      : '';
  const nothingLeft =
    reportedNumber !== null && Number.isFinite(reportedNumber)
      ? reportedNumber === 0 && (planPending === null || planPending === 0)
      : planPending === 0;

  if (nothingLeft) {
    return [
      '### 仍为英文的页面',
      '',
      '无：计划里已经没有待译单位。',
      '',
      ...(mismatch ? [mismatch, ''] : []),
    ];
  }
  const list = Array.isArray(pendingJson.page_list) ? pendingJson.page_list : [];
  if (!list.length) {
    return [
      '### 仍为英文的页面',
      '',
      `计划里还有 ${planPending ?? reported} 个待译单位，但清单为空。`,
      '',
      ...(mismatch ? [mismatch, ''] : []),
    ];
  }
  const shown = list.slice(0, limit);
  const lines = [
    '### 仍为英文的页面',
    '',
    `共 **${pendingJson.pages ?? list.length}** 页 / **${pendingJson.pending}** 个单位` +
      `（${pendingJson.blocks ?? 0} 块 + ${pendingJson.titles ?? 0} 个标题）。`,
    '',
    '| 板块 | 页面 | 英文块 | 标题仍英文 |',
    '| --- | --- | ---: | :---: |',
  ];
  for (const page of shown) {
    lines.push(
      `| ${cell(page.section)} | \`${cell(page.path)}\` | ${page.blocks ?? 0} | ${
        page.title ? '是' : ''
      } |`,
    );
  }
  lines.push('');
  if (mismatch) lines.push(mismatch, '');
  if (list.length > shown.length) {
    lines.push(`（只列前 ${shown.length} 页；完整清单：\`npm run translate:pending -- --json --pages\`。）`);
  } else {
    lines.push('（完整清单：`npm run translate:pending -- --json --pages`。）');
  }
  if (pendingJson.page_list_truncated) {
    lines.push('', '> 清单本身在行数上限处被截断，这里只显示了一部分。');
  }
  lines.push('');
  return lines;
}

function main() {
  const input = parseArgs(process.argv.slice(2));
  const decision = decide({
    preflightOk: input.preflightOk,
    preflightLlmError: input.preflightLlmError,
    batchExit: input.batchExit,
    batchLlmError: input.llmError,
    publishOnError: input.publishOnError,
  });

  process.stdout.write(`llm_error=${decision.llmError}\n`);
  process.stdout.write(`publish_allowed=${decision.publishAllowed}\n`);
  process.stdout.write(`gate=${decision.gate}\n`);

  const summary = buildSummary({
    input,
    decision,
    pendingJson: readPendingJson(input.pendingJson),
  });
  const target = text(input.summaryOut) || process.env.GITHUB_STEP_SUMMARY;
  if (target) fs.appendFileSync(target, summary);
  else process.stderr.write(summary);

  // The job's outcome is decided by the workflow step that reads `gate`, not by
  // this script: a non-zero exit here would fail the job even when the gate
  // allows publishing.
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`gate-translate: ${error.message}\n`);
    process.exitCode = 2;
  }
}
