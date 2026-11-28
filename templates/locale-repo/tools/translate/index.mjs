#!/usr/bin/env node
/**
 * zh-Hans translation pipeline for the mirror.
 *
 *   node tools/translate/index.mjs import-legacy [--legacy-root=DIR]
 *       Build the translation memory and legacy index from the read-only
 *       legacy projects. No network, no model.
 *
 *   node tools/translate/index.mjs apply [--dry-run] [--section=NAME] [--allow-cjk-loss]
 *       Write i18n/zh-Hans overlays. Offline: exact legacy pages are reused
 *       verbatim (with the dropped horizontal rules restored) and changed pages
 *       are assembled block by block from the translation memory. A page that
 *       would end up with fewer Chinese characters than its current overlay is
 *       kept as is (`preserved`), unless `--allow-cjk-loss` says the loss is
 *       intended.
 *
 *   node tools/translate/index.mjs verify [--no-compile] [--locale=TAG] [--all-locales]
 *       Check file parity, code fences, images, front matter and MDX. Without
 *       arguments it checks the default locale (`zh-Hans`), byte for byte as
 *       before; `--locale` checks one target, `--all-locales` every configured
 *       target that has resources, and one failing locale fails the run.
 *
 *   node tools/translate/index.mjs comments [--dry-run] [--limit=N] [--section=NAME]
 *       Translate the line-leading `#` comments of allowed code fences and store
 *       them in the comment memory. Only comment text is sent, never code.
 *
 *   node tools/translate/index.mjs tm [--dry-run]
 *       Merge the legacy, model and comment memories into one global memory
 *       keyed by "kind + normalised English", and write a dry-run report of what
 *       switching to it would change. `--dry-run` skips writing the TM file.
 *
 *   node tools/translate/index.mjs status
 *       Print coverage from state/translation-state.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  SECTIONS,
  DEFAULT_TARGET_LOCALE,
  LocaleError,
  assertTranslationLocale,
  localeHasResources,
  sectionsFor,
  glossaryFile,
  localeRoot,
  patchDir,
  tmFile,
  REPO,
  WORKSPACE,
  WORK_DIR,
  walkMarkdown,
  relative,
  ensureDir,
  writeFileAtomic,
} from './lib/paths.mjs';
import {buildLegacy, buildTitleIndex, CJK} from './lib/legacy.mjs';
import {applySection, cleanupOverlay, alignImages, imageAlignment, images, isPreservedOverlay, rewriteLinks, rebaseImages, isTranslationExcluded} from './lib/apply.mjs';
import {resourceLocales, verify, englishOnlyPrefixes} from './lib/verify.mjs';
import {isMustTranslateHeading, splitMustTranslateHeadingParts} from './lib/headings.mjs';
import {needsDescriptionTranslation} from './lib/desc-rules.mjs';
import {
  normalize,
  isTranslatableProse,
  fenceMask,
  splitBlocks,
  splitBlockSpans,
  codeParagraphs,
} from './lib/blocks.mjs';
import {languageText} from './lib/prose.mjs';
import {
  splitAdmonitions,
  renderAdmonition,
  bodyParagraphs,
  isTranslatableAdmonition,
  parseAdmonitionOpener,
  parseAdmonitionCloser,
} from './lib/admonitions.mjs';
import {splitFrontMatter, readField, withFields, renderDocument} from './lib/frontmatter.mjs';
import {needsSidebarLabelTranslation} from './lib/labels.mjs';
import {buildWhitelist} from './lib/ui-copy.mjs';
import {translationProvenance} from './lib/provenance.mjs';
import {annotateDocumentTerms} from './lib/term-annotate.mjs';
import {addHeadingAnchors} from './lib/anchors.mjs';
import {normaliseMdxAnchors} from '../sync/lib/mdx-normalise.mjs';
import {Client, loadConfig, USAGE_FILE} from './lib/provider.mjs';
import {commentRules, descriptionPrompt, paragraphRetryPrompt, sidebarLabelPrompt, targetLanguage, titlePrompt} from './lib/prompts.mjs';
import {guardScript} from './lib/script-guard.mjs';
import {feedbackFor, issueSummary, scriptIssues} from './lib/script-check.mjs';
import {loadPatch, applyReplacements} from './lib/patches.mjs';
import {loadModelMemory, readModelMemory, saveModelMemory} from './lib/model-memory.mjs';
import {
  CHECKPOINT_SCHEMA,
  newCheckpoint,
  newRunId,
  previousRunOf,
  readCheckpoint,
  recordPage,
  recordStop,
  tmCounts,
  writeCheckpoint,
} from './lib/checkpoint.mjs';
import {loadCommentMemory, saveCommentMemory} from './lib/comment-memory.mjs';
import {
  buildGlobalTm,
  compareSectionPriority,
  createGlobalTm,
  lookupBlock,
  lookupBlockLines,
  lookupTitle,
  serializeTm,
  saveTm,
} from './lib/tm.mjs';
import {isLegal} from './lib/legal.mjs';
import {LLMRequestError} from './lib/llm-config.mjs';
import {
  LOCKS_FILE,
  loadLocks,
  saveLocks,
  canonicalProductName,
} from './lib/keep-english.mjs';
import {
  blockHashes,
  encodeBlockHashes,
  formatRefreshSummary,
  loadRefreshTm,
  refreshChanged,
  refreshEnabled,
  refreshJournal,
} from './lib/refresh.mjs';
import {sha256Hex} from './lib/digest.mjs';
import {
  commentLines,
  classifyComment,
  commentKey,
  translateCodeComments,
} from './lib/code-comments.mjs';

const STATE_FILE = path.join(REPO, 'state/translation-state.json');
/** Journal of the last batch run: what it did, how it stopped, what is left. */
const RUN_FILE = path.join(WORK_DIR, 'run.json');
/** Explicit checkpoint: start / per-page / stop record (see lib/checkpoint.mjs). */
const CHECKPOINT_FILE = path.join(WORK_DIR, 'checkpoint.json');

/**
 * How early a wall-clock guard commits a budget stop.
 *
 * `room()` is only consulted between batches/pages. On a slow provider the last
 * request can finish *after* the deadline, so the first check afterwards used
 * to record `stopped_ms` late (headroom -8409 ms / -8971 ms in the 30 s
 * reproduction). The guard below fires on the clock, independently of in-flight
 * work, and `room()` then refuses every further request. The in-flight page is
 * still allowed to finish and flush — only *new* work is cut off.
 *
 * 60 s is also the "do not open a new request with less than this left" rule:
 * preprocessing (refresh + planning) is synchronous and cannot be interrupted
 * by a timer, so a budget shorter than the lead is stopped *before* preprocessing
 * rather than recording a stop from inside an overrun. A 90-minute CI budget is
 * unaffected; a 0.2-minute probe stops immediately with a positive headroom.
 */
const BUDGET_STOP_LEAD_MS = 60_000;

/**
 * Output the script check could not fix after its one retry.
 *
 * A hit is not an error: the translation is kept (the alternative is English
 * prose on the page), but it is named in `run.json`, the JSON batch summary and
 * the CI job summary, so a reviewer sees that `zh-Hant` still came back with
 * `软件` instead of `軟體`. Silence is what made the OpenCC-derived tree look
 * intentional.
 */
function recordScriptWarning(run, {file, kind, issues, text}) {
  if (!run) return;
  run.recordScriptWarning({file, kind, issues, text});
}

/** Print the run's script warnings (the CLI commands that have no summary). */
function reportScriptWarnings(run, stream = process.stdout) {
  if (!run?.scriptWarnings?.length) return;
  stream.write(`script_warning: ${run.scriptWarnings.length}\n`);
  for (const warning of run.scriptWarnings.slice(0, 20)) {
    stream.write(
      `  script_warning ${warning.kind} ${warning.file ?? '?'}: ` +
        `${warning.forms.join('；')} — ${warning.sample}\n`,
    );
  }
}

/** True for the versioned RouterOS docs sections (`docs`, `docs-7.24`, ...). */
function isDocsSection(section) {
  return section.source === 'docs' || section.source.startsWith('versioned_docs/version-');
}

/** Options whose value must be attached with `=`, as in `--section=hardware`. */
const VALUE_OPTIONS = new Set([
  'section',
  'limit',
  'legacy-root',
  'file',
  'files',
  'kinds',
  'concurrency',
  'budget-minutes',
  'max-blocks',
  'locale',
]);

/** Options that are booleans when they carry no `=VALUE`. */
const FLAG_OPTIONS = new Set([
  'dry-run',
  'adopt',
  'allow-cjk-loss',
  'all-locales',
  'no-compile',
  'json',
  'apply',
  // `pending --json --pages`: also list the pages behind the count, so CI can
  // name them instead of only printing a number.
  'pages',
  // `translate --refresh-changed`: rebuild the pages whose English source
  // changed from the translation memory before this batch runs (see
  // `lib/refresh.mjs`). `--no-refresh-changed` overrides the batch script when
  // the refresh itself is what a run must not do.
  'refresh-changed',
  'no-refresh-changed',
]);

/** Commands that translate into a target locale (and therefore validate it). */
const LOCALE_COMMANDS = new Set([
  'import-legacy',
  'apply',
  'translate',
  'align',
  'descriptions',
  'comments',
  'admonitions',
  'tm',
  'pending',
]);

/** A user error in the command line (unknown/bad option); exits 2, not 1. */
class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

const USAGE =
  'usage: node tools/translate/index.mjs <import-legacy|apply|verify|translate|align|pending|descriptions|comments|tm|admonitions|status> [options]\n' +
  '       [--section=NAME] [--locale=NAME] [--all-locales] [--dry-run] [--adopt] [--allow-cjk-loss] [--limit=N] ...\n' +
  '       translate: [--apply] [--budget-minutes=0.5] [--max-blocks=N]\n' +
  '                  [--kinds=blocks,titles,labels,comments,images,descriptions] [--json]\n' +
  '       translate: [--refresh-changed] [--no-refresh-changed]  (rebuild pages whose English source changed)\n' +
  '       align: [--dry-run] [--section=NAME] [--file=REL]  (image references + orphan overlays)\n' +
  'note: an option value must be attached with "=" (--section=hardware); a space is not accepted.\n' +
  `note: --locale defaults to ${DEFAULT_TARGET_LOCALE} and must not be the source locale (en).\n` +
  'note: verify --all-locales and verify --locale are mutually exclusive.\n' +
  'note: `translate --json` writes progress to stderr so stdout carries exactly one JSON summary.\n' +
  'note: --refresh-changed is on in `npm run translate:batch`; config/translation.yml#refresh_changed\n' +
  '      or TRANSLATE_REFRESH_CHANGED=0 turns it off, and --no-refresh-changed overrides one run.\n' +
  'note: --refresh-changed --dry-run reports the refresh only: nothing is written or translated.\n' +
  'note: --help prints this text and exits 0; an unknown option exits 2.\n' +
  'note: `pending --json --pages` adds a per-page list of what is still English.\n' +
  'note: a front-matter `sidebar_label` is planned and counted as `sidebar_labels`; a\n' +
  '      `cli-reference/` command name and a proper noun stay English by policy.';

function parseArgs(argv) {
  const args = {_: []};
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) {
      const name = match[1];
      if (match[2] === undefined) {
        if (VALUE_OPTIONS.has(name)) {
          throw new UsageError(`option --${name} needs a value written with "=" (--${name}=VALUE)\n${USAGE}`);
        }
        if (!FLAG_OPTIONS.has(name)) {
          // An unknown option used to be stored and ignored, so a typo ran the
          // command with its default scope instead of failing.
          throw new UsageError(`unknown option: --${name}\n${USAGE}`);
        }
        args[name] = true;
      } else if (match[2] === '' && VALUE_OPTIONS.has(name)) {
        // `--section=` used to read as a falsy value, so `apply` silently ran
        // every section instead of none.
        throw new UsageError(`option --${name} needs a non-empty value (--${name}=VALUE)\n${USAGE}`);
      } else if (!VALUE_OPTIONS.has(name) && !FLAG_OPTIONS.has(name)) {
        throw new UsageError(`unknown option: --${name}\n${USAGE}`);
      } else {
        args[name] = match[2];
      }
      continue;
    }
    // The first bare word is the command. Any further bare word used to be
    // swallowed silently: `apply --section hardware` read `section` as boolean
    // `true`, selected zero sections and printed nothing while exiting 0.
    if (args._.length === 0) {
      args._.push(arg);
      continue;
    }
    throw new UsageError(`unexpected argument: ${arg}; option values must use "--name=value"\n${USAGE}`);
  }
  return args;
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return {schema: 1, sections: {}, files: {}};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function writeState(state) {
  state.generated_at = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
  writeFileAtomic(STATE_FILE, `${JSON.stringify(state, null, 1)}\n`);
}

/**
 * Parse a numeric option that may be absent.
 *
 * `--budget-minutes=0` is a legitimate request ("check the plan, translate
 * nothing"), so zero is accepted; a negative or non-numeric value is a user
 * error and stops the command before any request is sent.
 */
