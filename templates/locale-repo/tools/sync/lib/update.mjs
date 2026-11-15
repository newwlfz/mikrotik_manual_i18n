/**
 * `sync --update` orchestrator.
 *
 * One run moves the mirror from the installed release to whatever the official
 * site currently publishes, in a fixed order. Every stage either succeeds or
 * aborts the run: a half-installed tree is worse than a stale mirror, and the
 * journal makes the exact failure point obvious.
 *
 * The stages are deliberately separate processes (`spawnSync`), because that is
 * how they are run by hand and by CI; the orchestrator only orders them, guards
 * the preconditions and records what happened.
 */

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {REPO, archivedVersions, currentVersion} from './versions.mjs';

const JOURNAL = path.join(REPO, 'state/update-run.json');
const REPORT_DIR = path.join(REPO, 'reports');
const UA = 'mikrotik-manual-mirror/1.0 (+https://github.com/newwlfz/mikrotik_manual_i18n)';

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** The official site names the release its unversioned tree belongs to. */
export async function discoverOfficialVersion({timeoutMs = 30000} = {}) {
  const response = await fetch('https://manual.mikrotik.com/llms.txt', {
    headers: {'user-agent': UA},
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`cannot read the official inventory: HTTP ${response.status}`);
  const text = await response.text();
  const match = /Index of the RouterOS (\d+(?:\.\d+)+) manual/.exec(text);
  if (!match) throw new Error('cannot read the RouterOS version from /llms.txt');
  return match[1];
}

export function startsJournal(entries) {
  writeJson(JOURNAL, {
    schema: 1,
    started_at: new Date().toISOString(),
    git_head: gitHead(),
    ...entries,
  });
}

export function appendJournal(entry) {
  const journal = readJson(JOURNAL, {schema: 1, stages: []});
  journal.stages = journal.stages || [];
  journal.stages.push(entry);
  journal.updated_at = new Date().toISOString();
  writeJson(JOURNAL, journal);
}

export function readJournal() {
  return readJson(JOURNAL, null);
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: REPO, encoding: 'utf8'});
  return result.status === 0 ? result.stdout.trim() : null;
}

export function gitStatus() {
  const result = spawnSync('git', ['status', '--porcelain'], {cwd: REPO, encoding: 'utf8'});
  return result.status === 0 ? result.stdout.trim().split('\n').filter(Boolean) : [];
}

/**
 * The fixed pipeline. `mode` decides whether the version swap stages are part
 * of it: a refresh re-fetches the release that is already installed.
 */
