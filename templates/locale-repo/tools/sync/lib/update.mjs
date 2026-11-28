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
import {REPO, archivedVersions, currentVersionOrNull} from './versions.mjs';

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
export function buildStages({target, mode, all = false, firstInstall = false}) {
  const stages = [
    {id: 'fetch-upstream', title: `抓取官方 ${target}`, run: ['tools/sync/fetch-upstream.mjs', [`--version=${target}`]]},
    // The three non-versioned content roots used to be stale HEAD snapshots:
    // no stage ever fetched them. They are section products, independent of the
    // RouterOS release, so every mode (cold start, bump and refresh) refreshes
    // them here, before any version swap. Each stage writes its own manifest
    // with generated_at / source_url / sha256 / bytes and run-level captured_at.
    {id: 'fetch-hardware', title: '抓取官方 hardware 指南', run: ['tools/sync/fetch-hardware.mjs', ['--concurrency=4']]},
    {id: 'fetch-blog', title: '抓取官方 blog 文章', run: ['tools/sync/fetch-blog.mjs', ['--concurrency=4']]},
    {id: 'fetch-changelog', title: '抓取官方 changelog', run: ['tools/sync/fetch-changelog.mjs', ['--concurrency=4']]},
    // The favicon is another non-versioned official asset: docusaurus.config.ts
    // serves it from static/img/favicon.svg via headTags, so the bytes have to
    // come from the official homepage's <link rel=icon> on every run. Keeping
    // the stage here (before any version swap) covers cold start, bump and
    // refresh with one entry.
    {id: 'fetch-favicon', title: '抓取官方 favicon', run: ['tools/sync/fetch-favicon.mjs', []]},
  ];
  // A cold start has no upstream tree for the archived releases listed in
  // versions.json. Fetch each one from the official archive right after the
  // current release so `materialize --all` can write its versioned_docs tree;
  // deriving the stages from archivedVersions() keeps the list in sync with the
  // committed configuration instead of hard-coding any version numbers.
  // Only the upstream-only consumers (fetch + structure cache) belong here.
  // The render-tree consumers (restore / mermaid / colours) walk
  // versioned_docs/version-<v>/ and are added after `materialize` below: a cold
  // start has no such directory yet, so running them here either crashed with
  // ENOENT (mermaid/colours) or silently reported pages:0 / tables:0 (restore).
  if (firstInstall) {
    for (const version of archivedVersions()) {
      stages.push({
        id: `fetch-archive-${version}`,
        title: `抓取官方归档 ${version}`,
        run: ['tools/sync/fetch-upstream.mjs', [`--version=${version}`]],
      });
      // The official `.md` export is lossy inside table cells and a cold start
      // has no rendered-structure cache for an archived release. Cache each
      // archive from its rendered pages now: this stage only reads
      // upstream/<v>/docs, so it does not need versioned_docs/ yet.
      stages.push({
        id: `cache-archive-${version}`,
        title: `缓存归档 ${version} 渲染结构`,
        run: ['tools/sync/cache-structure.mjs', [`--version=${version}`]],
      });
    }
  }
  // The route report diffs against an installed baseline, which a cold start
  // has not got; skip it rather than inventing a `from` version.
  if (!firstInstall) {
    stages.push({id: 'report-routes', title: '对比路由，列出人工决策点', run: ['tools/sync/report-update.mjs', [`--from=${currentVersionOrNull()}`, `--to=${target}`]]});
  }
  // There is nothing to archive before the first install, but the new tree
  // still has to be installed as `docs/`.
  if (mode === 'bump' && !firstInstall) {
    stages.push({id: 'snapshot-version', title: `归档 ${currentVersionOrNull()}`, run: ['tools/sync/snapshot-version.mjs', ['--version', currentVersionOrNull()]]});
  }
  if (mode === 'bump' || firstInstall) {
    stages.push({
      id: 'install-version',
      title: `安装 ${target} 为当前版本`,
      run: ['tools/sync/install-version.mjs', ['--version', target, '--source', `upstream/${target}/docs`]],
    });
  }
  // A cold start fetches the archived releases too, so materialise every version
  // (current + archives); bump/refresh keep the caller's `--all` choice.
  const useAll = firstInstall || all;
  stages.push(
    {id: 'crawl-nav', title: `抓取 ${target} 侧边栏与分页`, run: ['tools/sync/crawl-nav.mjs', [`--version=${target}`]]},
    {id: 'metadata-extract', title: '抓取页面元数据（描述/标签/CLI 互链）', run: ['tools/sync/extract-doc-metadata.mjs', [`--version=${target}`]]},
    {id: 'metadata-apply', title: '把元数据写入上游清单', run: ['tools/sync/apply-doc-metadata.mjs', [`--version=${target}`]]},
    // Title / sidebar label / position from the crawled navigation: without it a
    // new release materialises pages that have no label, and the Previous/Next
    // cards fall back to English.
    {id: 'navigation-labels', title: '回填标题与侧边栏标签', run: ['tools/sync/apply-navigation-labels.mjs', [`--version=${target}`]]},
    // The index reads one `cli-links-<v>.json` per known version, including the
    // archives. On a cold start those files are only produced by the
    // archive apply stages below, which run after `materialize`; so the index
    // is appended at the very end of the first-install branch instead of here.
    ...(firstInstall ? [] : [{id: 'cli-links', title: '重建 CLI 互链索引', run: ['tools/sync/build-cli-links-index.mjs', []]}]),
    {id: 'cache-structure', title: `缓存 ${target} 渲染结构`, run: ['tools/sync/cache-structure.mjs', [`--version=${target}`]]},
    {id: 'capture-mermaid', title: '回收 Mermaid 权威源码', run: ['tools/sync/capture-mermaid.mjs', [`--version=${target}`]]},
    {id: 'capture-inline-colors', title: '回收表格枚举值颜色', run: ['tools/sync/capture-inline-colors.mjs', [`--version=${target}`]]},
    {id: 'materialize', title: useAll ? '物料化全部版本' : `物料化 ${target}`, run: ['tools/sync/materialize.mjs', useAll ? ['--all', '--write'] : [`--version=${target}`, '--write']]},
    // Fail-closed preflight: materialize rebuilds Markdown from the lossy
    // official export, which drops the content-hash image references. Check
    // that HEAD's `/img/<hash>` references survived (and that no relative
    // reference lost its page-local file) BEFORE the ~54-minute asset stage.
    // Otherwise address-images would only report the regression at the very
    // end of the run, after all that network work.
    {id: 'verify-addressing', title: '图片寻址前置断言', run: ['tools/verify/addressing-ready.mjs', []]},
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
  // Restore captured_at after materialize wrote the trees. These stages sit
  // before the cold-start archive restores / materialize-final so that the
  // final re-materialization is still the last writer of the version trees;
  // the CLI-links index and manifest re-hash stages that follow do not touch
  // Markdown. materialize itself also writes captured_at from the fetch
  // manifest, so the final pass does not erase it. The helper accepts one
  // --version=<v> per invocation
  // (and --write to apply), hence one stage per tree.
  for (const version of [target, ...archivedVersions().filter((v) => v !== target)]) {
    stages.push({
      id: `backfill-captured-at-${version}`,
      title: `回填 ${version} 页面 captured_at`,
      run: ['tools/sync/backfill-captured-at.mjs', [`--version=${version}`, '--write']],
    });
  }
  // On a cold start `versioned_docs/version-<v>/` only comes into existence at
  // the `materialize --all` stage above. The three archive consumers below walk
  // that tree, so they must run afterwards; bump/refresh keep their original
  // order because this whole block is first-install only.
  if (firstInstall) {
    // Root cause of the archived tags / CLI-links regression: the two
    // metadata stages above only ran for `target` (the current release), while
    // `materialize --all` overwrites every version. An archive's rendered page
    // metadata exists only on the official versioned page, so extract it per
    // archived release now that versioned_docs/ exists, then apply it to that
    // release's upstream manifest. Each version's own cache/manifest is used,
    // never the current release's values (7.24 DNS has 3 tags, 7.25 has 4).
    // Both stages must precede `materialize-final`, which is the pass that
    // writes the recovered tags into the shipped Markdown.
    for (const version of archivedVersions()) {
      stages.push({
        id: `metadata-extract-archive-${version}`,
        title: `抓取归档 ${version} 页面元数据（描述/标签/CLI 互链）`,
        run: ['tools/sync/extract-doc-metadata.mjs', [`--version=${version}`]],
      });
      stages.push({
        id: `metadata-apply-archive-${version}`,
        title: `把归档 ${version} 元数据写入上游清单`,
        run: ['tools/sync/apply-doc-metadata.mjs', [`--version=${version}`]],
      });
    }
    for (const version of archivedVersions()) {
      stages.push({
        id: `restore-archive-${version}`,
        title: `恢复归档 ${version} 表格结构`,
        run: ['tools/sync/restore-table-structure.mjs', [`--version=${version}`, '--apply']],
      });
      // The official `.md` export is lossy in two more places: HTML inside
      // Mermaid labels (`<br />`) and the coloured `<span>` wrappers around
      // enumeration values in table cells. Recover both from the rendered
      // pages now that the archive tree exists; otherwise the archive silently
      // ships reflowing diagrams and plain enum values. Bump/refresh already
      // capture both for the current version earlier in the pipeline.
      stages.push({
        id: `capture-mermaid-archive-${version}`,
        title: `回收归档 ${version} Mermaid 权威源码`,
        run: ['tools/sync/capture-mermaid.mjs', [`--version=${version}`]],
      });
      stages.push({
        id: `capture-inline-colors-archive-${version}`,
        title: `回收归档 ${version} 表格枚举值颜色`,
        run: ['tools/sync/capture-inline-colors.mjs', [`--version=${version}`]],
      });
    }
    // Re-materialize after the backfill so the recovered table structure,
    // Mermaid labels and inline colours actually land in docs/ and
    // versioned_docs/ instead of only sitting in the capture manifests.
    stages.push({
      id: 'materialize-final',
      title: '物料化回填后的全部版本',
      run: ['tools/sync/materialize.mjs', ['--all', '--write']],
    });
    // The ordinary `assets` stage ran long before the archive restore and this
    // final materialization. `restore-table-structure-<archive>` reintroduces
    // the rendered `<img src="/assets/images/<hash>.webp">` from the structure
    // cache, and materialize-final writes it into versioned_docs/ after the
    // assets stage has finished. Nothing mirrored those bytes, so pages.yml
    // later found asset-refs missing=1 and skipped the deploy. Re-run the image
    // mirror now, scoped to versioned_docs/, and assert in the same stage that
    // every root-absolute image reference in the shipped Markdown resolves in
    // static/assets/images/. This is a fail-closed gate, not a relaxed one: a
    // missing byte must abort sync here instead of surfacing after the build.
    stages.push({
      id: 'assets-versioned',
      title: '回填后重新镜像版本化图片并断言引用',
      run: ['tools/sync/fetch-assets.mjs', ['--apply', '--versioned-only']],
    });
    // Now every version has its own `cli-links-<v>.json` (current from the
    // metadata-apply stage above, archives from the new apply stages). Only
    // here can the index be rebuilt without fail-open missing keys.
    stages.push({
      id: 'cli-links',
      title: '重建 CLI 互链索引',
      run: ['tools/sync/build-cli-links-index.mjs', []],
    });
  }
  // The three zone fetch stages record each page's sha256/bytes at capture
  // time, but backfill-captured-at, assets, address-images and both materialize
  // passes rewrite those same files afterwards. Refresh the manifests here, at
  // the very end of every mode (cold start, bump and refresh), so
  // verify:build-inputs compares the hashes of the final products. Only the
  // hashes/sizes change; generated_at and all other fields are preserved.
  stages.push({
    id: 'refresh-zone-manifests',
    title: '刷新三区 manifest 哈希',
    run: ['tools/sync/refresh-zone-manifests.mjs', []],
  });
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
  if (['fetch-hardware', 'fetch-blog', 'fetch-changelog'].includes(stage.id)) {
    const section = stage.id.slice('fetch-'.length);
    const manifest = readJson(path.join(REPO, `data/manifests/${section}.json`));
    if (!manifest?.generated_at) return `data/manifests/${section}.json has no generated_at`;
    if (!(manifest.pages || []).length) return `data/manifests/${section}.json has no pages`;
    return null;
  }
  if (stage.id === 'materialize') {
    if (!fs.existsSync(path.join(REPO, 'docs'))) return 'docs/ is missing';
    return null;
  }
  if (stage.id === 'cli-links') {
    const index = path.join(REPO, 'data/manifests/cli-links.json');
    if (!fs.existsSync(index)) return 'missing data/manifests/cli-links.json';
    let data;
    try {
      data = readJson(index);
    } catch (error) {
      return `unreadable cli-links.json: ${error.message}`;
    }
    // Key set is exactly [current, ...archivedVersions()] — no stale or
    // accidentally omitted version may slip through with a zero exit code.
    const expected = ['current', ...archivedVersions()];
    const actual = Object.keys(data || {});
    const sameKeys =
      actual.length === expected.length && expected.every((key) => actual.includes(key));
    if (!sameKeys) return `cli-links keys ${actual.join(',')} != ${expected.join(',')}`;
    for (const key of expected) {
      const docs = data[key];
      if (!docs || typeof docs !== 'object' || !Object.keys(docs).length) {
        return `${key}: no CLI-link pages`;
      }
      if (!(docs['network-management/dns'] || []).length) {
        return `${key}: network-management/dns has no CLI links`;
      }
    }
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
    from: currentVersionOrNull(),
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
  const current = currentVersionOrNull();
  // Before the first install there is no range of skipped releases to report.
  if (current == null) return [];
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