function optionalNumber(raw, name) {
  if (raw === undefined || raw === true) return null;
  const value = Number(raw);
  if (String(raw).trim() === '' || !Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative number (got "${raw}")\n${USAGE}`);
  }
  return value;
}

/**
 * What the last batch did, next to the state it changed.
 *
 * `work/translate/run.json` is committed by the workflow, so the next run (and a
 * human reading the repository) can see whether the previous batch stopped on
 * the time budget, on `--max-blocks`, or on an error — instead of guessing from
 * a commit message.
 */
function writeRunJournal({run, pending, client, pendingComments = null}) {
  const journal = {
    schema: 1,
    started_at: run.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    stopped: run.error ? 'error' : run.stopped ? 'budget' : 'done',
    limit: run.limit,
    budget_minutes: run.budgetMinutes,
    max_blocks: run.maxBlocks,
    // Canonical total, spelled exactly like `checkpoint.counts.translated`:
    // llm_translated + tm_reused. The verifier reads this name; an older
    // journal only carried `translated_blocks`, which is the model-written
    // part (kept below for compatibility).
    translated: run.blocks + run.tmReused,
    translated_blocks: run.blocks,
    translated_titles: run.titles,
    translated_sidebar_labels: run.labels,
    translated_comments: run.comments,
    // Split of what this run wrote: the model (`llm_translated`, also
    // `translated_blocks`) and the memory (`tm_reused`). The pair is what tells a
    // reviewer whether the version trees are duplicating each other.
    llm_translated: run.blocks,
    tm_reused: run.tmReused,
    pages: run.pages,
    block_errors: run.blockErrors,
    // Image alignment is structural; a warning here means the page kept an
    // image the source no longer carries (or dropped one it could not place).
    image_alignment_warning: run.imageWarnings.length,
    image_alignment_warnings: run.imageWarnings,
    script_warnings: run.scriptWarnings,
    // What the pre-batch refresh did (null when it did not run): stale pages
    // found, pages rebuilt from the memory, blocks left English for this batch.
    refresh: run.refresh ?? null,
    pending,
    pending_comments: pendingComments,
    tokens: client
      ? {prompt: client.usage.prompt, completion: client.usage.completion, calls: client.usage.calls}
      : null,
    model: client?.config?.model ?? null,
    // `status` is the HTTP status when the run stopped on a provider response
    // (401/402/403/429/...), so a reader does not have to map the code name back
    // to a number. `null` means "not an HTTP failure" (config, timeout, crash).
    error: run.error
      ? {code: run.error.code ?? null, status: run.error.status ?? null, message: run.error.message}
      : null,
  };
  writeFileAtomic(RUN_FILE, `${JSON.stringify(journal, null, 1)}\n`);
  return journal;
}

/**
 * The machine-readable batch summary.
 *
 * The first three keys are the CI contract — `translated` blocks written,
 * `pending` units left, and `stopped` one of `budget|done|error`; the rest is
 * additive context. `limit` names which cap produced `budget`
 * (`budget-minutes`, `max-blocks` or `signal`), because "stopped for the time
 * budget" and "stopped after two test blocks" are very different runs.
 *
 * `translated` is every block this run wrote; `tm_reused` + `llm_translated`
 * split it into the part the memory answered and the part the model answered.
 * They add up to `translated`, and only `llm_translated` was paid for.
 */
function emitTranslateSummary({run, pending, client, json, pendingComments = null}) {
  const stopped = run.error ? 'error' : run.stopped ? 'budget' : 'done';
  // A comment line is prose waiting for translation too: the deploy gate reads
  // `pending`, so it must not reach zero while an English comment is still on
  // the page.
  const pendingUnits = pending.units + (pendingComments ?? 0);
  const payload = {
    translated: run.blocks + run.tmReused,
    tm_reused: run.tmReused,
    llm_translated: run.blocks,
    pending: pendingUnits,
    stopped,
    titles: run.titles,
    sidebar_labels: run.labels,
    comments: run.comments,
    pending_blocks: pending.blocks,
    pending_titles: pending.titles,
    pending_sidebar_labels: pending.labels,
    pending_descriptions: pending.descriptions,
    pending_comments: pendingComments,
    pages: run.pages,
    limit: run.limit,
    block_errors: run.blockErrors,
    image_alignment_warning: run.imageWarnings.length,
    image_alignment_warnings: run.imageWarnings,
    script_warning: run.scriptWarnings.length,
    script_warnings: run.scriptWarnings,
    tokens: client ? {prompt: client.usage.prompt, completion: client.usage.completion} : null,
    error: run.error
      ? {code: run.error.code ?? null, status: run.error.status ?? null, message: run.error.message}
      : null,
  };
  if (json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return payload;
  }
  progress.write(
    `translated blocks=${payload.translated} (llm=${payload.llm_translated} ` +
      `tm=${payload.tm_reused}) titles=${payload.titles} ` +
      `sidebar_labels=${payload.sidebar_labels} comments=${payload.comments} ` +
      `pending_descriptions=${payload.pending_descriptions} ` +
      `pages=${payload.pages} pending=${payload.pending} stopped=${stopped}` +
      `${run.limit ? ` limit=${run.limit}` : ''}` +
      ` script_warning=${payload.script_warning}` +
      `${payload.tokens ? ` tokens(prompt/completion)=${payload.tokens.prompt}/${payload.tokens.completion}` : ''}\n`,
  );
  for (const warning of run.scriptWarnings.slice(0, 20)) {
    progress.write(
      `  script_warning ${warning.kind} ${warning.file ?? '?'}: ` +
        `${warning.forms.join('；')} — ${warning.sample}\n`,
    );
  }
  return payload;
}


const ENGLISH_WORD = /[A-Za-z]{3,}/;
const CODE_LINE = /^\s*(```+|~~~+)/;

/**
 * Does this block contain natural language a translator must render?
 *
 * Inline code, fenced code, link/image targets, HTML/MDX tags and bare URLs are
 * removed first; a Latin word of three letters or more that survives is prose.
 * An identity reply for such a block is a failed translation, not a proper-noun
 * decision, so it is retried once and then reported as an error — it must not
 * enter `keep-english.json`, or the page would silently ship English prose.
 */
function hasTranslatableProse(block) {
  const stripped = String(block)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  return ENGLISH_WORD.test(stripped);
}

/**
 * Text segments of a body, with every complete admonition kept as one part.
 *
 * The unit is `splitBlockSpans`, the same one `apply` and `verify` use. This
 * function used to re-implement the split on blank lines and to *skip* any part
 * that contained a fence line, so a paragraph the 7.25 capture glued directly
 * above a fence ("Example `connection-tracking-mode` configuration:" followed by
 * ``` with no blank line) was never queued, and a fence with a blank line inside
 * it produced two half-fence parts that were both skipped. Both shapes are now
 * ordinary blocks: the fence is one code block, the prose around it is prose.
 *
 * Every part is byte-addressable: the separators between blocks are their own
 * parts, so re-joining reproduces the body and a translated part can be swapped
 * back in without touching a single fence byte.
 */
function planParts(body) {
  const parts = [];
  let cursor = 0;
  for (const span of splitBlockSpans(body)) {
    if (span.start > cursor) parts.push({kind: 'sep', value: body.slice(cursor, span.start)});
    parts.push({
      kind: 'text',
      value: body.slice(span.start, span.end),
      admonition: Boolean(splitAdmonitions(span.text)),
      code: span.code,
    });
    cursor = span.end;
  }
  if (cursor < body.length) parts.push({kind: 'sep', value: body.slice(cursor)});
  // Re-joining must reproduce the page exactly; a drift here would rewrite
  // whitespace on every translated page.
  if (parts.map((part) => part.value).join('') !== body) {
    throw new Error('planParts lost bytes');
  }
  return parts;
}

/**
 * An admonition whose body still carries English paragraph(s) next to Chinese.
 *
 * The unit is the whole container: sending the mixed text makes the model return
 * one consistent translation, and `processItem` stores it under the English
 * source block, so `apply` can replace the mixed container.
 */
function isPartlyEnglishAdmonition(text) {
  const parts = splitAdmonitions(text);
  if (!parts || !parts.tail) return false;
  const english = (value) => {
    const flat = String(value).replace(/\s+/g, ' ').trim();
    if (!flat || CJK.test(languageText(flat))) return false;
    return (flat.match(/[A-Za-z]{2,}/g) || []).length >= 5;
  };
  // A command sample inside the warning is not prose. Counting it would make
  // every translated fenced admonition look "partly English" forever, so each
  // run would re-send it.
  const code = codeParagraphs(parts.body);
  return (
    bodyParagraphs(parts.body).some((paragraph) => !code.has(paragraph) && english(paragraph)) ||
    english(parts.title || '')
  );
}

/** Text segments of a body that are still English prose (fence-aware). */
function pendingSegments(body) {
  // A `must_translate` heading is a unit of its own, even when it is one token
  // (isTranslatableProse rejects `## Configuration`). Split it off before the
  // gate so a glued paragraph is not re-sent with it; see lib/headings.mjs.
  const parts = splitMustTranslateHeadingParts(planParts(body));
  const indices = [];
  const blocks = [];
  const admonitions = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.kind === 'sep') continue;
    // A fenced block is code, never a translation unit; `planParts` guarantees a
    // part never mixes code with prose.
    if (part.code) continue;
    const text = part.value;
    // A half-English admonition is invisible to `isTranslatableProse` (the part
    // already contains Chinese), so the very warning that `verify` reports could
    // never be queued. Treat it as a unit to translate as a whole.
    // `must_translate` is a data decision made before every exemption, so a
    // forced heading reaches the queue even though the prose test (and the
    // keep-English ledger below) would otherwise exclude it. Keep the exact
    // same priority `verify` uses through lib/headings.mjs.
    if (
      !isTranslatableProse(text) &&
      !isPartlyEnglishAdmonition(text) &&
      !isMustTranslateHeading(text)
    ) {
      continue;
    }
    indices.push(i);
    blocks.push(text);
    // Admonitions are counted apart from prose so a run can say how many warning
    // bodies are waiting, instead of hiding them inside the block total.
    if (isTranslatableAdmonition(text)) admonitions.push(text);
  }
  return {parts, indices, blocks, admonitions};
}

let planTm = null;
/**
 * Blocks that stay English on purpose, shared with CI through
 * `work/translate/keep-english.json` (see `lib/keep-english.mjs`).
 *
 * Without this ledger a standalone checkout (no 26 MB model memory, no 19 MB
 * legacy TM) would re-send every identity block on every batch, so those pages
 * would stay `partial` forever and `pending` could never reach zero.
 */
let planLocks = new Set();
/** Page titles the model answered with the English title (proper nouns). */
let planTitleLocks = new Set();
/** Sidebar labels the model answered with the English label (proper nouns). */
let planLabelLocks = new Set();
/** Where progress lines go: stdout, or stderr under `--json`. */
let progress = process.stdout;

/** Blocks listed in config/force-translate.yml are never skipped as identity. */
function forcedBlocks() {
  const file = path.join(REPO, 'config/force-translate.yml');
  if (!fs.existsSync(file)) return new Set();
  const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return new Set((parsed.blocks || []).map((block) => normalize(String(block))));
}

let forcedCache = null;
function forcedSet() {
  forcedCache = forcedCache || forcedBlocks();
  return forcedCache;
}

/**
 * The deliberately-English prefixes, read once like `forcedSet()`.
 *
 * `translate verify` already skips blocks matching these prefixes; the planner
 * must use the same list or a regulatory paragraph written in French/Russian by
 * the manufacturer stays "pending" forever. One cache per process: planning
 * visits thousands of blocks, so re-reading the YAML per block is wasteful.
 */
let englishOnlyCache = null;
function englishOnlySet() {
  englishOnlyCache = englishOnlyCache || englishOnlyPrefixes();
  return englishOnlyCache;
}

/**
 * Load what the planner needs to decide "is this block still work?".
 *
 * The legacy TM is optional: a fresh CI checkout commits only the small state
 * (locks, run journal, comment memory, `state/translation-state.json`) and keeps
 * the 26 MB model memory and 19 MB legacy TM out of the repository, because the
 * overlays under `i18n/` are the source of truth. A missing TM is therefore a
 * warning, never a failure.
 *
 * A locale repo such as zh-Hant commits no `translation-memory.json` at all but
 * DOES commit `shards/*.json`; those now build a usable global memory. Only a
 * repo with no legacy AND no shards/model/comment memory has a truly empty TM,
 * and even then planning continues from the overlays and locks.
 */
function preparePlan({locale, modelMemory = null} = {}) {
  const legacyFile = path.join(WORK_DIR, 'translation-memory.json');
  planTm = createGlobalTm({workDir: WORK_DIR, locale});
  if (planTm.entries.size === 0) {
    process.stderr.write(
      `note: no translation memory for ${locale} (no legacy, model, shards or comment memory); ` +
        `planning from the overlays and ${relative(WORKSPACE, LOCKS_FILE)} only\n`,
    );
  } else if (!fs.existsSync(legacyFile)) {
    process.stderr.write(
      `note: ${relative(WORKSPACE, legacyFile)} is absent; built a global memory from ` +
        `shards + comment memory for ${locale} (${planTm.entries.size} entries)\n`,
    );
  }
  // Only pay for the 26 MB model memory when the small ledger has to be seeded.
  const seedFrom = fs.existsSync(LOCKS_FILE)
    ? null
    : modelMemory || (fs.existsSync(path.join(WORK_DIR, 'model-memory.json'))
      ? loadModelMemory()
      : null);
  const locks = loadLocks({
    seedFrom,
    warn: (message) => process.stderr.write(`note: ${message}\n`),
  });
  planLocks = locks.blocks;
  planTitleLocks = locks.titles;
  planLabelLocks = locks.labels || new Set();
  return {
    tm: planTm,
    locks: planLocks,
    titleLocks: planTitleLocks,
    labelLocks: planLabelLocks,
  };
}

/**
 * Is this block deliberately English?
 *
 * `config/force-translate.yml` can force a block back into the queue; a page
 * patch can pin its wording; the `config/english-only-blocks.yml` prefixes, the
 * keep-English ledger and the TM identity entries say the model has nothing
 * better to offer. The prefix list is shared with `translate verify`, so both
 * gates agree on what is intentionally non-English.
 */
function keepEnglishBlock(block, patch) {
  const key = normalize(block);
  if (forcedSet().has(key)) return false;
  // Official local-language regulatory paragraphs (French ISED notices, Russian
  // and Ukrainian update warnings) sit inside English source pages. They are not
  // untranslated English prose. Sentence-specific prefixes keep real English
  // blocks in the queue.
  if (englishOnlySet().some((prefix) => String(block).startsWith(prefix))) return true;
  // An identity memory entry means "technical notation, keep English". A warning
  // that carries prose and a command sample is not notation: the entry is a
  // failed earlier attempt (or the same English block remembered under another
  // version), and skipping it is how 7.25 stayed English after `docs` had
  // already been translated.
  if (isFencedAdmonition(block)) return false;
  if (patch && patch.keepEnglish.has(key)) return true;
  if (planLocks.has(key)) return true;
  if (!planTm) return false;
  const value = lookupBlock(planTm, block);
  return value !== null && normalize(value) === normalize(block);
}

/**
 * The translation memory's answer for one planned block, or null.
 *
 * This is the lookup `apply` and `derive` already use (`lookupBlockLines`): the
 * key is `normalize(english)`, so link targets, image paths and the
 * `/docs/7.25/`-style version prefix a capture leaves in a table cell are
 * blanked before the comparison. That is what lets one version tree answer for
 * the others — the same paragraph in `docs` and in every `docs-<version>` tree
 * differs only in those targets, so a block translated once is reused instead of
 * being sent to the model again and coming back with different wording.
 *
 * An identity entry ("the translation is the English") is *not* a reuse: that is
 * the keep-English decision `keepEnglishBlock` owns, and writing it here would
 * mark prose as translated. A block pinned by `config/force-translate.yml` must
 * reach the model for the same reason, so identity stays null.
 *
 * The wording must also already be in this locale's writing system. The merged
 * store is per locale, but an entry can still come from a page that was copied
 * between branches, and a reuse writes bytes no retry can correct (the block is
 * no longer English, so nothing looks at it again). A wrong-script answer is
 * therefore skipped and the block goes to the model, exactly as if the memory
 * had missed.
 */
function tmBlockTranslation(block, locale = DEFAULT_TARGET_LOCALE) {
  if (!planTm) return null;
  const value = lookupBlockLines(planTm, block);
  if (value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (normalize(text) === normalize(block)) return null;
  if (scriptIssues(text, locale).length) return null;
  return text;
}

/**
 * Which units one run may send: `blocks`, `title`, or both.
 *
 * A full run used to mean every pending unit in every section, which is the
 * right default for a fresh release but the wrong tool for a targeted repair:
 * a page whose title is still English and a page whose warning is still English
 * are different jobs with different costs. `--kinds` narrows the plan without
 * touching what `apply` / `derive` read.
 */
function parseKinds(raw) {
  // `comments` and `images` default on: a batch is supposed to leave the
  // overlay structurally aligned, and comment lines are prose too. `--kinds`
  // is for narrowing a targeted repair (for example `--kinds=blocks`), so an
  // explicit list only enables what it names.
  if (!raw || raw === true) {
    return {blocks: true, title: true, labels: true, comments: true, images: true, descriptions: true};
  }
  const names = String(raw)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) {
    return {blocks: true, title: true, labels: true, comments: true, images: true, descriptions: true};
  }
  const has = (name, alias = null) =>
    names.includes(name) || (alias !== null && names.includes(alias));
  return {
    blocks: has('blocks'),
    title: has('title', 'titles'),
    // `sidebar_label` is a front-matter unit next to the title; the CLI knows it
    // as `labels` and as the explicit `sidebar-labels`.
    labels: has('labels', 'sidebar-labels'),
    comments: has('comments'),
    images: has('images'),
    descriptions: has('descriptions'),
  };
}

/**
 * The proper-noun whitelist of one locale, built once per process.
 *
 * `buildWhitelist` reads `config/glossary/<locale>.yml`; planning visits every
 * page of every section, so the file is read once and reused.
 */
const whitelistByLocale = new Map();
function whitelistFor(locale) {
  const key = locale || DEFAULT_TARGET_LOCALE;
  if (!whitelistByLocale.has(key)) whitelistByLocale.set(key, buildWhitelist(key));
  return whitelistByLocale.get(key);
}