export function buildStages({target, mode, all = false}) {
  const stages = [
    {id: 'fetch-upstream', title: `抓取官方 ${target}`, run: ['tools/sync/fetch-upstream.mjs', [`--version=${target}`]]},
    {id: 'report-routes', title: '对比路由，列出人工决策点', run: ['tools/sync/report-update.mjs', [`--from=${currentVersion()}`, `--to=${target}`]]},
  ];
  if (mode === 'bump') {
    stages.push(
      {id: 'snapshot-version', title: `归档 ${currentVersion()}`, run: ['tools/sync/snapshot-version.mjs', ['--version', currentVersion()]]},
      {
        id: 'install-version',
        title: `安装 ${target} 为当前版本`,
        run: ['tools/sync/install-version.mjs', ['--version', target, '--source', `upstream/${target}/docs`]],
      },
    );
  }
  stages.push(
    {id: 'crawl-nav', title: `抓取 ${target} 侧边栏与分页`, run: ['tools/sync/crawl-nav.mjs', [`--version=${target}`]]},
    {id: 'metadata-extract', title: '抓取页面元数据（描述/标签/CLI 互链）', run: ['tools/sync/extract-doc-metadata.mjs', [`--version=${target}`]]},
    {id: 'metadata-apply', title: '把元数据写入上游清单', run: ['tools/sync/apply-doc-metadata.mjs', [`--version=${target}`]]},
    // Title / sidebar label / position from the crawled navigation: without it a
    // new release materialises pages that have no label, and the Previous/Next
    // cards fall back to English.
    {id: 'navigation-labels', title: '回填标题与侧边栏标签', run: ['tools/sync/apply-navigation-labels.mjs', [`--version=${target}`]]},
    {id: 'cli-links', title: '重建 CLI 互链索引', run: ['tools/sync/build-cli-links-index.mjs', []]},
    {id: 'cache-structure', title: `缓存 ${target} 渲染结构`, run: ['tools/sync/cache-structure.mjs', [`--version=${target}`]]},
    {id: 'capture-mermaid', title: '回收 Mermaid 权威源码', run: ['tools/sync/capture-mermaid.mjs', [`--version=${target}`]]},
    {id: 'capture-inline-colors', title: '回收表格枚举值颜色', run: ['tools/sync/capture-inline-colors.mjs', [`--version=${target}`]]},
    {id: 'materialize', title: all ? '物料化全部版本' : `物料化 ${target}`, run: ['tools/sync/materialize.mjs', all ? ['--all', '--write'] : [`--version=${target}`, '--write']]},
    {id: 'assets', title: '下载/刷新图片并剪枝', run: ['tools/sync/fetch-assets.mjs', ['--apply', '--prune']]},
    // The `.md` export loses the content hash of the PDF attachments, so the real
    // href has to be recovered from the rendered page and the file cached.
    {id: 'pdf-links', title: '回收 PDF 真实链接', run: ['tools/sync/capture-pdf-links.mjs', ['--refresh']]},
    {id: 'pdfs', title: '缓存 PDF 附件', run: ['tools/sync/sync-pdfs.mjs', ['--apply']]},
    // Prune first: `materialize` re-creates current-only pages inside an archive,
    // and a sidebar built before the prune would still reference them.
    {id: 'prune-orphans', title: '删除官方已下线页面', run: ['tools/sync/prune-orphans.mjs', ['--apply']]},
    // Content-address after the prune: a page-local copy kept alive only by a
    // removed page must not survive, and `sidebars` only needs the page tree.
    {id: 'address-images', title: '图片内容寻址', run: ['tools/sync/address-images.mjs', ['--write']]},
    {id: 'sidebars', title: '重建全部侧边栏', run: ['tools/sync/sync-sidebars.mjs', []]},
    {id: 'verify-sidebar', title: '侧边栏一致性检查', run: ['tools/verify/sidebar-consistency.mjs', []]},
    {id: 'structure-check', title: '结构缓存一致性（报告）', run: ['tools/sync/check-structure.mjs', []], optional: true},
  );
  return stages;
}

/**
 * Post-conditions. A stage that exits 0 but produced nothing usable is a
 * failure: an empty crawl would silently replace a sidebar with nothing.
 */
function validateStage(stage, target) {
  if (stage.id === 'crawl-nav') {
    const file = path.join(REPO, `data/manifests/docs-${target}-sidebar.json`);
    if (!fs.existsSync(file)) return `missing ${path.relative(REPO, file)}`;
    const tree = readJson(file);
    if (!(tree?.docs || []).length) return 'the crawled sidebar is empty';
    const navDir = path.join(REPO, `data/nav/${target}`);
    const cached = fs.existsSync(navDir) ? fs.readdirSync(navDir).length : 0;
    if (!cached) return `no cached pages under data/nav/${target}`;
    return null;
  }
  if (stage.id === 'install-version') {
    const version = readJson(path.join(REPO, 'data/manifests/current-version.json'))?.version;
    if (version !== target) return `current-version.json still says ${version}`;
    return null;
  }
  if (stage.id === 'materialize') {
    if (!fs.existsSync(path.join(REPO, 'docs'))) return 'docs/ is missing';
    return null;
  }
  return null;
}

function runStage(stage, {target, env}) {
  const [script, argv] = stage.run;
  const started = Date.now();
  process.stdout.write(`\n=== ${stage.id}: ${stage.title}\n$ node ${script} ${argv.join(' ')}\n`);
  const result = spawnSync(process.execPath, [script, ...argv], {
    cwd: REPO,
    stdio: 'inherit',
    env: {...process.env, ...(env || {})},
  });
  const problem = result.status === 0 ? validateStage(stage, target) : null;
  if (problem) process.stdout.write(`\nstage ${stage.id} exited 0 but produced nothing usable: ${problem}\n`);
  const entry = {
    id: stage.id,
    title: stage.title,
    command: `node ${script} ${argv.join(' ')}`.trim(),
    target,
    status: result.status === 0 && !problem ? 'ok' : 'failed',
    exit_code: result.status,
    problem: problem || undefined,
    duration_ms: Date.now() - started,
  };
  appendJournal(entry);
  return entry;
}

