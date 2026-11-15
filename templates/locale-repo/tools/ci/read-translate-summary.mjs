#!/usr/bin/env node
/**
 * Read the JSON batch summary that `npm run translate:batch -- --json` printed.
 *
 * The workflow wraps the translation in `| tee` so the job can commit progress
 * even when the batch failed; that leaves npm's own banner
 * (`> mikrotik-manual-mirror@0.1.0 translate:batch`) and the tool's progress
 * lines in the file. Only one line is machine-readable — the last one that
 * parses as the summary object — so this is the parser that decides what the
 * deploy gate sees.
 *
 * Output is a `key=value` block for `$GITHUB_OUTPUT`; every value is always
 * printed, because a missing `pending` must read as "not zero" rather than
 * letting the build job's `== '0'` comparison fail open.
 *
 * `llm_error` is the HTTP status behind a provider-shaped stop (401/402/403/429),
 * or empty. It is what lets `.github/workflows/pages.yml` tell "the quota died
 * mid-batch" apart from "the batch timed out" when it decides whether the
 * `publish_on_llm_error` escape hatch applies.
 *
 * Usage:
 *   node tools/ci/read-translate-summary.mjs --file "$RUNNER_TEMP/translate.json"
 *        >> "$GITHUB_OUTPUT"
 */

import fs from 'node:fs';

/**
 * `LLMRequestError.code` → HTTP status.
 *
 * Only these four are quota/key failures the deploy gate may publish through;
 * anything else (timeout, network, 5xx, missing config) has no status here and
 * must keep the run from publishing.
 */
const LLM_STATUS_BY_CODE = {
  unauthorized: 401,
  payment_required: 402,
  forbidden: 403,
  rate_limited: 429,
};

/** The HTTP status of a batch error, or null when it is not a provider status. */
export function llmStatusOf(summary) {
  const error = summary?.error;
  if (!error) return null;
  if (Number.isInteger(error.status) && error.status >= 100) return error.status;
  return LLM_STATUS_BY_CODE[error.code] ?? null;
}

function parseArgs(argv) {
  const args = {file: null};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') args.file = argv[++i];
    else if (argv[i].startsWith('--file=')) args.file = argv[i].slice('--file='.length);
  }
  return args;
}

/** The last complete summary line, or null when the run never got that far. */
export function readSummary(text) {
  const lines = String(text ?? '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      value &&
      typeof value === 'object' &&
      Number.isFinite(value.translated) &&
      Number.isFinite(value.pending) &&
      typeof value.stopped === 'string'
    ) {
      return value;
    }
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    process.stderr.write('usage: node tools/ci/read-translate-summary.mjs --file <json-log>\n');
    process.exitCode = 2;
    return;
  }
  const text = fs.existsSync(args.file) ? fs.readFileSync(args.file, 'utf8') : '';
  const summary = readSummary(text);
  if (!summary) {
    // The batch died before printing anything (missing LLM_* variables, a crash
    // in the plan). Empty pending keeps the build job from running.
    process.stderr.write('no JSON summary in the translation log; treating as "unknown, not done"\n');
    process.stdout.write('pending=\nstopped=unknown\ntranslated=0\nllm_error=\nscript_warning=\n');
    return;
  }
  const llmError = llmStatusOf(summary);
  process.stdout.write(`pending=${summary.pending}\n`);
  process.stdout.write(`stopped=${summary.stopped}\n`);
  process.stdout.write(`translated=${summary.translated}\n`);
  process.stdout.write(`llm_error=${llmError ?? ''}\n`);
  // `script_warning` never gates the build; it is reported, not enforced. The
  // count is an output so a workflow can annotate the run without parsing the
  // summary JSON again.
  const scriptWarnings = Array.isArray(summary.script_warnings) ? summary.script_warnings : [];
  process.stdout.write(`script_warning=${scriptWarnings.length}\n`);
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    const limit = summary.limit ? `，触发上限 \`${summary.limit}\`` : '';
    const errorRow =
      summary.error === null || summary.error === undefined
        ? []
        : [
            `| LLM 错误 | \`${summary.error.code ?? 'unknown'}\`` +
              `${llmError ? `（HTTP ${llmError}）` : ''} |`,
            `| 错误信息 | ${String(summary.error.message ?? '').replace(/\|/g, '\\|').slice(0, 200)} |`,
          ];
    const lines = [
      '### 中文站翻译批次',
      '',
      '| 指标 | 值 |',
      '| --- | ---: |',
      `| 本次翻译块数 | ${summary.translated} |`,
      `| 翻译标题数 | ${summary.titles ?? 0} |`,
      `| 剩余待译单位 | ${summary.pending} |`,
      `| 停止原因 | \`${summary.stopped}\`${limit} |`,
      ...errorRow,
      `| 字形/地区用词告警 | ${scriptWarnings.length} |`,
      '',
      summary.pending === 0
        ? '全部译完：继续构建并部署。'
        : llmError
          ? `LLM 在批次中途失败（HTTP ${llmError}）：进度已提交，是否构建由 \`publish_on_llm_error\` 决定。`
          : '仍有待译内容：本次不构建，线上保持旧版；下一次 push 或手动触发继续。',
      '',
    ];
    if (scriptWarnings.length) {
      // Not a gate: the page was written anyway. Listing it here is the only
      // place a reviewer sees that `zh-Hant` still came back with `软件`.
      lines.push(
        '### 字形/地区用词告警（`script_warning`）',
        '',
        '| 类型 | 文件 | 词形 | 片段 |',
        '| --- | --- | --- | --- |',
        ...scriptWarnings.slice(0, 20).map(
          (warning) =>
            `| \`${warning.kind ?? ''}\` | ${String(warning.file ?? '').replace(/\|/g, '\\|')} | ` +
            `${(warning.forms ?? []).join('、').replace(/\|/g, '\\|')} | ` +
            `${String(warning.sample ?? '').replace(/\|/g, '\\|').slice(0, 80)} |`,
        ),
        '',
        scriptWarnings.length > 20 ? `… 另有 ${scriptWarnings.length - 20} 条，见 \`work/translate/run.json\`。` : '',
        '',
      );
    }
    fs.appendFileSync(stepSummary, `${lines.join('\n')}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