function planSection(
  section,
  {
    limit,
    only,
    files,
    kinds = {blocks: true, title: true, labels: true},
    locale = section.locale || DEFAULT_TARGET_LOCALE,
  },
) {
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  // The gate (`verify`) and this planner must use one description verdict; the
  // English-only console prefixes are read once for the whole section.
  const descriptionEnglishOnly = englishOnlySet();
  const items = [];
  for (const sourcePath of walkMarkdown(sourceBase)) {
    const rel = relative(sourceBase, sourcePath);
    if (only && rel !== only) continue;
    if (files && files.size && !files.has(rel)) continue;
    // Whole-page exclusions never become work: no block/title/label/description
    // reaches the model, and no Chinese TM entry is consulted for this page.
    if (isTranslationExcluded(section, rel)) continue;
    const overlayPath = path.join(overlayBase, rel);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const {frontMatter: sourceFm, body: sourceBody} = splitFrontMatter(source);
    const overlay = fs.existsSync(overlayPath)
      ? fs.readFileSync(overlayPath, 'utf8')
      : renderDocument(sourceFm, sourceBody);
    const {frontMatter: overlayFm, body: overlayBody} = splitFrontMatter(overlay);
    const patch = loadPatch(locale, section.name, rel);
    const planned = pendingSegments(overlayBody);
    const parts = planned.parts;
    const indices = planned.indices;
    // must_translate outranks every exemption (keep-english.json, page patches
    // and TM identity entries), matching verify's headingTranslationVerdict.
    const skip = (block) => (isMustTranslateHeading(block) ? false : keepEnglishBlock(block, patch));
    const blocks = kinds.blocks ? planned.blocks.filter((block) => !skip(block)) : [];
    const admonitionBlocks = blocks.filter((block) => isTranslatableAdmonition(block));
    // Reported apart: these are the warnings that used to be invisible because
    // the whole block was classified as code.
    const fencedAdmonitions = blocks.filter((block) => isFencedAdmonition(block)).length;
    if (planned.blocks.length !== blocks.length || (patch && patch.keepEnglish.size)) {
      // keep the indices aligned with the filtered block list
      const kept = [];
      for (const index of planned.indices) {
        if (!skip(parts[index].value)) kept.push(index);
      }
      indices.length = 0;
      indices.push(...kept);
    }
    const cliPage = isDocsSection(section) && rel.startsWith('cli-reference/');
    const title = readField(overlayFm, 'title');
    // A hardware model in `config/glossary` / `config/technical-headings.yml` is
    // data, not prose: the planner never sends it to the model, and a previous
    // run's Chinese wording is repaired back to the configured spelling on the
    // next pass. The English source, not the possibly polluted overlay, decides.
    const sourceTitle = readField(sourceFm, 'title');
    const canonicalTitle = canonicalProductName(sourceTitle || title, locale);
    const productTitleRepair =
      canonicalTitle && normalize(title || '') !== normalize(canonicalTitle) ? canonicalTitle : null;
    const needsTitle = Boolean(
      kinds.title &&
        !canonicalTitle &&
        !(patch && patch.title) &&
        !planTitleLocks.has(normalize(title || '')) &&
        !cliPage &&
        title &&
        !CJK.test(title) &&
        !/^[a-z0-9/._-]+$/.test(title),
    );
    // `sidebar_label` is the text the sidebar renders, and Docusaurus prefers it
    // over the translated catalogue, so an English label is an English sidebar
    // entry even on a fully translated page. It is planned like the title: a
    // command name (`cli-reference/`) and a proper noun are policy, not work.
    const labelEnglish = readField(overlayFm, 'sidebar_label') ?? readField(sourceFm, 'sidebar_label');
    const canonicalLabel = canonicalProductName(
      readField(sourceFm, 'sidebar_label') || labelEnglish,
      locale,
    );
    const productLabelRepair =
      canonicalLabel && normalize(labelEnglish || '') !== normalize(canonicalLabel)
        ? canonicalLabel
        : null;
    const needsLabel = Boolean(
      kinds.labels &&
        !canonicalLabel &&
        !cliPage &&
        labelEnglish &&
        !(patch && patch.sidebar_label) &&
        !planLabelLocks.has(normalize(labelEnglish)) &&
        needsSidebarLabelTranslation(labelEnglish, {
          rel,
          whitelist: whitelistFor(locale),
        }),
    );
    // A description copied from the English front matter (or left blank) is a
    // pending unit too. Counting it here — not in `verify` — makes the gate see
    // a page whose body is fully translated but whose metadata is still English.
    const sourceDescription = readField(sourceFm, 'description');
    const overlayDescription = readField(overlayFm, 'description');
    // One shared verdict with `verify.descriptionVerdict`: blank, copied or
    // still-English prose is pending; model-dense values and the English-only
    // console prefixes are intentional and must not be queued or counted.
    const needsDescription = Boolean(
      kinds.descriptions &&
        needsDescriptionTranslation(sourceDescription, overlayDescription, descriptionEnglishOnly),
    );
    if (
      blocks.length === 0 &&
      !needsTitle &&
      !needsLabel &&
      !needsDescription &&
      !productTitleRepair &&
      !productLabelRepair
    ) {
      continue;
    }
    items.push({
      rel,
      overlayPath,
      sourceBody,
      // Kept so `processItem` can record the page's source fingerprint and its
      // block fingerprints in the state; the refresh pass compares them.
      sourceRaw: source,
      sourceSha: sha256Hex(source),
      // `processItem` reads `item.sourceFm` for the front-matter `description`
      // (see the description branch there). Without it `readField(undefined,
      // 'description')` returns null and that branch can never fire, so a run
      // with `--kinds=descriptions` planned the page but sent no request.
      sourceFm,
      overlayFm,
      overlayBody,
      parts,
      indices,
      blocks,
      admonitions: admonitionBlocks.length,
      fencedAdmonitions,
      admonitionSamples: admonitionBlocks.slice(0, 2).map((block) => block.split('\n')[0].trim()),
      needsTitle,
      title,
      productTitleRepair,
      needsLabel,
      label: labelEnglish,
      productLabelRepair,
      needsDescription,
      description: overlayDescription,
    });
    if (limit && items.length >= limit) break;
  }
  return items;
}

/**
 * How much translation work is left, over every section of one locale.
 *
 * This is the number the deploy gate reads, and it is deliberately the *same*
 * plan `translate` would execute: pending blocks (`item.blocks`, already
 * filtered by the keep-English locks and the TM) plus pages whose title is still
 * English. `verify` answers a different question — it reports
 * `untranslatedBlocks` / `untranslatedAdmonitions` over *prose paragraphs and
 * admonitions* only, skipping lines that start with `#`, `<` or `|` — so it
 * under-counts (headings and tables never appear), so `pending` and
 * `verify` are complementary gates: `verify` now also fails on the prose
 * blocks it does see, while `pending` covers the units it cannot see.
 *
 * `pageList` names the pages behind the count (`section`, `path`, `blocks`,
 * `title`) so CI can say *which* pages are still English. It is capped at
 * `PAGE_LIST_LIMIT` rows; `pageListTruncated` says whether the cap was hit.
 * `state/translation-state.json` is **not** a substitute: its `pendingBlocks`
 * also counts blocks kept in English on purpose and does not go to zero.
 */
const PAGE_LIST_LIMIT = 5000;

function countPending(sections) {
  const bySection = {};
  const pageList = [];
  let pageListTruncated = false;
  let blocks = 0;
  let titles = 0;
  let labels = 0;
  let descriptions = 0;
  let pages = 0;
  for (const section of sections) {
    const items = planSection(section, {
      limit: 0,
      kinds: {blocks: true, title: true, labels: true, descriptions: true},
    });
    let sectionBlocks = 0;
    let sectionTitles = 0;
    let sectionLabels = 0;
    let sectionDescriptions = 0;
    for (const item of items) {
      sectionBlocks += item.blocks.length;
      if (item.needsTitle) sectionTitles += 1;
      if (item.needsLabel) sectionLabels += 1;
      if (item.needsDescription) sectionDescriptions += 1;
      if (item.blocks.length > 0 || item.needsTitle || item.needsLabel || item.needsDescription) {
        pages += 1;
        if (pageList.length < PAGE_LIST_LIMIT) {
          pageList.push({
            section: section.name,
            path: item.rel,
            blocks: item.blocks.length,
            title: item.needsTitle,
            sidebar_label: item.needsLabel,
            description: item.needsDescription,
          });
        } else {
          pageListTruncated = true;
        }
      }
    }
    blocks += sectionBlocks;
    titles += sectionTitles;
    labels += sectionLabels;
    descriptions += sectionDescriptions;
    if (sectionBlocks > 0 || sectionTitles > 0 || sectionLabels > 0 || sectionDescriptions > 0) {
      bySection[section.name] = {
        blocks: sectionBlocks,
        titles: sectionTitles,
        sidebar_labels: sectionLabels,
        descriptions: sectionDescriptions,
      };
    }
  }
  return {
    blocks,
    titles,
    labels,
    descriptions,
    pages,
    units: blocks + titles + labels + descriptions,
    bySection,
    pageList,
    pageListTruncated,
  };
}

/**
 * Align every overlay's image references with its English source.
 *
 * This is the pass that fixes a page whose *only* change was an image: the
 * translation batch never plans such a page (there is no English left in the
 * overlay), so without this it would keep a stale picture set until some text
 * changed. Only image Markdown is touched; prose and fences stay byte-identical.
 * It also removes overlay files whose source page was deleted, because a
 * leftover page renders at a route the English site no longer has.
 */
function alignOverlayImages(sections, {dryRun = false, only = null, files = null, run = null, progress = process.stdout} = {}) {
  const summary = {pages: 0, changed: 0, added: 0, removed: 0, replaced: 0, warnings: 0, orphans: 0, orphansRemoved: 0};
  for (const section of sections) {
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    const sourceRels = new Set(walkMarkdown(sourceBase).map((file) => relative(sourceBase, file)));
    for (const rel of sourceRels) {
      if (only && rel !== only) continue;
      if (files && files.size && !files.has(rel)) continue;
      const overlayPath = path.join(overlayBase, rel);
      if (!fs.existsSync(overlayPath)) continue;
      if (isPreservedOverlay(rel, section.name)) continue;
      summary.pages += 1;
      const source = fs.readFileSync(path.join(sourceBase, rel), 'utf8');
      const target = fs.readFileSync(overlayPath, 'utf8');
      const {body: sourceBody} = splitFrontMatter(source);
      const {frontMatter, body} = splitFrontMatter(target);
      // A page-relative source URL must be rebased onto the overlay's location;
      // passing both directories also lets the aligner recognise the already
      // rebased form of the same asset instead of rewriting it every run.
      const aligned = imageAlignment(sourceBody, body, {
        sourceDir: path.posix.dirname(`${section.source}/${rel}`),
        overlayDir: `${section.overlay}/${rel}`,
      });
      for (const warning of aligned.warnings) {
        summary.warnings += 1;
        run?.recordImageWarning({file: `${section.name}/${rel}`, reason: warning.reason, url: warning.url});
      }
      if (aligned.body !== body) {
        summary.changed += 1;
        summary.added += aligned.added;
        summary.removed += aligned.removed;
        summary.replaced += aligned.replaced;
        if (!dryRun) writeFileAtomic(overlayPath, renderDocument(frontMatter, aligned.body));
        if (dryRun) {
          progress.write(
            `${section.name}/${rel}: images ${images(sourceBody).length} -> ${images(body).length} ` +
              `(+${aligned.added} -${aligned.removed} ~${aligned.replaced})\n`,
          );
        }
      }
    }
    // A page the source dropped must not survive as an overlay: `verify`
    // reports it as `extra` and the build publishes a route that no longer
    // exists upstream. Filters (`--file`/`--files`) disable pruning so a
    // targeted run cannot delete the rest of the tree.
    if (!only && !(files && files.size) && fs.existsSync(overlayBase)) {
      for (const overlayFile of walkMarkdown(overlayBase)) {
        const rel = relative(overlayBase, overlayFile);
        if (sourceRels.has(rel)) continue;
        summary.orphans += 1;
        if (!dryRun) {
          fs.rmSync(overlayFile);
          summary.orphansRemoved += 1;
        }
      }
    }
  }
  return summary;
}

/**
 * Write comments already in the comment memory into the overlays.
 *
 * `translateComments` only fills `work/translate/comment-memory.json`; without
 * this pass the memory entry would never reach the page, so a comment batch
 * would look successful while the overlay still carried English. Only
 * line-leading `#` comments approved by `classifyComment` are rewritten.
 */
function applyCommentTranslations(sections, {dryRun = false, only = null, files = null} = {}) {
  const memory = loadCommentMemory();
  const summary = {pages: 0, changed: 0, hits: 0, misses: 0};
  for (const section of sections) {
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      if (only && rel !== only) continue;
      if (files && files.size && !files.has(rel)) continue;
      const overlayPath = path.join(overlayBase, rel);
      if (!fs.existsSync(overlayPath)) continue;
      if (isPreservedOverlay(rel, section.name)) continue;
      summary.pages += 1;
      const target = fs.readFileSync(overlayPath, 'utf8');
      const {frontMatter, body} = splitFrontMatter(target);
      const applied = translateCodeComments(body, (key) => memory.get(key) ?? null);
      summary.hits += applied.hits;
      summary.misses += applied.misses.length;
      if (applied.body !== body) {
        summary.changed += 1;
        if (!dryRun) writeFileAtomic(overlayPath, renderDocument(frontMatter, applied.body));
      }
    }
  }
  return summary;
}

/**
 * Replace every fenced region of `translated` with the source's bytes.
 *
 * Fence count mismatch (the model invented or dropped a fence) falls back to
 * the whole source block: an English block is acceptable, a corrupted code
 * sample is not.
 */
function keepFences(source, translated) {
  if (!/(^|\n)\s*(```|~~~)/.test(source)) return translated;
  const ranges = (text) => {
    const lines = text.split('\n');
    const mask = fenceMask(text);
    const out = [];
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!mask[i]) {
        if (start !== -1) {
          out.push([start, i - 1]);
          start = -1;
        }
        continue;
      }
      if (start === -1) start = i;
    }
    if (start !== -1) out.push([start, lines.length - 1]);
    return {lines, ranges: out};
  };
  const a = ranges(source);
  const b = ranges(translated);
  if (a.ranges.length !== b.ranges.length) return source;
  const lines = [...b.lines];
  for (let i = 0; i < a.ranges.length; i++) {
    const [from, to] = b.ranges[i];
    const replacement = a.lines.slice(a.ranges[i][0], a.ranges[i][1] + 1);
    lines.splice(from, to - from + 1, ...replacement);
    // Splice shifts later ranges; recompute the offset by the length delta.
    const delta = replacement.length - (to - from + 1);
    for (let j = i + 1; j < b.ranges.length; j++) {
      b.ranges[j][0] += delta;
      b.ranges[j][1] += delta;
    }
  }
  return lines.join('\n');
}

/**
 * Rebuild a translated admonition around the English container.
 *
 * The model may translate the `:::note` line, drop the closing `:::` or reflow
 * the paragraphs. When its reply still parses as the same container type, the
 * English container and markers are reproduced and only title/body text is taken
 * from the reply; otherwise the English block wins, because half an admonition
 * does not compile.
 */
function restoreAdmonition(english, translated) {
  const source = splitAdmonitions(english);
  if (!source) return translated;
  const target = splitAdmonitions(translated);
  if (!target || target.type !== source.type || target.tail === '') return english;
  const pairs = new Map();
  const add = (from, to) => {
    if (from && to) pairs.set(normalize(from), to);
  };
  add(source.title, target.title);
  const fromBody = bodyParagraphs(source.body);
  const toBody = bodyParagraphs(target.body);
  for (let i = 0; i < Math.min(fromBody.length, toBody.length); i++) add(fromBody[i], toBody[i]);
  return renderAdmonition(source, (text) => pairs.get(normalize(text)) ?? null);
}

/** A complete admonition whose body (or title) carries a fenced code sample. */
function isFencedAdmonition(block) {
  const parts = splitAdmonitions(block);
  return Boolean(parts && parts.tail !== '' && fenceMask(block).some(Boolean));
}

/** A translation usable as one paragraph, or null when it must be retried. */
function acceptsUnit(original, translated) {
  const value = String(translated ?? '').trim();
  if (!value || value === original) return null;
  // A translation carries Chinese. The model occasionally answers with an
  // English paraphrase or with the source plus a note ("Wait — I need to
  // translate. Let me output …"); neither is a translation, and writing it into
  // the page leaves English prose that the counters cannot see.
  if (!/[\u4e00-\u9fff]/.test(value)) return null;
  // One unit is one paragraph: a blank line inside the reply would split the
  // admonition body, and a fence would inject code into the container.
  if (/\n[ \t]*\n/.test(value)) return null;
  if (/(^|\n)\s*(?:`{3,}|~{3,})/.test(value)) return null;
  return value;
}

/** Translate one paragraph; one stricter retry when the reply is unusable. */
async function translateUnit(unit, client, {locale = DEFAULT_TARGET_LOCALE, file = null, run = null} = {}) {
  const guard = (text) =>
    guardScript({
      client,
      text,
      locale,
      file,
      kind: 'admonition',
      rewrite: (value) => acceptsUnit(unit, value),
      record: (warning) => recordScriptWarning(run, warning),
    });

  const first = acceptsUnit(unit, await client.chat(unit));
  if (first) return (await guard(first)).text;
  const retry = acceptsUnit(unit, await client.chat(paragraphRetryPrompt(locale, unit)));
  if (!retry) return null;
  return (await guard(retry)).text;
}

/**
 * Translate one warning that carries a code sample, unit by unit.
 *
 * Sending the whole `:::note … :::` block to the model hands it the command
 * inside the warning, and the model does translate command labels. The
 * container, the closing `:::` and every fenced paragraph are structure; only
 * the title and prose paragraphs are language. `renderAdmonition` already draws
 * that line when rebuilding, so the unit list is taken from it (by recording
 * the callbacks) instead of duplicating the rule here.
 */
async function translateFencedAdmonition(block, client, context = {}) {
  const parts = splitAdmonitions(block);
  if (!parts) return block;
  const units = [];
  renderAdmonition(parts, (unit) => {
    units.push(unit);
    return null;
  });
  const code = codeParagraphs(parts.body);
  const translations = new Map();
  for (const unit of units) {
    if (code.has(unit)) continue;
    const translated = await translateUnit(unit, client, context);
    if (translated) translations.set(unit, translated);
  }
  if (translations.size === 0) return block;
  return renderAdmonition(parts, (unit) => translations.get(unit) ?? null);
}

/** Provider failures that must fail the run instead of skipping one page. */
const FATAL_PROVIDER_CODES = new Set([
  // No key, no money, no permission, or a quota/rate limit that survived the
  // retry budget: retrying the next page cannot help, and a batch that quietly
  // skips every page would look like a run with nothing to do.
  'unauthorized',
  'payment_required',
  'forbidden',
  'rate_limited',
]);

function isFatalProviderError(error) {
  return error instanceof LLMRequestError && FATAL_PROVIDER_CODES.has(error.code);
}

/**
 * One `translate` invocation: its caps and what it actually finished.
 *
 * `room()` is the single place that decides "may I send another unit?": it
 * reports 0 once the time budget or the unit cap is exhausted, so every loop in
 * `processItem` stops before the next request rather than after it. A page that
 * was already partly translated keeps what it has — the caller writes it.
 *
 * `stopped` is the internal reason (`budget`, `error`, or null for "the plan was
 * exhausted"); the JSON summary collapses the two cap kinds into `"budget"` and
 * names the exact cap in `limit`.
 */