/**
 * Run the pipeline. Returns the journal; never throws for a stage failure, the
 * caller decides the exit code (so the journal is always flushed).
 */
export function runUpdate({target, mode, stages, env, resumedFrom = null}) {
  const journal = {
    schema: 1,
    started_at: new Date().toISOString(),
    target,
    mode,
    from: currentVersion(),
    resumed_from: resumedFrom,
    git_head: gitHead(),
    stages: [],
  };
  writeJson(JOURNAL, journal);
  const completed = [];
  for (const stage of stages) {
    const entry = runStage(stage, {target, env});
    journal.stages.push(entry);
    writeJson(JOURNAL, journal);
    if (entry.status !== 'ok') {
      if (stage.optional) {
        process.stdout.write(`(optional stage ${stage.id} failed; continuing)\n`);
        continue;
      }
      journal.failed_stage = stage.id;
      journal.updated_at = new Date().toISOString();
      writeJson(JOURNAL, journal);
      return {ok: false, journal, completed, failed: entry};
    }
    completed.push(stage.id);
  }
  journal.finished_at = new Date().toISOString();
  writeJson(JOURNAL, journal);
  return {ok: true, journal, completed};
}

/** Route-level diff, printed before anything destructive happens. */
export function routePlan({from, to}) {
  const load = (version) => {
    const manifest = readJson(path.join(REPO, `upstream/${version}/manifest.json`));
    if (!manifest) return null;
    return new Set(
      (manifest.pages || [])
        .filter((page) => page.origin === 'official')
        .map((page) => page.route),
    );
  };
  const before = load(from);
  const after = load(to);
  if (!before || !after) return null;
  const added = [...after].filter((route) => !before.has(route)).sort();
  const removed = [...before].filter((route) => !after.has(route)).sort();
  return {from, to, before: before.size, after: after.size, added, removed};
}

export function writeRouteReport(plan, file = path.join(REPORT_DIR, `update-${plan.to}-routes.md`)) {
  const lines = [
    `# ${plan.from} -> ${plan.to}: 路由差异`,
    '',
    `- ${plan.from}: ${plan.before} 页`,
    `- ${plan.to}: ${plan.after} 页`,
    `- 新增 ${plan.added.length} 页、删除 ${plan.removed.length} 页`,
    '',
  ];
  if (plan.added.length) {
    lines.push('## 新增', '', ...plan.added.map((route) => `- \`${route}\``), '');
  }
  if (plan.removed.length) {
    lines.push(
      '## 删除（需要人工确认：是改名还是下线？）',
      '',
      ...plan.removed.map((route) => `- \`${route}\``),
      '',
      '> 官方删除的页面会被 `prune-orphans` 删除；若只是改名，请在官方页面确认新路由后忽略本条。',
      '',
    );
  }
  writeJson(file.replace(/\.md$/, '.json'), plan);
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
}

/** Sidebar-level diff, run after the new version has been crawled. */
export function sidebarPlan({from, to}) {
  const load = (version) => {
    const file = path.join(REPO, `data/manifests/docs-${version}-sidebar.json`);
    if (!fs.existsSync(file)) return null;
    const ids = [];
    const walk = (items) => {
      for (const item of items) {
        if (item.type === 'doc') ids.push(item.id);
        else if (item.link?.id) ids.push(item.link.id);
        if (item.items) walk(item.items);
      }
    };
    walk(JSON.parse(fs.readFileSync(file, 'utf8')).docs || []);
    return new Set(ids);
  };
  const before = load(from);
  const after = load(to);
  if (!before || !after) return null;
  return {
    from,
    to,
    before: before.size,
    after: after.size,
    added: [...after].filter((id) => !before.has(id)).sort(),
    removed: [...before].filter((id) => !after.has(id)).sort(),
  };
}

/** Versions the official site published between the installed and new release. */
export function skippedReleases(target) {
  const current = currentVersion();
  const known = new Set([current, ...archivedVersions()]);
  const missing = [];
  const [major, minor] = current.split('.').map(Number);
  const [targetMajor, targetMinor] = target.split('.').map(Number);
  if (targetMajor !== major) return missing;
  for (let value = minor + 1; value < targetMinor; value++) {
    const version = `${major}.${value}`;
    if (!known.has(version)) missing.push(version);
  }
  return missing;
}
