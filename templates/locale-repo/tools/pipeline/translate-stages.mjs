/**
 * The single stage list for the zh-Hans rebuild.
 *
 * Everything the translate side runs lives here, once: `translate:apply`,
 * `translate:derive` and `pipeline:translate` are three selections over the
 * same definitions, so a pass can no longer be added to one chain and forgotten
 * in another. `mode` picks the first step and whether `backfill-captured-at` is
 * part of the run:
 *
 *   apply  → `index apply --adopt` + the 12 post-passes  (旧 `translate:apply`)
 *   derive → `derive-all --apply`   + 11 post-passes     (旧 `translate:derive`)
 *   both   → harvest + 上面两条链 + 只属于整条管线的尾部 stage
 *
 * The pass order is the old one, position for position; `backfill-captured-at`
 * only has an apply form, so it is declared that way instead of copied into a
 * second chain.
 *
 * `run` is `[script, argv]` and is spawned as `node <script> <argv>`; `forwards`
 * lists the CLI options (`--section`, `--limit`, `--locale`) the script accepts,
 * and `dryRun` its read-only argv (see `tools/pipeline/stages.mjs`).
 */

const stage = (id, title, script, argv, extra = {}) => ({id, title, run: [script, argv], ...extra});

/** Only in mode=both: the apply/derive chains must not rebuild from English. */
const HARVEST = stage('harvest', '回收现有 overlay 进块记忆', 'tools/translate/harvest.mjs', [], {
  dryRun: ['--dry-run'],
  forwards: ['section'],
});

/** The first step of each chain: the only genuinely mode-specific stage. */
const FIRST = {
  apply: stage('canonical-apply', 'canonical overlay 重建（apply --adopt）', 'tools/translate/index.mjs', ['apply', '--adopt'], {
    dryRun: ['apply', '--adopt', '--dry-run'],
    forwards: ['section', 'limit', 'locale'],
  }),
  derive: stage('canonical-derive', 'derive 链：旧版 → 新版 overlay', 'tools/translate/derive-all.mjs', ['--apply'], {
    // `derive-all` accepts `--dry-run` itself and forwards it to every
    // `derive.mjs` step, so the read-only form is an explicit flag rather than
    // "just omit --apply".
    dryRun: ['--dry-run'],
    forwards: ['locale'],
  }),
};

/**
 * The shared post-passes, in execution order. `modes` defaults to both chains;
 * `backfill-captured-at` writes the capture timestamps of a fresh apply, so a
 * derive run (which rewrites existing pages) does not include it.
 */
const PASSES = [
  stage('fix-enum-cells', '修回被译成 是/否 的枚举值', 'tools/translate/fix-enum-cells.mjs', ['--apply'], {dryRun: []}),
  stage('normalize-titles', '标题归一（中文标题、英文型号）', 'tools/translate/normalize-titles.mjs', ['--apply'], {dryRun: []}),
  stage('normalize-newsletter', 'Newsletter 措辞与标题归一', 'tools/translate/normalize-newsletter.mjs', ['--apply'], {
    dryRun: [],
  }),
  stage('normalize-cli-headers', 'CLI 参数表头译为中文', 'tools/translate/normalize-cli-headers.mjs', ['--apply'], {
    dryRun: ['--check'],
    forwards: ['section'],
  }),
  stage('cli-tables', 'CLI 表格与 TM 对齐', 'tools/translate/cli-tables.mjs', [], {
    dryRun: ['--dry-run'],
    forwards: ['section'],
  }),
  stage('backfill-captured-at', '回填 captured_at', 'tools/translate/backfill-captured-at.mjs', [], {
    modes: ['apply'],
    dryRun: ['--check'],
  }),
  // Always writes the sidebar/navbar catalogues: no read-only form.
  stage('generate-ui', '生成 sidebar/navbar 目录', 'tools/translate/generate-ui.mjs', []),
  stage('normalize-links', '链接归一（本地化、锚点、PDF）', 'tools/translate/normalize-links.mjs', [], {
    dryRun: ['--check'],
    forwards: ['section'],
  }),
  stage('fix-back-to-home', '修回“返回首页”链接', 'tools/translate/fix-back-to-home.mjs', [], {dryRun: ['--check']}),
  stage('fix-asset-links', '修回官方资源链接', 'tools/translate/fix-asset-links.mjs', [], {dryRun: ['--check']}),
  stage('fix-fence-language', '围栏语言标记归一', 'tools/translate/fix-fence-language.mjs', [], {
    dryRun: ['--check'],
    forwards: ['section'],
  }),
  stage('apply-known-translations', '套用已知译文补丁', 'tools/translate/apply-known-translations.mjs', [], {
    dryRun: ['--check'],
  }),
];

/**
 * Only in mode=both, after the derive chain: the hardware titles, the PDF links
 * and the image addressing are repaired once at the end, then the two
 * assertions read the result.
 * (The old entry re-ran newsletter/cli-headers/generate-ui here as well; the
 * two stages in between touch titles and links only, so those repeated calls
 * are folded into the chain runs — stage set and order are unchanged.)
 */
const POST = [
  stage('normalize-hardware-titles', '硬件分类型号归一', 'tools/translate/normalize-hardware-titles.mjs', ['--apply'], {
    dryRun: [],
  }),
  stage('sync-pdfs', '重写 overlay 的 PDF 链接并缓存附件', 'tools/sync/sync-pdfs.mjs', ['--apply'], {dryRun: []}),
  // Both trees were just rewritten (English by apply, overlay by apply/derive);
  // converge page-local copies into `static/img/<hash>` once, so a sync run and a
  // translate run agree on the same reference form.
  stage('address-images', '图片内容寻址（英文树 + overlay）', 'tools/sync/address-images.mjs', ['--write'], {
    dryRun: ['--dry-run'],
  }),
  stage('verify-labels', '标签断言', 'tools/verify/labels.mjs', []),
  stage('verify-cli', 'CLI 表断言', 'tools/verify/cli-tables.mjs', []),
];

/** Legacy `--verify` tail: `translate:verify` after the selected chains. */
export const VERIFY_STAGE = stage(
  'translate-verify',
  '译文结构断言（translate verify）',
  'tools/translate/index.mjs',
  ['verify'],
  {forwards: ['locale']},
);

export const MODES = ['apply', 'derive', 'both'];

/** The chain names a pass belongs to unless it declares `modes`. */
const CHAIN_MODES = ['apply', 'derive'];

/** The ordered stage list for `mode`; throws on an unknown mode. */
export function buildStages(mode = 'both') {
  const chain = (name) => [FIRST[name], ...PASSES.filter((entry) => (entry.modes ?? CHAIN_MODES).includes(name))];
  if (mode === 'apply') return chain('apply');
  if (mode === 'derive') return chain('derive');
  if (mode === 'both') return [HARVEST, ...chain('apply'), ...chain('derive'), ...POST];
  throw new Error(`unknown mode "${mode}"; expected ${MODES.join('|')}`);
}