function createRun({budgetMinutes = null, maxBlocks = null} = {}) {
  // One instant for `started_at` and `deadline`: the checkpoint's headroom is
  // computed from the same start, so the two records cannot disagree by the
  // few milliseconds between two Date.now() calls.
  const startedAt = new Date();
  const startedMs = startedAt.getTime();
  const deadline = budgetMinutes === null ? Infinity : startedMs + budgetMinutes * 60000;
  const run = {
    startedAt,
    budgetMinutes,
    maxBlocks,
    deadline,
    /** Wall-clock stop timer (see armBudgetGuard); cleared on every final stop. */
    budgetTimer: null,
    blocks: 0,
    titles: 0,
    labels: 0,
    comments: 0,
    pages: 0,
    /**
     * Blocks written from the translation memory instead of the provider.
     *
     * Counted apart from `blocks` (which stays "what the model translated"):
     * a reuse costs no request and no `--max-blocks` unit, so mixing the two
     * would make the budget meaningless and hide how much of a run was free.
     */
    tmReused: 0,
    stopped: null,
    limit: null,
    error: null,
    locks: planLocks,
    titleLocks: planTitleLocks,
    labelLocks: planLabelLocks,
    locked: false,
    /** Blocks whose English came back unchanged although they carry prose. */
    blockErrors: [],
    /** Answers that still failed the locale's script check after the retry. */
    scriptWarnings: [],
    /** Images that could not be aligned safely (see `imageAlignment`). */
    imageWarnings: [],
    lastMemorySave: Date.now(),
    /** Set by the translate command: the explicit checkpoint record for this run. */
    checkpoint: null,
    /** Recomputes the planner's pending counts, used at each page checkpoint. */
    recomputePending: null,
  };
  run.room = () => {
    if (run.stopped) return 0;
    // Stop at `deadline - lead`, not at the deadline. A request already in
    // flight cannot be interrupted here, but no *new* request may be opened
    // once this guard has fired; the wall-clock timer does the same even when
    // no loop happens to call room() before the deadline.
    if (Date.now() >= run.deadline - BUDGET_STOP_LEAD_MS) {
      run.stopped = 'budget';
      run.limit = 'budget-minutes';
      // Record the stop the instant it is known, not only at the next page:
      // a runner kill right after the deadline must still leave a valid proof.
      finalizeCheckpoint(run);
      return 0;
    }
    if (run.maxBlocks !== null) {
      // A front-matter field costs one request like a block does, so it is a
      // unit of the same budget.
      const left = run.maxBlocks - (run.blocks + run.titles + run.labels);
      if (left <= 0) {
        run.stopped = 'budget';
        run.limit = 'max-blocks';
        finalizeCheckpoint(run);
        return 0;
      }
      return left;
    }
    return Infinity;
  };
  run.countBlocks = (count) => {
    run.blocks += count;
  };
  run.countTmReused = (count) => {
    run.tmReused += count;
  };
  run.countTitle = () => {
    run.titles += 1;
  };
  run.countLabel = () => {
    run.labels += 1;
  };
  run.countComments = (count) => {
    run.comments += count;
  };
  run.lock = (key) => {
    if (run.locks.has(key)) return;
    run.locks.add(key);
    run.locked = true;
  };
  run.lockTitle = (title) => {
    const key = normalize(title);
    if (!key || run.titleLocks.has(key)) return;
    run.titleLocks.add(key);
    run.locked = true;
  };
  run.lockLabel = (label) => {
    const key = normalize(label);
    if (!key || run.labelLocks.has(key)) return;
    run.labelLocks.add(key);
    run.locked = true;
  };
  run.recordBlockError = ({file, block, reason}) => {
    if (run.blockErrors.length >= 100) return;
    run.blockErrors.push({
      file,
      reason,
      sample: String(block).replace(/\s+/g, ' ').trim().slice(0, 80),
    });
  };
  run.recordImageWarning = ({file, reason, url}) => {
    if (run.imageWarnings.length >= 100) return;
    run.imageWarnings.push({file: file ?? null, reason, url: url ?? null});
  };
  run.recordScriptWarning = ({file, kind, issues, text}) => {
    if (run.scriptWarnings.length >= 100) return;
    run.scriptWarnings.push({
      file: file ?? null,
      kind: kind || 'block',
      forms: issueSummary(issues).map((issue) => `${issue.form}→${issue.suggestion}`),
      sample: String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
    });
  };
  run.stopError = (error) => {
    if (!run.error) run.error = error;
    run.stopped = 'error';
  };
  return run;
}

/** Counter snapshot shared by the run journal and the checkpoint record. */
function runCounts(run) {
  return {
    translated: run.blocks + run.tmReused,
    llm_translated: run.blocks,
    tm_reused: run.tmReused,
    titles: run.titles,
    labels: run.labels,
    comments: run.comments,
  };
}

/** Internal run state -> checkpoint's stopped vocabulary. */
function stopState(run) {
  if (run.limit === 'signal') return 'signal';
  if (run.error) return 'error';
  if (run.stopped) return 'budget';
  return 'done';
}

/**
 * Open the explicit checkpoint for one translate invocation.
 *
 * The previous run's record is kept only as audit context: the planner is
 * re-derived from overlays + TM on every run, so resuming never depends on an
 * old cursor being exact. A malformed previous checkpoint is a warning, never
 * a reason to avoid starting this batch.
 */
function startCheckpoint(run, {locale, budgetMinutes, maxBlocks, recomputePending}) {
  let previous = null;
  try {
    previous = previousRunOf(readCheckpoint(WORK_DIR));
  } catch (error) {
    process.stderr.write(`warning: previous checkpoint unreadable: ${error.message}\n`);
  }
  const cp = newCheckpoint({
    locale,
    runId: newRunId(run.startedAt),
    startedAt: run.startedAt,
    budgetMinutes,
    maxBlocks,
    pending: recomputePending ? recomputePending() : null,
    tm: tmCounts(WORK_DIR),
    previousRun: previous,
  });
  run.checkpoint = cp;
  run.recomputePending = recomputePending;
  writeCheckpoint(WORK_DIR, cp);
  return cp;
}

/**
 * Wall-clock complement to `room()`.
 *
 * `room()` is only reached between requests, so a single slow batch can carry
 * the run past its deadline before a check happens. Scheduling the stop at
 * `deadline - BUDGET_STOP_LEAD_MS` makes `stopped_ms` truthful (the decision to
 * accept no more work really was made before the deadline) and leaves the
 * request already in flight to finish and flush. The timer is unref'd so an
 * unexpected early exit cannot hang the process, and `finalizeCheckpoint`
 * clears it so a run that ends on `done`/`error`/`signal` leaves nothing behind.
 */
function armBudgetGuard(run) {
  if (!run || !Number.isFinite(run.deadline)) return null;
  // Never wait past the deadline, and keep at least 1 ms of lead.
  const lead = Math.min(BUDGET_STOP_LEAD_MS, Math.max(1, run.deadline - run.startedAt.getTime() - 1));
  const fireAt = run.deadline - lead;
  run.budgetTimer = setTimeout(() => {
    run.budgetTimer = null;
    if (run.stopped) return;
    run.stopped = 'budget';
    run.limit = 'budget-minutes';
    finalizeCheckpoint(run);
  }, Math.max(0, fireAt - Date.now()));
  run.budgetTimer.unref?.();
  return run.budgetTimer;
}

function disarmBudgetGuard(run) {
  if (run?.budgetTimer) {
    clearTimeout(run.budgetTimer);
    run.budgetTimer = null;
  }
}

/** Write the stop record (budget / signal / error / done) once counters settle. */
function finalizeCheckpoint(run) {
  if (!run.checkpoint) return null;
  disarmBudgetGuard(run);
  // Stamp the decision instant BEFORE the audit below. `countPending` walks the
  // whole tree and `tmCounts` reads every shard; `recordStop` defaults `atMs`
  // to Date.now() at *call* time, so without this the recorded stop was seconds
  // late (the -8409/-8971 ms headroom in the 30 s reproduction) even though the
  // guard had fired on time. `recordPage` already does the same with `now`.
  const atMs = Date.now();
  const result = recordStop(run.checkpoint, {
    stopped: stopState(run),
    limit: run.limit,
    counts: runCounts(run),
    tm: tmCounts(WORK_DIR),
    pending: run.recomputePending ? run.recomputePending() : run.checkpoint.pending,
    error: run.error
      ? {code: run.error.code ?? null, status: run.error.status ?? null, message: run.error.message}
      : null,
    atMs,
  });
  writeCheckpoint(WORK_DIR, result);
  return result;
}

/**
 * Flush the three places a batch is remembered.
 *
 * The overlay page itself is written by `processItem` (atomically); this keeps
 * `state/translation-state.json`, the keep-English ledger and — at most every
 * two minutes, because it is 26 MB locally — the model memory in step with it.
 * A runner killed between two checkpoints loses at most one page of memory, not
 * the work already on disk. The fourth flush is `checkpoint.json`: the explicit,
 * human-readable record of cursor / pending / TM / stop reason.
 */
function checkpoint(
  run,
  {state, modelMemory = null, force = false, locale = DEFAULT_TARGET_LOCALE, section = null, item = null},
) {
  writeState(state);
  if (run.locked) {
    saveLocks({blocks: run.locks, titles: run.titleLocks, labels: run.labelLocks});
    run.locked = false;
  }
  const now = Date.now();
  if (modelMemory && (force || now - run.lastMemorySave >= 120000)) {
    // `writeBaseline: false`: the 26 MB baseline is committed to git and a batch
    // must not rewrite it (see `lib/model-memory.mjs`); the shard carries the
    // new keys instead.
    saveModelMemory(modelMemory, {locale, writeBaseline: false});
    run.lastMemorySave = now;
  }
  if (run.checkpoint) {
    // Per-page update: cursor / completed / pending (recomputed from the same
    // planner the deploy gate uses) / durable TM count / elapsed. The next run
    // reads this only as `previous_run`; it replans from disk, so a stale cursor
    // can never make it skip a page that is still English.
    recordPage(run.checkpoint, {
      // A final flush (no `item`) refreshes counters but must not erase the
      // last page's cursor — that is the audit breadcrumb for the next run.
      ...(item
        ? {section: section?.name ?? null, fileRel: item.rel ?? null, pageIndex: run.pages}
        : {}),
      pending: run.recomputePending ? run.recomputePending() : run.checkpoint.pending,
      tm: tmCounts(WORK_DIR),
      counts: runCounts(run),
      atMs: now,
    });
    writeCheckpoint(WORK_DIR, run.checkpoint);
  }
}

/**
 * Wrap a bare RouterOS command word at the start of a translated line in inline
 * code. MDX hands a line-leading `import`/`export` to acorn as an ESM statement
 * and the build dies before rendering ("Could not parse import/exports with
 * acorn"); the other command names are the same class of translator slip.
 *
 * Guards, in order:
 *   - `fenceMask` (the pipeline's canonical fence rule) keeps code samples
 *     byte-identical;
 *   - the word must be followed by a space/tab, so `#### import`, links and
 *     sentences that merely contain the word are untouched;
 *   - the line must carry CJK, so genuine MDX ESM (`export const Anchor = ...`)
 *     and raw CLI examples (`add action=...`) stay verbatim;
 *   - an already-backticked word starts with a backtick and cannot match;
 *   - the rewrite is idempotent (a second pass sees a backtick, not a word).
 */
const LEADING_COMMAND_WORDS = new Set([
  'import', 'export', 'print', 'set', 'add', 'remove', 'delay',
  'ping', 'tool', 'log', 'find', 'get', 'move', 'enable', 'disable',
  'comment', 'reset', 'run', 'monitor', 'test', 'resolve',
]);
const LEADING_COMMAND_RE = /^(\s*)([a-z]+)([ \t]+)/;

export function escapeLeadingCommandWords(body) {
  const mask = fenceMask(body);
  return body
    .split('\n')
    .map((line, i) => {
      if (mask[i]) return line;
      const match = LEADING_COMMAND_RE.exec(line);
      if (!match || !LEADING_COMMAND_WORDS.has(match[2]) || !CJK.test(line)) return line;
      return `${match[1]}\`${match[2]}\`${match[3]}${line.slice(match[0].length)}`;
    })
    .join('\n');
}

async function processItem(section, item, client0, state, modelMemory, commentMemory, run) {
  // Count the provider calls this page really sends. The proxy wraps the shared
  // client so nested retries (script guard, fenced-admonition units) count too,
  // without touching any call site below. A fresh model answer is the strongest
  // provenance signal for this page; reuse hits are counted separately.
  let llmMade = 0;
  const client = new Proxy(client0, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (prop !== 'chat' || typeof value !== 'function') return value;
      return async (...args) => {
        const result = await value.apply(target, args);
        llmMade += 1;
        return result;
      };
    },
  });
  let tmUsed = 0;
  let memoryUsed = 0;
  let body = item.overlayBody;
  let labels = 0;
  let sent = 0;
  /** Blocks of this page the memory answered (part of `sent`, not of `run.blocks`). */
  let reused = 0;
  // Everything below is locale-specific: `--locale` selects the overlay tree,
  // the profile (style, terminology, writing system) and the script check.
  const locale = section.locale || DEFAULT_TARGET_LOCALE;
  const file = `${section.name}/${item.rel}`;
  let titles = 0;
  let stopped = false;
  let failure = null;
  /** Translated front-matter values, filled inside the try and used below. */
  const fields = {};

  // The memory key must be the English *source* block. A warning that is half
  // translated in the overlay cannot be matched by its own text: `apply` and
  // `derive` only ever look up the English block, so a key built from the mixed
  // overlay text is dead on arrival and the English paragraph comes back on the
  // next rebuild. Admonitions keep their source order, so pair them by ordinal
  // and accept the pair only when type and paragraph count agree — a capture
  // that dropped a container can shift the list.
  const sourceAdmonitions = splitBlocks(item.sourceBody).filter((block) => splitAdmonitions(block));
  const overlayAdmonitions = splitBlocks(item.overlayBody).filter((block) => splitAdmonitions(block));
  const sourceForKey = (block) => {
    const parts = splitAdmonitions(block);
    if (!parts) return null;
    const ordinal = overlayAdmonitions.findIndex((candidate) => normalize(candidate) === normalize(block));
    const source = ordinal === -1 ? null : sourceAdmonitions[ordinal];
    const sourceParts = splitAdmonitions(source || '');
    if (!sourceParts || sourceParts.type !== parts.type) return null;
    if (bodyParagraphs(sourceParts.body).length !== bodyParagraphs(parts.body).length) return null;
    return source;
  };

  /**
   * Put one finished block back into the page, in place.
   *
   * `item.parts` is the page split into separators and blocks, so assigning the
   * block's own part and re-joining reproduces every other byte. That is what
   * lets a stop in the middle of a page persist the blocks already paid for
   * without rewriting the rest of the page from scratch.
   */
  const applyBlock = (offset, text) => {
    item.parts[item.indices[offset]].value = text;
    sent += 1;
    const block = item.blocks[offset];
    if (modelMemory) {
      modelMemory.set(`${section.name}\u0000${normalize(block)}`, text.trim());
      const source = sourceForKey(block);
      if (source) modelMemory.set(`${section.name}\u0000${normalize(source)}`, text.trim());
    }
    // An identity reply is the model saying "this is notation, keep English".
    // Remembering it here is what stops the next batch (and CI, which has no
    // model memory) from paying for the same block again and never converging.
    // A block that carries prose is *not* notation: it is a failed translation,
    // reported by the caller and left pending, never locked.
    if (normalize(text) === normalize(block) && !hasTranslatableProse(block)) {
      run.lock(normalize(block));
    }
    body = item.parts.map((part) => part.value).join('');
  };

  // Everything that talks to the provider is inside one `try`: a 402 halfway
  // through a page must still write the blocks that page already paid for (the
  // page write below is atomic), so the next batch continues instead of
  // re-buying them.
  // The memory is asked once per planned block, before the first request. A hit
  // is written and never queued, so it costs no request and no `--max-blocks`
  // unit; the queue below only ever carries misses.
  const tmHits = item.blocks.map((block) => tmBlockTranslation(block, locale));
  try {
    if (item.blocks.length > 0) {
      // One request per batch: a page with a huge table exceeds what the endpoint
      // accepts if every block is sent at once ("fetch failed").
      const batchSize = Math.max(1, client.config?.batchSize || 8);
      while (sent < item.blocks.length) {
        // A memory hit is applied before the budget is consulted: the run must
        // not stop one block short of a page it can finish for free, and a
        // stopped run must not leave a reusable block English.
        if (tmHits[sent] !== null) {
          applyBlock(sent, tmHits[sent]);
          run.countTmReused(1);
          reused += 1;
          tmUsed += 1;
          continue;
        }
        const room = run.room();
        if (room <= 0) {
          stopped = true;
          break;
        }
        // A warning with a code sample is translated by unit, never as one block:
        // the sample must stay byte-identical, and the model would rewrite it.
        if (isFencedAdmonition(item.blocks[sent])) {
          const translated = await translateFencedAdmonition(item.blocks[sent], client, {locale, file, run});
          applyBlock(sent, translated);
          run.countBlocks(1);
          continue;
        }
        const start = sent;
        const batch = [];
        const limit = Number.isFinite(room) ? Math.min(batchSize, room) : batchSize;
        // A batch is a run of *consecutive misses*: a hit inside the run is
        // already translated, so sending it would overwrite the memory's wording
        // with a second opinion.
        while (
          start + batch.length < item.blocks.length &&
          batch.length < limit &&
          tmHits[start + batch.length] === null &&
          !isFencedAdmonition(item.blocks[start + batch.length])
        ) {
          batch.push(item.blocks[start + batch.length]);
        }
        const prompt = batch.join('\n\n');
        let request = prompt;
        let batchPieces = [];
        let scriptRetried = false;
        let scriptProblems = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          const translated = await client.chat(request);
          batchPieces = translated.split(/\r?\n[ \t]*\r?\n/).filter((piece) => piece.trim() !== '');
          if (batchPieces.length !== batch.length) {
            // An admonition carries blank lines inside its own container, so the
            // plain separator split over-counts. Block structure is authoritative
            // and keeps the `:::type … :::` span together.
            const structured = splitBlocks(translated);
            if (structured.length === batch.length) batchPieces = structured;
          }
          if (batchPieces.length !== batch.length) {
            process.stderr.write(
              `retry ${section.name}/${item.rel}: ${batch.length} blocks -> ${batchPieces.length}\n`,
            );
            request = prompt;
            // This attempt's text is unusable, so it says nothing about the
            // script; a previous attempt's issues must not be reported here.
            scriptProblems = [];
            continue;
          }
          // Structure is right; now check the writing system. One feedback retry,
          // then the answer is kept and reported as `script_warning`.
          scriptProblems = scriptIssues(translated, locale);
          if (scriptProblems.length && !scriptRetried) {
            scriptRetried = true;
            process.stderr.write(
              `retry ${section.name}/${item.rel}: ${scriptProblems.length} script issue(s)\n`,
            );
            request = `${prompt}\n\n${feedbackFor(locale, scriptProblems)}`;
            continue;
          }
          break;
        }
        if (scriptProblems.length) {
          recordScriptWarning(run, {
            file,
            kind: 'block',
            issues: scriptProblems,
            text: batchPieces.join('\n\n'),
          });
        }
        if (batchPieces.length !== batch.length) {
          // A single oversized block (usually a wide table) can come back as many
          // pieces. Re-join them with single newlines: that restores the table
          // without inventing new blank-line blocks.
          if (batch.length === 1 && batchPieces.length > 1) {
            batchPieces = [batchPieces.join('\n')];
          } else if (batch.length > 1) {
            // The model merged two adjacent blocks (a heading and the paragraph
            // under it, two list items) and the whole segment was unusable. Three
            // identical retries fail the same way, so the old code threw and the
            // page was skipped with every block still English — that is how a
            // dense page could stay pending forever. Send the segment one block
            // at a time instead: a merge can then cost one block, not eight.
            process.stderr.write(
              `fallback ${section.name}/${item.rel}: ${batch.length} blocks one at a time\n`,
            );
            batchPieces = [];
            for (const single of batch) {
              const answer = await client.chat(single);
              let one = answer
                .split(/\r?\n[ \t]*\r?\n/)
                .filter((piece) => piece.trim() !== '');
              if (one.length !== 1) {
                const structured = splitBlocks(answer);
                if (structured.length === 1) one = structured;
              }
              // Blank lines inside one block are line breaks, not new blocks.
              if (one.length > 1) one = [one.join('\n')];
              if (one.length !== 1 || !one[0].trim()) {
                throw new Error(`block count ${batch.length} -> ${batchPieces.length}`);
              }
              batchPieces.push(one[0]);
            }
          } else {
            throw new Error(`block count ${batch.length} -> ${batchPieces.length}`);
          }
        }
        // A fenced block is copied verbatim. The model happily translates the
        // labels inside an ASCII diagram, which breaks the "code is byte-identical"
        // rule; restore every fence from the English source here, before writing.
        // An admonition is rebuilt around the English container for the same reason:
        // the `:::` markers are structure, only the title and body are language.
        for (let i = 0; i < batchPieces.length; i++) {
          const block = batch[i];
          let kept = keepFences(block, batchPieces[i]);
          if (splitAdmonitions(block)) kept = restoreAdmonition(block, kept);
          // An English sentence that came back unchanged is a failed translation,
          // not a proper noun: ask once more with the prose rule spelled out, and
          // report it if the model still refuses. The original stays in place and
          // the block stays pending (it is not written to the keep-English ledger).
          if (normalize(kept) === normalize(block) && hasTranslatableProse(block)) {
            const retried = await client.chat(
              `Translate this documentation paragraph into ${targetLanguage(locale)}. ` +
                'Keep only tool names, product names, commands, paths, code and other ' +
                'technical identifiers in English; translate every ordinary English ' +
                'sentence. Output only the translation:\n\n' +
                block,
            );
            const retriedKept = keepFences(block, retried);
            if (normalize(retriedKept) !== normalize(block)) {
              kept = splitAdmonitions(block) ? restoreAdmonition(block, retriedKept) : retriedKept;
            } else {
              run.recordBlockError({
                file: `${section.name}/${item.rel}`,
                block,
                reason: 'model-kept-english-after-retry',
              });
            }
          }
          applyBlock(start + i, kept);
        }
        run.countBlocks(batch.length);
      }
    }

    // `description` and `title` are one request each; they are part of this page's
    // work, so they are skipped when the run has to stop here.
    const mayContinue = () => !stopped && run.room() > 0;
    // The front-matter `description` feeds `<meta name="description">` and the
    // tag pages (`/tags/<tag>`), so it is translated like the title.
    const sourceDescription = readField(item.sourceFm, 'description');
    // Gate on the planner's decision, not just on the presence of a source
    // description: `needsDescription` already encodes --kinds, the keep-English
    // locks and "overlay description is still English". Without the gate every
    // page with an English source description would be re-sent on a blocks-only
    // run, and countPending's `descriptions` number would stop matching the
    // units this batch actually enqueues.
    if (item.needsDescription && sourceDescription && mayContinue()) {
      const cached = modelMemory?.get(`description:${sourceDescription}`);
      if (cached) {
        fields.description = cached;
        memoryUsed += 1;
      } else {
        const firstLine = (text) => {
          const line = String(text ?? '').split('\n')[0].trim().replace(/^["']|["']$/g, '');
          return line && line !== sourceDescription ? line : null;
        };
        const guarded = await guardScript({
          client,
          text: firstLine(await client.chat(descriptionPrompt(locale, sourceDescription))) || '',
          locale,
          file,
          kind: 'description',
          rewrite: (retry) => firstLine(retry),
          record: (warning) => recordScriptWarning(run, warning),
        });
        const clean = firstLine(guarded.text);
        if (clean) {
          fields.description = clean;
          if (modelMemory) modelMemory.set(`description:${sourceDescription}`, clean);
        }
      }
    }
    if (item.needsTitle && mayContinue()) {
      // Titles follow the page contract in `config/translation-rules.yml`
      // (title-terminology): product and protocol names stay English, the words
      // around them are translated. The wording hints (`and` → `和`, `Proxy` →
      // `代理`, `與` for Traditional Chinese) come from the locale profile, not
      // from this call site.
      const firstLine = (text) =>
        String(text ?? '').split('\n')[0].trim().replace(/^["']|["']$/g, '') || item.title;
      const guarded = await guardScript({
        client,
        text: firstLine(await client.chat(titlePrompt(locale, item.title))),
        locale,
        file,
        kind: 'title',
        rewrite: firstLine,
        record: (warning) => recordScriptWarning(run, warning),
      });
      const clean = firstLine(guarded.text);
      if (normalize(clean) === normalize(item.title)) {
        // The model answered with the English title, so the title is a proper
        // noun (`MACsec`, `VLAN`, `SXT-2`): remember that decision instead of
        // buying the same answer on every batch forever, and do not touch the
        // overlay (the title is already correct).
        run.lockTitle(item.title);
      } else {
        fields.title = clean;
        if (modelMemory) modelMemory.set(`title:${item.title}`, clean);
        const label = readField(item.overlayFm, 'sidebar_label');
        if (label && label === item.title) fields.sidebar_label = clean;
      }
      titles += 1;
      run.countTitle();
    }

    // The sidebar label is a unit of its own: `frontMatter.sidebar_label` beats
    // the translated sidebar catalogue, so an English label keeps the sidebar
    // English on an otherwise Chinese page. The planner already excluded the
    // CLI Reference command names and the proper nouns (see
    // `lib/labels.mjs#needsSidebarLabelTranslation`).
    if (item.needsLabel && mayContinue() && !fields.sidebar_label) {
      // A label that is just the title's short form costs nothing: reuse the
      // title translation instead of buying the same words twice.
      if (fields.title && normalize(item.label) === normalize(item.title)) {
        fields.sidebar_label = fields.title;
        if (modelMemory) modelMemory.set(`sidebar_label:${item.label}`, fields.title);
        labels += 1;
        run.countLabel();
      } else {
        const firstLine = (text) => {
          const line = String(text ?? '').split('\n')[0].trim().replace(/^["']|["']$/g, '');
          return line && normalize(line) !== normalize(item.label) ? line : null;
        };
        const cached = modelMemory?.get(`sidebar_label:${item.label}`);
        if (cached) memoryUsed += 1;
        const clean = cached
          ? firstLine(cached)
          : firstLine(
              (
                await guardScript({
                  client,
                  text: (await client.chat(sidebarLabelPrompt(locale, item.label))),
                  locale,
                  file,
                  kind: 'sidebar_label',
                  rewrite: firstLine,
                  record: (warning) => recordScriptWarning(run, warning),
                })
              ).text,
            );
        if (clean) {
          fields.sidebar_label = clean;
          if (modelMemory) modelMemory.set(`sidebar_label:${item.label}`, clean);
          labels += 1;
          run.countLabel();
        } else {
          // The model answered with the English label, so the label *is* the
          // proper noun (`RADIUS`, `VETH`): remember the decision instead of
          // asking again on every batch, and leave the overlay untouched.
          run.lockLabel(item.label);
        }
      }
    }
  } catch (error) {
    failure = error;
    if (isFatalProviderError(failure)) {
      run.stopError(failure);
      stopped = true;
    }
    // Keep what was already paid for: the page is written below with the blocks
    // that came back before the failure.
    process.stderr.write(
      `partial ${section.name}/${item.rel}: ${failure.message} ` +
        `(keeping ${sent} block(s), ${titles} title(s))\n`,
    );
  }
  // Nothing came back before the failure: there is nothing to write, and the
  // caller's error handling (skip the page, or abort the run) should see it.
  if (failure && sent === 0 && titles === 0 && labels === 0) throw failure;

  const patch = loadPatch(section.locale || DEFAULT_TARGET_LOCALE, section.name, item.rel);
  // Real model wording wins; model-memory and translation-memory reuse follow.
  // With none of them `source` stays undefined and provenance keeps its legacy
  // fill-only behaviour (no `translation_source` written by an offline path).
  const provenanceSource =
    llmMade > 0 ? 'llm' : memoryUsed > 0 ? 'memory' : tmUsed > 0 ? 'tm' : undefined;
  const nextFm = withFields(item.overlayFm, {
    title: patch?.title || item.productTitleRepair || undefined,
    // A configured model in a sidebar label is repaired to its canonical
    // spelling without a model call; a real LLM label (when there is one) wins.
    sidebar_label: item.productLabelRepair || undefined,
    ...fields,
    // A page translated by the model records who did it and when. Keys the
    // overlay already carries are kept (see `lib/provenance.mjs`).
    ...translationProvenance({existing: item.overlayFm, source: provenanceSource}),
  });
  body = rewriteLinks(body, section.stripVersion);
  {
    // Image references are structure, not prose: the source's set wins, and a
    // page whose only change is a picture still gets written by this batch
    // (the standalone `align` pass covers pages with no new text at all).
    const aligned = imageAlignment(item.sourceBody, body);
    body = aligned.body;
    for (const warning of aligned.warnings) {
      run.recordImageWarning({file, reason: warning.reason, url: warning.url});
    }
  }
  body = rebaseImages(
    path.posix.dirname(`${section.source}/${item.rel}`),
    `${section.overlay}/${item.rel}`,
    body,
  );
  body = applyReplacements(body, patch);
  body = translateCodeComments(body, (key) => commentMemory.get(key) ?? null).body;
  // LLM-translated headings get a translated slug, so every link that still
  // points at the English anchor dies. Stamp the English ids back onto them with
  // the same canonical pass `apply`, `derive`, `refresh` and `normalize-links`
  // use; this is the only overlay writer that used to skip it. Idempotent, so a
  // page whose headings are already correct is left byte-identical.
  body = addHeadingAnchors(body, item.sourceBody).body;
  // A translated line that starts with a bare RouterOS command word (notably
  // `import`/`export`) is parsed as ESM by MDX/acorn and breaks the build. Escape
  // it here, at the only overlay writer driven by the LLM, so a fresh translation
  // cannot reintroduce the failure. Fences, headings, ESM and raw CLI stay intact.
  body = escapeLeadingCommandWords(body);
  // The official MDX ships its own `<Anchor id=... />` component, but this site
  // has no `Anchor` export and Docusaurus injects one that calls `useBrokenLinks()`
  // during SSR — a translated page that keeps the tag fails the build. `derive`
  // and `materialize` already run this normalisation; the LLM overlay writer did
  // not, which is how a fresh translation reintroduced 139 raw `<Anchor>` tags.
  // Rewriting to `<span id=...></span>` is idempotent, so an already-normalised
  // overlay stays byte-identical.
  body = normaliseMdxAnchors(body).body;
  // `Back To Home` is annotated on its first appearance only (see
  // `lib/term-annotate.mjs`); doing it here keeps a freshly translated page and
  // a rebuilt one identical.
  const annotated = annotateDocumentTerms(nextFm, body.trim());
  // Atomic: a kill between "chunk written" and "renamed" leaves the previous
  // translation, never a half page.
  const rendered = renderDocument(annotated.frontMatter, annotated.body);
  writeFileAtomic(item.overlayPath, rendered);

  const key = `${section.source}/${item.rel}`;
  const remaining = pendingSegments(body).blocks.length;
  state.files[key] = {
    ...(state.files[key] || {}),
    section: section.name,
    source: key,
    overlay: `${section.overlay}/${item.rel}`,
    status: remaining === 0 ? 'full' : 'partial',
    pendingBlocks: remaining,
    // The refresh pass compares these against the source on disk. Recording the
    // overlay's own hash keeps a hand-edited overlay visible instead of
    // silently treating it as what this pipeline wrote.
    source_sha256: item.sourceSha,
    overlay_sha256: sha256Hex(rendered),
    // Fingerprints of the *source* blocks, so a later refresh can tell which
    // paragraphs actually changed. Computed here, not in the plan: `pending`
    // reads the same plan and must not pay for hashing pages it never writes.
    source_blocks: encodeBlockHashes(blockHashes(item.sourceBody)),
  };
  delete state.files[key].stale;
  delete state.files[key].refresh_blocked;
  return {sent, reused, titles, remaining, stopped};
}

async function translateSection(
  section,
  client,
  state,
  {limit, dryRun, only, files, kinds, modelMemory, commentMemory, concurrency = 4, run},
) {
  const items = planSection(section, {limit, only, files, kinds});
  const pageLocale = section.locale || DEFAULT_TARGET_LOCALE;
  if (dryRun) {
    // The read-only plan answers the same question the batch does: how much of
    // this page is already in the memory (free) and how much would be sent. It
    // writes nothing, not even the model memory, so a dry run can be repeated.
    let tmReused = 0;
    let llmPending = 0;
    for (const item of items) {
      const hits = item.blocks.filter(
        (block) => tmBlockTranslation(block, pageLocale) !== null,
      ).length;
      tmReused += hits;
      llmPending += item.blocks.length - hits;
      progress.write(
        `${section.name}/${item.rel}: blocks=${item.blocks.length} admonitions=${item.admonitions}` +
          ` fencedAdmonitions=${item.fencedAdmonitions} title=${item.needsTitle ? 'yes' : 'no'}` +
          ` tm_reused=${hits} llm_pending=${item.blocks.length - hits}\n`,
      );
    }
    return {
      done: items.length,
      sentBlocks: items.reduce((sum, item) => sum + item.blocks.length, 0),
      tmReused,
      llmPending,
    };
  }

  let cursor = 0;
  let done = 0;
  let sentBlocks = 0;
  async function worker() {
    for (;;) {
      // Check the caps *before* taking a page: `--budget-minutes=0` (and a cap
      // already used up by the previous page) must leave `i18n/` untouched,
      // rather than rewriting one page per section with identical bytes.
      // Follow-up: a page whose blocks are *all* memory hits costs no request, so
      // it should be exempt from this cap; today a spent `--max-blocks` can still
      // leave it for the next batch.
      if (run.room() <= 0) return;
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      try {
        const result = await processItem(
          section,
          item,
          client,
          state,
          modelMemory,
          commentMemory,
          run,
        );
        sentBlocks += result.sent;
        if (!result.stopped) done++;
        run.pages += 1;
        // `translateSection` has no `locale` parameter of its own: the section
        // records the locale the overlay tree was derived for. Referring to a
        // missing `locale` here used to throw after every page, which turned
        // each successful page into a `skip ... locale is not defined` line and
        // skipped the per-page checkpoint (the model memory was only flushed at
        // the end of the batch).
        checkpoint(run, {
          state,
          modelMemory,
          locale: section.locale || DEFAULT_TARGET_LOCALE,
          section,
          item,
        });
        progress.write(
          `${section.name}/${item.rel}: ${result.sent} blocks ${result.titles} titles ` +
            `(${item.admonitions} admonitions, ${item.fencedAdmonitions} with code), ` +
            `${result.reused} from memory, ` +
            `${result.remaining} left${result.stopped ? ' [stopped]' : ''}\n`,
        );
        if (result.stopped) return;
      } catch (error) {
        if (isFatalProviderError(error)) {
          // Keep the pages already finished (they are on disk and in `state/`),
          // then fail the job: the workflow commits that progress and does not
          // build, so the published site stays on the previous version.
          run.stopError(error);
          process.stderr.write(`fatal ${section.name}/${item.rel}: ${error.message}\n`);
          return;
        }
        process.stderr.write(
          `skip ${section.name}/${item.rel}: ${error.message}` +
            `${process.env.TRANSLATE_DEBUG ? `\n${error.stack}` : ''}\n`,
        );
      }
    }
  }
  // A unit cap must be honoured exactly, so one page at a time: four workers
  // would each see the same remaining budget and together overshoot it.
  const workers = Math.max(
    1,
    Math.min(run.maxBlocks !== null ? 1 : concurrency, items.length || 1),
  );
  await Promise.all(Array.from({length: workers}, worker));
  return {done, sentBlocks};
}

function renderTmReport(payload, report) {
  const lines = [];
  const out = (line = '') => lines.push(line);
  const counts = payload.counts || {};
  const kind = counts.byKind || {};
  const origin = counts.byOrigin || {};
  const conflicts = payload.conflicts || {total: 0, by_pair: {}, samples: []};

  out('# 全局翻译记忆 dry-run 报告');
  out();
  out(`生成时间：${payload.generated_at}`);
  out();
  out('本报告只合并记忆并统计影响，不修改任何 overlay。');
  out('`apply` / `derive` 已经读取这份合并记忆；报告用于审计合并结果与残留。');
  out();
  out('## 1. 合并结果');
  out();
  out('| 类别 | 条数 |');
  out('| --- | ---: |');
  out(`| 段落（block） | ${kind.block || 0} |`);
  out(`| 注释（comment） | ${kind.comment || 0} |`);
  out(`| 标题（title） | ${kind.title || 0} |`);
  out(`| 合计 | ${(kind.block || 0) + (kind.comment || 0) + (kind.title || 0)} |`);
  out();
  out('| 来源（最终保留） | 条数 |');
  out('| --- | ---: |');
  for (const [name, value] of Object.entries(origin).sort((a, b) => b[1] - a[1])) {
    out(`| ${name} | ${value} |`);
  }
  out();
  out(`同键不同译（被高优先级覆盖）：**${conflicts.total}** 条。`);
  if (conflicts.by_pair && Object.keys(conflicts.by_pair).length) {
    out();
    out('| 覆盖关系 | 条数 |');
    out('| --- | ---: |');
    for (const [pair, value] of Object.entries(conflicts.by_pair).sort((a, b) => b[1] - a[1])) {
      out(`| ${pair} | ${value} |`);
    }
  }
  out();
  out('## 2. 切换收益（只统计仍是英文的块）');
  out();
  out('“合规保留英文”指法规/型号等本就应当保留原文的块（译文等于原文）；');
  out('“保留原文”指记忆里有中文译文、但页面保留原文；多数是西班牙语/俄语/法语的法规声明，');
  out('按 `legal-text-english` 规则有意保留，需要人工确认是否有漏网之鱼。');
  out();
  out('| 板块 | 页面 | 英文块 | 合规保留英文 | 保留原文 | 全局可新增 | 仍缺译文 | 受影响页面 |');
  out('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [name, stat] of Object.entries(report.sections)) {
    out(
      `| ${name} | ${stat.pages} | ${stat.pending} | ${stat.policyEnglish} | ${stat.keptOriginal} | ` +
        `${stat.gain} | ${stat.untranslated} | ${stat.pagesAffected} |`,
    );
  }
  out(
    `| **合计** | | | **${report.totals.policyEnglish}** | **${report.totals.keptOriginal}** | ` +
      `**${report.totals.gain}** | **${report.totals.untranslated}** | **${report.totals.pagesAffected}** |`,
  );
  out();
  if (report.examples.length) {
    out('样例（原先没有译文的块）：');
    out();
    out('| 位置 | 英文 | 全局记忆 | 来源 |');
    out('| --- | --- | --- | --- |');
    for (const item of report.examples) {
      const cell = (text) =>
        String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 90);
      out(`| ${item.section}/${item.rel} | ${cell(item.english)} | ${cell(item.chinese)} | ${item.origin} |`);
    }
    out();
  }
  if (report.missingExamples?.length) {
    out('### 仍缺译文的块');
    out();
    out('这些块在任何一层记忆里都没有译文：');
    out();
    out('| 位置 | 英文 |');
    out('| --- | --- |');
    for (const item of report.missingExamples) {
      const cell = (text) =>
        String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 110);
      out(`| ${item.section}/${item.rel} | ${cell(item.english)} |`);
    }
    out();
  }

  out('## 3. 冲突样例（保留高优先级，丢弃低优先级）');
  out();
  if (!conflicts.samples?.length) {
    out('没有冲突。');
  } else {
    out('| 英文（截断） | 保留 | 丢弃 |');
    out('| --- | --- | --- |');
    for (const item of conflicts.samples.slice(0, 20)) {
      const english = item.key.split('\u0000').slice(1).join(' ');
      const cell = (text) =>
        String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 60);
      out(`| ${cell(english)} | ${cell(item.kept)}（${item.kept_origin}） | ${cell(item.dropped)}（${item.dropped_origin}） |`);
    }
  }
  out();
  out('## 4. 结论');
  out();
  out(`- 合并后 ${payload.entries ? Object.keys(payload.entries).length : 0} 条，冲突 ${conflicts.total} 条；`);
  out(`- 合规保留英文 ${report.totals.policyEnglish} 块（不算漏翻）；`);
  out(`- 保留原文 ${report.totals.keptOriginal} 块（多为法规声明，需人工抽查）；`);
  out(`- 全局记忆可新增 ${report.totals.gain} 块，涉及 ${report.totals.pagesAffected} 页；`);
  out(`- 仍缺译文 ${report.totals.untranslated} 块。`);
  out('- 这一步不改 overlay；确认后再切换 apply / derive 的读取路径并重建。');
  out();
  return `${lines.join('\n')}\n`;
}

function targetLocale(args) {
  // A read-only run may probe a locale that is only conventional so far
  // (`--dry-run`); a write needs the locale enabled in docusaurus.config.ts.
  const readOnly = Boolean(args['dry-run']);
  return assertTranslationLocale(args.locale || DEFAULT_TARGET_LOCALE, {readOnly});
}

/** Print one `verify()` report; returns false when it must fail the run. */
function printVerifyReport(report) {
  for (const [name, stat] of Object.entries(report.summary)) {
    process.stdout.write(`${name}: ${JSON.stringify(stat)}\n`);
  }
  process.stdout.write(`mdxErrors=${report.mdxErrors.length} fences=${report.totalFences}\n`);
  process.stdout.write(
    `untranslatedAdmonitions=${report.totals?.untranslatedAdmonitions ?? 0}` +
      ` fencedAdmonitions=${report.totals?.fencedAdmonitionsEnglish ?? 0}` +
      `/${report.totals?.fencedAdmonitions ?? 0}` +
      `${report.admonitionSamples.length ? ` sample=${report.admonitionSamples[0]}` : ''}\n`,
  );
  if (report.mdxErrors.length) process.stdout.write(`${report.mdxErrors.slice(0, 15).join('\n')}\n`);
  for (const [name, stat] of Object.entries(report.sections)) {
    for (const kind of ['fenceDiff', 'commentDiff', 'imageDiff', 'frontMatterDiff']) {
      if (stat[kind].length) process.stdout.write(`${name} ${kind}: ${stat[kind].slice(0, 8).join('; ')}\n`);
    }
    if (stat.commentUntranslated) {
      process.stdout.write(`${name} commentUntranslated=${stat.commentUntranslated}\n`);
    }
  }
  process.stdout.write(
    `untranslatedBlocks=${report.totals?.untranslatedBlocks ?? 0}` +
      ` untranslatedHeadings=${report.totals?.untranslatedHeadings ?? 0}` +
      ` descriptionEnglish=${report.totals?.descriptionEnglish ?? 0}` +
      ` frontMatterEnglish=${Object.values(report.summary).reduce((sum, stat) => sum + (stat.frontMatterEnglish || 0), 0)}` +
      ` overlayInflation=${report.totals?.overlayInflation ?? 0}` +
      ` anchorMismatch=${report.totals?.anchorMismatch ?? 0}\n`,
  );
  for (const sample of report.frontMatterSamples || []) {
    process.stdout.write(`untranslated-frontmatter: ${sample}\n`);
  }
  for (const sample of report.untranslatedSamples) process.stdout.write(`untranslated: ${sample}\n`);
  for (const sample of report.commentSamples || []) process.stdout.write(`comment-untranslated: ${sample}\n`);
  for (const sample of report.headingSamples || []) process.stdout.write(`untranslated-heading: ${sample}\n`);
  for (const sample of report.descriptionSamples || []) process.stdout.write(`english-description: ${sample}\n`);
  for (const sample of report.inflationSamples || []) process.stdout.write(`inflated-overlay: ${sample}\n`);
  for (const sample of report.anchorSamples || []) process.stdout.write(`anchor-mismatch: ${sample}\n`);
  // A zero exit code is what CI reads: a missing overlay, a blank overlay or an
  // MDX error used to print fine and pass anyway. `untranslatedBlocks` joins
  // the other language misses: clean headings/descriptions/anchors plus
  // thousands of English prose blocks is NOT a completed translation.
  const structural = Object.entries(report.summary).reduce(
    (sum, [, stat]) => sum + stat.missing + stat.extra + (stat.emptyOverlays || 0),
    0,
  );
  const languageMisses =
    (report.totals?.untranslatedBlocks ?? 0) +
    (report.totals?.untranslatedHeadings ?? 0) +
    (report.totals?.descriptionEnglish ?? 0) +
    (report.totals?.overlayInflation ?? 0) +
    // A heading id that does not match the English source is a broken link,
    // not a wording preference: fail the run with file:line samples above.
    (report.totals?.anchorMismatch ?? 0);
  const ok = !structural && !report.mdxErrors.length && !languageMisses;
  if (!ok) process.exitCode = 1;
  return ok;
}

/**
 * Oldest-first section order for the three model-sending paths (translate,
 * comments, pending). `SECTION_SPECS` lists docs newest-first and local paths
 * such as `apply` deliberately keep that order; here the canonical archive
 * must reach the model first so every newer release can reuse what the older
 * one just added to the translation memory.
 *
 * Reuses `compareSectionPriority` from `lib/tm.mjs` — the same numeric,
 * lowest-version-first rule as `resolveConflict`'s `oldest-version-first`:
 * `docs-7.24` < `docs-7.25` < versionless `docs` (the current release).
 * Non-docs sections (hardware/blog/changelog/hub-docs) keep their original
 * relative order and follow every docs section. Stable, so a single
 * `--section=` selection is unchanged (idempotent).
 */
function sortSectionsOldestFirst(sections) {
  const isDocs = (section) => section.name === 'docs' || /^docs-\d/.test(section.name);
  return sections
    .map((section, index) => ({section, index}))
    .sort((a, b) => {
      const aDocs = isDocs(a.section);
      const bDocs = isDocs(b.section);
      if (aDocs && bDocs) {
        return compareSectionPriority(a.section.name, b.section.name) || a.index - b.index;
      }
      if (aDocs) return -1;
      if (bDocs) return 1;
      return a.index - b.index;
    })
    .map(({section}) => section);
}

async function main() {
  // `--help` is answered before parsing and before any command runs: `translate
  // --help` used to start a real translation run, and a bare `--help` fell
  // through to the usage text with exit code 1.
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const args = parseArgs(argv);
  const command = args._[0];
  const locale = LOCALE_COMMANDS.has(command) ? targetLocale(args) : DEFAULT_TARGET_LOCALE;
  const sections = LOCALE_COMMANDS.has(command) ? sectionsFor(locale) : SECTIONS;
  // Local commands (apply/align/tm/…) keep SECTION_SPECS order. The three
  // model-sending paths re-sort this oldest-first before sending any request.
  let selected = args.section
    ? sections.filter((section) => section.name === args.section)
    : sections;

  if (command === 'import-legacy') {
    process.stdout.write('Building translation memory from legacy projects…\n');
    const {stats} = buildLegacy({
      legacyRoot: args['legacy-root'],
      outDir: WORK_DIR,
      locale,
    });
    process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
    return;
  }

  if (command === 'apply') {
    if (!localeHasResources(locale)) {
      // A locale with no resource at all (no glossary, patches, TM file or
      // `i18n/<locale>/` tree) is only a naming convention so far. Applying it
      // would write an English mirror under `i18n/<locale>/`, which is never what
      // a probe run wants; report the zeroes a no-op run produces instead.
      const resources = [
        path.relative(REPO, glossaryFile(locale)),
        path.relative(REPO, patchDir(locale)),
        path.relative(WORKSPACE, tmFile(locale)),
        localeRoot(locale),
      ].join(', ');
      process.stdout.write(
        `locale ${locale}: no translation resources yet (${resources}); ` +
          `nothing to apply, would write under ${localeRoot(locale)}/\n`,
      );
      for (const section of selected) {
        process.stdout.write(
          `${section.name}: files=0 full=0 partial=0 stale=0 none=0 preserved=0 preservedCjk=0 ` +
            (args['dry-run'] ? 'wouldPreserveCjk=0 ' : '') +
            'cjkLossAllowed=0 pendingBlocks=0 commentHits=0 commentMisses=0 ' +
            'legacySkipped=0 orphansRemoved=0\n',
        );
      }
      return;
    }
    const {loadLegacy} = await import('./lib/legacy.mjs');
    // The block memory and the path index load independently. The corpus the
    // index points at has been removed, so the index may be empty while the
    // 33k-entry memory is still fully usable. A locale repo that commits only
    // shards (zh-Hant today) has NO legacy file at all: use empty structures and
    // let `apply` / `adopt` rebuild from the global TM, model and comment memory
    // instead of aborting. `findExact` / `findReference` treat an empty index as
    // "no hit", so this is safe.
    const legacy = loadLegacy(WORK_DIR) || {
      memoryByArea: {},
      index: {},
      skipped: 0,
      total: 0,
      memoryEntries: 0,
    };
    if (!fs.existsSync(path.join(WORK_DIR, 'translation-memory.json'))) {
      process.stderr.write(
        'note: translation-memory.json is absent; applying without legacy memory/index ' +
          '(global TM + shards + comment memory only)\n',
      );
    }
    const modelMemory = loadModelMemory();
    const commentMemory = loadCommentMemory();
    const tm = createGlobalTm({workDir: WORK_DIR, locale});
    const state = readState();
    state.schema = 1;
    state.memory = legacy.memoryEntries;
    for (const section of selected) {
      // Merge only the memory of the areas this section is allowed to use, so a
      // 7.24 page can never inherit a 7.25 link or the other way round.
      const titleIndex = args.adopt ? buildTitleIndex(legacy.index, section.legacy) : null;
      const memory = new Map();
      for (const area of section.legacy) {
        for (const [key, value] of legacy.memoryByArea[area] || []) memory.set(key, value);
      }
      const result = applySection(section, memory, legacy.index, {
        write: !args['dry-run'],
        titleMemory: modelMemory,
        modelMemory,
        commentMemory,
        tm,
        adopt: Boolean(args.adopt),
        titleIndex,
        allowCjkLoss: Boolean(args['allow-cjk-loss']),
      });
      state.sections[section.name] = {
        files: result.files,
        full: result.full,
        partial: result.partial,
        stale: result.stale,
        missing: result.missing,
        preserved: result.preserved,
        preservedCjk: result.preservedCjk,
        cjkLossAllowed: result.cjkLossAllowed,
        pendingBlocks: result.pendingBlocks,
        commentHits: result.commentHits,
        commentMisses: result.commentMisses,
      };
      Object.assign(state.files, result.entries);
      const removed = args['dry-run'] ? 0 : cleanupOverlay(section, result);
      const preservedCjk = result.preservedCjk ?? 0;
      process.stdout.write(
        `${section.name}: files=${result.files} full=${result.full} partial=${result.partial} ` +
          `stale=${result.stale} none=${result.missing} preserved=${result.preserved ?? 0} ` +
          `preservedCjk=${preservedCjk} ` +
          (args['dry-run'] ? `wouldPreserveCjk=${preservedCjk} ` : '') +
          `cjkLossAllowed=${result.cjkLossAllowed ?? 0} ` +
          `pendingBlocks=${result.pendingBlocks} ` +
          `commentHits=${result.commentHits} commentMisses=${result.commentMisses} ` +
          `legacySkipped=${result.legacySkipped ?? 0} orphansRemoved=${removed}\n`,
      );
    }
    if (!args['dry-run']) writeState(state);
    return;
  }

  if (command === 'align') {
    // Read-only alignment probe (`--dry-run`) and the write form. It does not
    // call the provider: it only makes the overlay's image references and page
    // set match the source.
    const summary = alignOverlayImages(selected, {
      dryRun: Boolean(args['dry-run']),
      only: args.file,
      files: args.files
        ? new Set(String(args.files).split(',').map((value) => value.trim()).filter(Boolean))
        : null,
      progress,
    });
    progress.write(
      `align pages=${summary.pages} changed=${summary.changed} +${summary.added} ` +
        `-${summary.removed} ~${summary.replaced} warnings=${summary.warnings} ` +
        `orphans=${summary.orphans} orphansRemoved=${summary.orphansRemoved}\n`,
    );
    return;
  }

  if (command === 'verify') {
    // `--all-locales` checks every configured target that has resources; an
    // explicit `--locale` checks one. Neither changes the no-argument output.
    if (args['all-locales'] && args.locale) {
      process.stderr.write('--all-locales and --locale are mutually exclusive\n');
      process.exitCode = 2;
      return;
    }
    if (args['all-locales']) {
      const locales = resourceLocales();
      if (!locales.length) {
        process.stdout.write('all-locales: no configured locale has translation resources yet\n');
        return;
      }
      const failed = [];
      for (const tag of locales) {
        process.stdout.write(`\n=== locale ${tag}\n`);
        const report = await verify({compile: !args['no-compile'], locale: tag});
        if (!printVerifyReport(report)) failed.push(tag);
      }
      process.stdout.write(
        `\nall-locales: checked ${locales.length} (${locales.join(', ')}); failed=${failed.length}` +
          `${failed.length ? ` (${failed.join(', ')})` : ''}\n`,
      );
      if (failed.length) process.exitCode = 1;
      return;
    }
    // `verify` is read-only, so a well-formed tag that is not in
    // `docusaurus.config.ts` yet is a valid probe.
    const tag = assertTranslationLocale(args.locale || DEFAULT_TARGET_LOCALE, {readOnly: true});
    const report = await verify({compile: !args['no-compile'], locale: tag});
    if (report.noResources) {
      process.stdout.write(
        `locale ${tag}: no translation resources yet; nothing to verify, 0 files under ${localeRoot(tag)}/\n`,
      );
    }
    printVerifyReport(report);
    return;
  }

  if (command === 'pending') {
    selected = sortSectionsOldestFirst(selected);
    progress = args.json ? process.stderr : process.stdout;
    preparePlan({locale});
    const pending = countPending(selected);
    // Comment lines are part of what has to be translated: the deploy gate must
    // not see `pending=0` while a fence still carries an English comment.
    const comments = commentPlan(selected, loadCommentMemory()).reduce(
      (sum, job) => sum + job.lines.length,
      0,
    );
    if (args.json) {
      // `--pages` adds the page-level list (`section`/`path`/`blocks`/`title`);
      // CI prints it in the job summary when a run publishes with English left.
      const payload = {
        pending: pending.units + comments,
        blocks: pending.blocks,
        titles: pending.titles,
        sidebar_labels: pending.labels,
        descriptions: pending.descriptions,
        comments,
        pages: pending.pages,
        sections: pending.bySection,
      };
      if (args.pages) {
        payload.page_list = pending.pageList;
        payload.page_list_truncated = pending.pageListTruncated;
      }
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      return;
    }
    for (const [name, stat] of Object.entries(pending.bySection)) {
      progress.write(
        `${name}: blocks=${stat.blocks} titles=${stat.titles} ` +
          `sidebar_labels=${stat.sidebar_labels ?? 0} descriptions=${stat.descriptions ?? 0}\n`,
      );
    }
    progress.write(
      `pending=${pending.units + comments} blocks=${pending.blocks} titles=${pending.titles} ` +
        `sidebar_labels=${pending.labels} descriptions=${pending.descriptions} ` +
        `comments=${comments} pages=${pending.pages}\n`,
    );
    return;
  }

  if (command === 'translate') {
    selected = sortSectionsOldestFirst(selected);
    // `--json` promises exactly one JSON object on stdout, so progress moves to
    // stderr; a `| tee` in CI then never has to filter npm banner lines out of a
    // half-JSON stream.
    progress = args.json ? process.stderr : process.stdout;
    if (args['dry-run'] && args.apply) {
      process.stderr.write('--apply and --dry-run are mutually exclusive\n');
      process.exitCode = 2;
      return;
    }
    const budgetMinutes = optionalNumber(args['budget-minutes'], 'budget-minutes');
    const maxBlocks = optionalNumber(args['max-blocks'], 'max-blocks');
    if (maxBlocks !== null && !Number.isInteger(maxBlocks)) {
      process.stderr.write(`--max-blocks must be a whole number (got "${args['max-blocks']}")\n`);
      process.exitCode = 2;
      return;
    }
    // `--limit` used to default to 20 pages per section. That is a sensible cap
    // for an unbounded repair run, but it silently caps a *budgeted* batch at 20
    // pages per section — the budget is supposed to be the only bound there, so
    // a budgeted/unit-capped run defaults to "no page limit". `--limit=N` still
    // wins when it is given.
    const limit = args.limit === undefined
      ? budgetMinutes !== null || maxBlocks !== null
        ? 0
        : 20
      : Number(args.limit);
    const only = args.file;
    const files = args.files
      ? new Set(String(args.files).split(',').map((value) => value.trim()).filter(Boolean))
      : null;
    const kinds = parseKinds(args.kinds);
    const concurrency = Number(args.concurrency || 4);
    const state = readState();
    const modelMemory = loadModelMemory();
    const commentMemory = loadCommentMemory();
    preparePlan({locale, modelMemory});
    const run = createRun({budgetMinutes, maxBlocks});
    // The explicit checkpoint is written before anything else can be spent or
    // written. A dry run writes nothing (not even the checkpoint), matching its
    // read-only contract. `recomputePending` is the deploy gate's own planner.
    if (!args['dry-run']) {
      const cp = startCheckpoint(run, {
        locale,
        budgetMinutes,
        maxBlocks,
        recomputePending: () => countPending(sections),
      });
      progress.write(
        `checkpoint: ${path.relative(REPO, CHECKPOINT_FILE)} run=${cp.run_id} ` +
          `deadline=${cp.deadline ?? 'none'}\n`,
      );
      // Arm before preprocessing: refresh/planning are synchronous and cannot
      // be interrupted, so the guard must already be pending. When the whole
      // budget is smaller than the safety margin, `room()` commits the stop
      // here — before a single byte is refreshed or a request is considered.
      armBudgetGuard(run);
      if (run.room() <= 0) {
        progress.write('budget: less than the safety margin remains; stopping before any request\n');
      }
    }

    // Rebuild the pages whose English source changed *before* planning, so the
    // English blocks a refresh leaves behind are part of this batch's normal
    // queue. Offline: the memory supplies every translation; nothing here calls
    // the model. A missing memory is a warning, never a failure — the run then
    // translates from the overlays as it always did.
    if (!run.stopped && args['refresh-changed'] && !args['no-refresh-changed']) {
      if (!refreshEnabled()) {
        progress.write(
          'refresh: disabled (config/translation.yml#refresh_changed or TRANSLATE_REFRESH_CHANGED)\n',
        );
      } else {
        const {tm, reason} = loadRefreshTm(locale);
        if (!tm) {
          process.stderr.write(`warning: refresh skipped: ${reason}; overlays were not touched\n`);
          progress.write(`refresh: skipped (${reason})\n`);
        } else {
          const refresh = refreshChanged({
            sections: selected,
            state,
            tm,
            only,
            files,
            dryRun: Boolean(args['dry-run']),
            log: (line) => progress.write(`${line}\n`),
          });
          run.refresh = refreshJournal(refresh);
          progress.write(`${formatRefreshSummary(refresh)}\n`);
          if (refresh.dryRun) {
            if (args.json) {
              // `--json` promises one object on stdout even for the read-only
              // form, so a script never has to guess whether a refresh ran.
              process.stdout.write(
                `${JSON.stringify({refresh: refreshJournal(refresh), pending: null, stopped: 'dry-run'})}\n`,
              );
            }
            progress.write(
              'note: --refresh-changed --dry-run reports the refresh only; nothing was written or translated.\n',
            );
            return;
          }
          if (refresh.dirty) writeState(state);
        }
      }
    }

    if (args['dry-run']) {
      let dryFiles = 0;
      let dryBlocks = 0;
      let dryTmReused = 0;
      let dryLlmPending = 0;
      for (const section of selected) {
        if (run.stopped) break;
        const result = await translateSection(section, null, state, {
          limit,
          dryRun: true,
          only,
          files,
          kinds,
          modelMemory,
          commentMemory,
          concurrency,
          run,
        });
        dryFiles += result.done;
        dryBlocks += result.sentBlocks;
        dryTmReused += result.tmReused ?? 0;
        dryLlmPending += result.llmPending ?? 0;
      }
      const dryPending = countPending(sections).units;
      progress.write(
        `dry-run files=${dryFiles} blocks=${dryBlocks} tm_reused=${dryTmReused} ` +
          `llm_pending=${dryLlmPending} pending=${dryPending}\n`,
      );
      if (args.json) {
        // One object on stdout, in the same shape the batch summary has, so a
        // script reads it with the parser it already has (`readSummary` accepts
        // `stopped: 'dry-run'` and a `translated: 0`). Nothing was written:
        // `tm_reused` is what the memory already answers, `llm_pending` is what
        // a real run would still send.
        process.stdout.write(
          `${JSON.stringify({
            translated: 0,
            pending: dryPending,
            stopped: 'dry-run',
            dry_run: true,
            tm_reused: dryTmReused,
            llm_pending: dryLlmPending,
            blocks: dryBlocks,
            files: dryFiles,
          })}\n`,
        );
      }
      return;
    }

    let client = null;
    try {
      client = new Client(loadConfig(locale));
    } catch (error) {
      // Missing/invalid LLM_* configuration still reports what is left, so CI
      // can say "pending N, stopped error" instead of dying with a stack trace.
      run.stopError(error);
      process.stderr.write(`${error.message}\n`);
    }

    if (!run.error) {
      // A stop sign from the runner (job timeout, cancelled job) ends the batch
      // between two requests: the page in flight finishes its current batch and
      // is written, then the checkpoint and the JSON summary run as usual.
      const onSignal = (signal) => {
        process.stderr.write(`${signal}: stopping after the current batch\n`);
        if (run.stopped) return;
        run.stopped = 'budget';
        run.limit = 'signal';
        // Persist the signal stop immediately: the runner may kill the process
        // outright after this, and the next scheduled round reads this record.
        finalizeCheckpoint(run);
      };
      process.once('SIGTERM', onSignal);
      process.once('SIGINT', onSignal);
      for (const section of selected) {
        if (run.stopped) break;
        await translateSection(section, client, state, {
          limit,
          dryRun: false,
          only,
          files,
          kinds,
          modelMemory,
          commentMemory,
          concurrency,
          run,
        });
      }
    }

    // Comments are prose too: they are not part of a page's block plan, so a
    // page that is otherwise fully translated would never send them. Translate
    // them in the same batch (one request per group of comment lines), then put
    // the memory on every overlay so a page with no other change is updated.
    if (!run.error && client && kinds.comments) {
      const comments = await translateComments(selected, client, {
        limit: 200,
        dryRun: false,
        only,
        files,
        locale,
        run,
        shouldStop: () => run.room() <= 0,
      });
      if (comments.translated) {
        const applied = applyCommentTranslations(selected, {only, files});
        progress.write(
          `comments translated=${comments.translated} pages=${applied.changed} ` +
            `hits=${applied.hits} misses=${applied.misses}\n`,
        );
      }
    }

    // Provider work is over: image alignment and the final flush are local, so
    // a guard firing during them would mislabel a completed run as a stop.
    if (!run.stopped) disarmBudgetGuard(run);

    // Image alignment is local (no provider call): run it even when the block
    // budget is exhausted, and also for pages the translation plan skipped
    // because they have no English text left.
    if (kinds.images) {
      const aligned = alignOverlayImages(selected, {only, files, run, progress});
      progress.write(
        `images pages=${aligned.pages} changed=${aligned.changed} ` +
          `+${aligned.added} -${aligned.removed} warnings=${aligned.warnings} ` +
          `orphansRemoved=${aligned.orphansRemoved}\n`,
      );
    }

    // Everything a later run reads back: the overlays are already on disk (one
    // atomic write per page), this flushes the small state next to them.
    checkpoint(run, {state, modelMemory, force: true, locale});
    // Final checkpoint: done / budget / signal / error, with finished_at and a
    // non-negative deadline-elapsed proof. `recordStop` is sticky on the stop
    // time but refreshes counters, so this agrees with the run journal below.
    finalizeCheckpoint(run);
    if (client) client.log(USAGE_FILE);
    // The planner's TM and keep-English ledger were loaded once at the start of
    // the batch (preparePlan above), but this batch has just flushed new shards
    // and locks to disk. Counting with that stale snapshot over-reports pending:
    // blocks the model just kept in English still look untranslated to the old
    // TM, so the batch summary can say 24 while a fresh `pending --json` says 2.
    // Reload the plan state before the authoritative summary so both agree.
    // This only refreshes what is *read* — it queues no new work and never
    // lowers the pending == 0 gate.
    preparePlan({locale, modelMemory});
    const pending = countPending(sections);
    const pendingComments = kinds.comments
      ? commentPlan(selected, loadCommentMemory(), {only, files}).reduce(
          (sum, job) => sum + job.lines.length,
          0,
        )
      : null;
    writeRunJournal({run, pending, client, pendingComments});
    emitTranslateSummary({run, pending, client, json: Boolean(args.json), pendingComments});
    if (run.error) process.exitCode = 1;
    return;
  }


/**
 * Section-scoped memory, as `apply` uses it today.
 *
 * A derived section also reads the canonical version, because that is where its
 * wording comes from.
 */
function sectionMemory(section, legacy, model) {
  const local = new Map();
  for (const area of section.legacy || []) {
    for (const [key, value] of Object.entries(legacy[area] || {})) local.set(key, value);
  }
  if (section.derivedFrom) {
    const canonical = SECTIONS.find((item) => item.name === section.derivedFrom);
    for (const area of canonical?.legacy || []) {
      for (const [key, value] of Object.entries(legacy[area] || {})) {
        if (!local.has(key)) local.set(key, value);
      }
    }
  }
  return (english) => {
    const key = normalize(english);
    const generated = model.get(`${section.name}\u0000${key}`);
    if (generated !== undefined) return generated;
    return local.get(key) ?? null;
  };
}

/**
 * What switching to the global memory would change.
 *
 * Only the blocks that are still English today are counted: those are the ones
 * the global memory could fill for free. Blocks that already have Chinese keep
 * their wording, so a wording comparison would be a different (and much larger)
 * exercise.
 */
function tmDryRun(sections, built, legacy, model) {
  const bySection = {};
  let gain = 0;
  let pagesAffected = 0;
  let policyEnglish = 0;
  let keptOriginal = 0;
  let untranslated = 0;
  const examples = [];
  const keptExamples = [];
  const missingExamples = [];

  const identity = (text, english) => text !== null && normalize(text) === normalize(english);

  for (const section of sections) {
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    const current = sectionMemory(section, legacy, model);
    const stat = {
      pages: 0,
      pending: 0,
      policyEnglish: 0,
      keptOriginal: 0,
      globalFillable: 0,
      gain: 0,
      untranslated: 0,
      pagesAffected: 0,
    };

    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      if (isTranslationExcluded(section, rel)) continue;
      const overlayPath = path.join(overlayBase, rel);
      const body = splitFrontMatter(
        fs.readFileSync(fs.existsSync(overlayPath) ? overlayPath : sourcePath, 'utf8'),
      ).body;
      const pending = pendingSegments(body).blocks;
      if (pending.length === 0) continue;
      stat.pages++;
      let pageGain = 0;
      for (const block of pending) {
        stat.pending++;
        const currentText = current(block);
        const globalEntry = built.entries.get(tmKeyOf(block));

        // Legal statements and identifiers are translated to themselves on
        // purpose; they are not misses.
        if (identity(currentText, block) || isLegal(block)) {
          stat.policyEnglish++;
          policyEnglish++;
          continue;
        }
        if (currentText !== null) {
          // The memory has a Chinese translation but the page keeps the source
          // text. That is correct for regulatory wording (Spanish, Russian,
          // French) and a real defect for anything else, so it is reported for a
          // human look rather than counted as a miss.
          stat.keptOriginal++;
          keptOriginal++;
          if (keptExamples.length < 12) {
            keptExamples.push({
              section: section.name,
              rel,
              english: block.trim().slice(0, 90),
              chinese: String(currentText).slice(0, 90),
            });
          }
          continue;
        }
        if (globalEntry && !identity(globalEntry.text, block)) {
          stat.globalFillable++;
          stat.gain++;
          gain++;
          pageGain++;
          if (examples.length < 12) {
            examples.push({
              section: section.name,
              rel,
              english: block.trim().slice(0, 90),
              chinese: globalEntry.text.slice(0, 90),
              origin: globalEntry.origin,
            });
          }
          continue;
        }
        // The memory only has an "identity" entry (keep English): policy, not
        // a missing translation.
        if (globalEntry && identity(globalEntry.text, block)) {
          stat.policyEnglish++;
          policyEnglish++;
          continue;
        }
        stat.untranslated++;
        untranslated++;
        if (missingExamples.length < 12) {
          missingExamples.push({section: section.name, rel, english: block.trim().slice(0, 120)});
        }
      }
      if (pageGain > 0) stat.pagesAffected++;
    }

    pagesAffected += stat.pagesAffected;
    bySection[section.name] = stat;
  }

  return {
    totals: {gain, pagesAffected, policyEnglish, keptOriginal, untranslated},
    sections: bySection,
    examples,
    keptExamples,
    missingExamples,
  };
}

function tmKeyOf(english) {
  return `block\u0000${normalize(english)}`;
}

function parseCommentArray(raw, count) {
  let text = String(raw ?? '').trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  let value;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== count) return null;
  if (!value.every((item) => typeof item === 'string' && item.trim() !== '')) return null;
  return value.map((item) => item.trim().replace(/^#+\s*/, '').replace(/\s*\r?\n\s*/g, ' '));
}

/**
 * Comment translation jobs.
 *
 * Adjacent comment lines are sent as one run, because upstream pages wrap a
 * sentence over several `#` lines and translating each line alone produces
 * fragments. Only lines missing from the comment memory form a job, and a job
 * that repeats across 7.24 and 7.25 is sent once.
 */
function commentPlan(sections, memory, {only, files = null} = {}) {
  const jobs = [];
  const seen = new Set();
  // A sentence can appear on several pages; translate it once.
  const pending = new Set();
  for (const section of sections) {
    const base = path.join(REPO, section.source);
    for (const sourcePath of walkMarkdown(base)) {
      const rel = relative(base, sourcePath);
      if (only && rel !== only) continue;
      if (files && files.size && !files.has(rel)) continue;
      if (isTranslationExcluded(section, rel)) continue;
      const {body} = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8'));
      const entries = commentLines(body).filter(
        (entry) =>
          !entry.blockSkip &&
          classifyComment(entry.text, entry.next, entry.hashes.length).kind === 'comment',
      );
      let run = [];
      const emit = (lines) => {
        if (lines.length === 0) return;
        const dedupe = `${lines[0].language}\u0000${lines.map((line) => line.text.trim()).join('\u0001')}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        const fresh = [];
        for (const line of lines) {
          const key = commentKey(line.language, line.text);
          if (pending.has(key)) continue;
          pending.add(key);
          fresh.push({key, text: line.text.trim()});
        }
        if (fresh.length === 0) return;
        jobs.push({section: section.name, rel, language: lines[0].language, lines: fresh});
      };
      const flush = () => {
        let chunk = [];
        for (const entry of run) {
          if (memory.has(commentKey(entry.language, entry.text))) {
            emit(chunk);
            chunk = [];
            continue;
          }
          chunk.push(entry);
        }
        emit(chunk);
        run = [];
      };
      for (const entry of entries) {
        const previous = run[run.length - 1];
        if (
          previous &&
          entry.block === previous.block &&
          entry.index === previous.index + 1 &&
          entry.hashes === previous.hashes
        ) {
          run.push(entry);
        } else {
          flush();
          run = [entry];
        }
      }
      flush();
    }
  }
  return jobs;
}

/**
 * Take at most `limit` comment lines from the job list.
 *
 * `--limit` is the cost cap of one invocation: it counts comment lines sent, not
 * pages, because that is what the provider charges for.
 */
function takeLines(jobs, limit) {
  const out = [];
  let used = 0;
  for (const job of jobs) {
    if (used >= limit) break;
    const room = limit - used;
    const lines = job.lines.slice(0, room);
    out.push({...job, lines});
    used += lines.length;
  }
  return out;
}

/** Group comment runs into requests of at most `maxLines` comment lines. */
function batchJobs(jobs, maxLines = 30) {
  const batches = [];
  let current = {jobs: [], lines: []};
  for (const job of jobs) {
    if (current.lines.length > 0 && current.lines.length + job.lines.length > maxLines) {
      batches.push(current);
      current = {jobs: [], lines: []};
    }
    current.jobs.push(job);
    current.lines.push(...job.lines);
  }
  if (current.lines.length > 0) batches.push(current);
  return batches;
}

async function translateComments(
  sections,
  client,
  {limit, batch, dryRun, only, files = null, locale = DEFAULT_TARGET_LOCALE, run = null, shouldStop = null},
) {
  const memory = loadCommentMemory();
  const jobs = commentPlan(sections, memory, {only, files});
  const totalLines = jobs.reduce((sum, job) => sum + job.lines.length, 0);
  const characters = jobs.reduce(
    (sum, job) => sum + job.lines.reduce((n, line) => n + line.text.length, 0),
    0,
  );
  const budget = takeLines(jobs, Number(limit || 200));
  const batches = batchJobs(budget, Number(batch || 40));
  const planned = budget.reduce((sum, job) => sum + job.lines.length, 0);

  const summary = {
    jobs: jobs.length,
    lines: totalLines,
    characters,
    plannedLines: planned,
    batches: batches.length,
    sections: {},
  };
  for (const job of jobs) {
    summary.sections[job.section] = (summary.sections[job.section] || 0) + job.lines.length;
  }
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`);
    for (const [index, batch] of batches.slice(0, 5).entries()) {
      process.stdout.write(`batch ${index + 1}: lines=${batch.lines.length} jobs=${batch.jobs.length}\n`);
      for (const line of batch.lines.slice(0, 10)) process.stdout.write(`  ${line.text}\n`);
      if (batch.lines.length > 10) process.stdout.write(`  … ${batch.lines.length - 10} more\n`);
    }
    return summary;
  }

  let done = 0;
  let translated = 0;
  let skipped = 0;
  // The comment path used to pass its own system prompt and therefore lost the
  // locale profile (style, terminology) and the script guard. It now starts
  // from `client.system(text)` — profile and relevant glossary included — and
  // appends the JSON envelope rules.
  const systemFor = (text) => `${client.system(text)}\n\n${commentRules(locale)}`;
  for (const batch of batches) {
    if (shouldStop && shouldStop()) {
      process.stderr.write(`stopping comment batch ${done + 1}: run budget exhausted\n`);
      break;
    }
    const prompt = JSON.stringify(batch.lines.map((line) => line.text), null, 1);
    let pieces = null;
    for (let attempt = 0; attempt < 2 && !pieces; attempt++) {
      const raw = await client.chat(prompt, {system: systemFor(prompt)});
      pieces = parseCommentArray(raw, batch.lines.length);
      if (!pieces) {
        process.stderr.write(`retry comment batch ${done + 1}: expected ${batch.lines.length} lines\n`);
      }
    }
    if (!pieces) {
      skipped += batch.lines.length;
      process.stderr.write(`skip comment batch ${done + 1} (${batch.lines.length} lines): unparseable\n`);
      continue;
    }
    // Comments are prose too: a `zh-Hant` batch that comes back in Simplified
    // characters is retried once with the offending forms quoted back, then
    // kept and reported.
    const issues = pieces.flatMap((piece) => scriptIssues(piece, locale));
    if (issues.length) {
      const retriedPrompt =
        `${prompt}\n\n${feedbackFor(locale, issues)}\n` +
        'Return the same JSON array, one corrected line per input line.';
      const retried = parseCommentArray(
        await client.chat(retriedPrompt, {system: systemFor(prompt)}),
        batch.lines.length,
      );
      const remaining = retried
        ? retried.flatMap((piece) => scriptIssues(piece, locale))
        : issues;
      if (remaining.length) {
        const first = batch.jobs[0];
        recordScriptWarning(run, {
          file: `${first.section}/${first.rel}`,
          kind: 'comment',
          issues: remaining,
          text: (retried || pieces).join(' | '),
        });
      }
      if (retried) pieces = retried;
    }
    batch.lines.forEach((line, index) => memory.set(line.key, pieces[index]));
    saveCommentMemory(memory);
    run?.countComments(pieces.length);
    done += 1;
    translated += pieces.length;
    const first = batch.jobs[0];
    process.stdout.write(
      `batch ${done}/${batches.length}: ${pieces.length} comments (${first.section}/${first.rel} …)\n`,
    );
  }
  process.stdout.write(
    `comments batches=${done}/${batches.length} lines=${translated} skipped=${skipped} ` +
      `tokens(prompt/completion)=${client.usage.prompt}/${client.usage.completion}\n`,
  );
  return {...summary, done, translated, skipped};
}

  if (command === 'descriptions') {
    const config = loadConfig(locale);
    const client = new Client(config);
    const run = createRun({});
    const modelMemory = loadModelMemory();
    // `preparePlan` (see ~L586) now always builds a global TM: it tolerates a
    // missing translation-memory.json by using shards + comment memory, and
    // prints a note distinguishing "no memory at all" from "no legacy, shards
    // used". `lookupTitle(tm, ...)` below therefore never throws on a
    // shards-only repo. A memory file that EXISTS but is malformed still throws
    // from createGlobalTm, so the stricter error is preserved.
    const {tm} = preparePlan({locale});
    const prompts = [];
    let skipped = 0;
    for (const section of selected) {
      const sourceBase = path.join(REPO, section.source);
      for (const file of walkMarkdown(sourceBase)) {
        const rel = relative(sourceBase, file);
        const {frontMatter} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
        const english = readField(frontMatter, 'description');
        if (!english) continue;
        if (modelMemory.get(`description:${english}`) || lookupTitle(tm, english)) {
          skipped++;
          continue;
        }
        prompts.push(english);
      }
    }
    process.stdout.write(`descriptions: ${prompts.length} to translate, ${skipped} already known\n`);
    if (!args['dry-run']) {
      const queue = [...new Set(prompts)];
      let done = 0;
      const worker = async () => {
        while (queue.length) {
          const english = queue.shift();
          const firstLine = (text) => {
            const line = String(text ?? '').split('\n')[0].trim().replace(/^["']|["']$/g, '');
            return line && line !== english ? line : null;
          };
          const guarded = await guardScript({
            client,
            text: firstLine(await client.chat(descriptionPrompt(locale, english))) || '',
            locale,
            file: 'descriptions',
            kind: 'description',
            rewrite: (retry) => firstLine(retry),
            record: (warning) => recordScriptWarning(run, warning),
          });
          const clean = firstLine(guarded.text);
          if (clean) modelMemory.set(`description:${english}`, clean);
          done++;
          if (done % 25 === 0) process.stdout.write(`  ${done}/${prompts.length}\n`);
        }
      };
      await Promise.all(Array.from({length: Number(args.concurrency || 4)}, worker));
      // `writeBaseline: false`: the 26 MB baseline is committed to git and a batch
    // must not rewrite it (see `lib/model-memory.mjs`); the shard carries the
    // new keys instead.
    saveModelMemory(modelMemory, {locale, writeBaseline: false});
      client.log(USAGE_FILE);
      process.stdout.write(
        `translated ${done} description(s), tokens(prompt/completion)=${client.usage.prompt}/${client.usage.completion}\n`,
      );
      reportScriptWarnings(run);
    }
    return;
  }

  if (command === 'comments') {
    selected = sortSectionsOldestFirst(selected);
    const config = loadConfig(locale);
    const client = new Client(config);
    const run = createRun({});
    const summary = await translateComments(selected, client, {
      limit: args.limit,
      dryRun: Boolean(args['dry-run']),
      only: args.file,
      files: args.files
        ? new Set(String(args.files).split(',').map((value) => value.trim()).filter(Boolean))
        : null,
      locale,
      run,
    });
    if (!args['dry-run']) {
      // The memory is not the deliverable: a comment batch that only writes
      // `comment-memory.json` leaves the overlay in English. Apply it to every
      // overlay before reporting, so `verify` sees the same state the user does.
      const applied = applyCommentTranslations(selected, {only: args.file});
      client.log(USAGE_FILE);
      const mem = loadCommentMemory();
      process.stdout.write(
        `comment-memory=${mem.size} pages=${applied.changed} hits=${applied.hits} misses=${applied.misses}\n`,
      );
      reportScriptWarnings(run);
    }
    void summary;
    return;
  }

  if (command === 'tm') {
    const legacyPath = path.join(WORK_DIR, 'translation-memory.json');
    // A shards-only locale repo has no legacy file: use an empty store so the
    // dry-run report still works. A PRESENT but malformed file still throws
    // from JSON.parse, so the stricter error is not weakened.
    const hasLegacy = fs.existsSync(legacyPath);
    const legacy = hasLegacy ? JSON.parse(fs.readFileSync(legacyPath, 'utf8')) : {};
    // The big file is optional in CI; shards carry the committed translations.
    const modelRaw = Object.fromEntries(readModelMemory({workDir: WORK_DIR}));
    const commentPath = path.join(WORK_DIR, 'comment-memory.json');
    const commentRaw = fs.existsSync(commentPath)
      ? JSON.parse(fs.readFileSync(commentPath, 'utf8'))
      : {entries: {}};

    const built = buildGlobalTm({
      legacy,
      model: modelRaw,
      comment: commentRaw,
      arbitrateVersions: !hasLegacy,
    });
    built.locale = locale;
    const payload = serializeTm(built, {locale});
    if (!args['dry-run']) saveTm(payload, {locale});

    const report = tmDryRun(selected, built, legacy, new Map(Object.entries(modelRaw)));
    const outJson = path.join(REPO, 'reports/tm-dry-run.json');
    const outMd = path.join(REPO, 'reports/tm-dry-run.md');
    ensureDir(path.dirname(outJson));
    fs.writeFileSync(outJson, `${JSON.stringify({generated_at: payload.generated_at, counts: built.counts, conflicts: payload.conflicts, ...report}, null, 1)}\n`);
    fs.writeFileSync(outMd, renderTmReport(payload, report));
    process.stdout.write(
      `tm entries=${built.entries.size} conflicts=${built.conflicts.length} ` +
        `resolved=${built.resolutions.length} ` +
        `gain=${report.totals.gain} kept=${report.totals.keptOriginal} ` +
        `policy=${report.totals.policyEnglish} missing=${report.totals.untranslated}` +
        `${args['dry-run'] ? ' (dry-run, tm not written)' : ''}\n`,
    );
    return;
  }

  if (command === 'admonitions') {
    // Read-only inventory: how many `:::type … :::` blocks exist and how many are
    // still queued. Before the block splitter learned the container, the queued
    // number was structurally zero on every page.
    let total = 0;
    let queued = 0;
    for (const section of selected) {
      const sourceBase = path.join(REPO, section.source);
      const overlayBase = path.join(REPO, section.overlay);
      let found = 0;
      let waiting = 0;
      const samples = [];
      for (const sourcePath of walkMarkdown(sourceBase)) {
        const rel = relative(sourceBase, sourcePath);
        const sourceBody = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body;
        const overlayPath = path.join(overlayBase, rel);
        const overlayBody = fs.existsSync(overlayPath)
          ? splitFrontMatter(fs.readFileSync(overlayPath, 'utf8')).body
          : sourceBody;
        found += pendingSegments(sourceBody).admonitions.length;
        const plan = pendingSegments(overlayBody);
        waiting += plan.admonitions.length;
        if (plan.admonitions.length && samples.length < 3) {
          samples.push(`${rel}: ${plan.admonitions[0].split('\n')[0].trim()}`);
        }
      }
      total += found;
      queued += waiting;
      process.stdout.write(
        `${section.name}: admonitions=${found} queued=${waiting}` +
          `${samples.length ? ` samples=${JSON.stringify(samples)}` : ''}\n`,
      );
    }
    process.stdout.write(`admonitions total=${total} queued=${queued}\n`);
    return;
  }

  if (command === 'status') {
    const state = readState();
    const commentMemory = loadCommentMemory();
    process.stdout.write(
      `${JSON.stringify({memory: state.memory, commentMemory: commentMemory.size, sections: state.sections}, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`${USAGE}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  // A bad `--locale=` or a bad option is a user error: one line, no stack
  // trace. A usage error exits 2 (a script's typo is not a runtime failure).
  const message =
    error instanceof LocaleError || error instanceof UsageError
      ? error.message
      : error.stack || error.message;
  process.stderr.write(`${message}\n`);
  process.exitCode = error instanceof UsageError ? 2 : 1;
});
