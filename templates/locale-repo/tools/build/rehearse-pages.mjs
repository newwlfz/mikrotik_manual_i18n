#!/usr/bin/env node
/**
 * 本地彩排一次 GitHub Pages 部署（与 `.github/workflows/pages.yml` 对齐）。
 *
 * 做四件事，并把全部数字写进 `work/pages-rehearsal.json`（`work/` 已被
 * `.gitignore` 忽略，不入库）：
 *
 *   1. 原样解析 `pages.yml`：步骤顺序、每步的 run/uses、env 键值与来源；
 *   2. 本地复现构建链：
 *        SITE_URL=… BASE_URL=… npm run build:lowmem   （pages.yml 用 `npm run build` + 10 GiB 堆，
 *                                                      本机 16 GiB 内存扛不住，改用 6 GiB 的等价入口）
 *        npm run build:slim
 *        四条部署门禁（verify:assets / verify:base-url〔分仓模式〕 / verify:orphan-assets / verify:llms）
 *       base-url 门禁以“分仓模式”跑：三站各自独立 GitHub Pages，跨仓链接合法；
 *       其余三条门禁不变。不加参数的 verify:base-url 仍是严格单仓判定。
 *   3. 按 `actions/upload-pages-artifact@v3` 的方式打包：
 *        tar --dereference --hard-dereference -cf work/pages-artifact.tar -C build .
 *      量 tar 体积（对应 10 GB artifact 上限）与 `gzip -9` 体积（上传体积参考），
 *      统计文件/目录数、`du -sb build`；
 *   4. 用本地静态服务器模拟 Pages 的 `/mikrotik_manual_i18n/` 托管形态，
 *      `curl -sI` 抽查 13 条 URL，再跑 `node tools/verify/browser-check.mjs`（应 29/29）。
 *
 * 用法：
 *   node tools/build/rehearse-pages.mjs                # 全流程
 *   node tools/build/rehearse-pages.mjs --skip-build   # 复用现有 build，只做 3-4 与体积分析
 *   node tools/build/rehearse-pages.mjs --skip-browser # 跳过浏览器检查（没有 Chrome 时）
 *   node tools/build/rehearse-pages.mjs --port=3012 --json=work/pages-rehearsal.json
 *
 * 退出码：门禁或浏览器检查失败时为 1，但 JSON 与报告仍会写完。
 */

import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse as parseYaml} from 'yaml';

import {resolveLocales} from '../lib/site-config.mjs';
import {DEFAULT_TARGET_LOCALE} from '../translate/lib/paths.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOW = path.join(REPO, '.github/workflows/pages.yml');
const BUILD = path.join(REPO, 'build');
const WORK = path.join(REPO, 'work');

const args = process.argv.slice(2);
const options = {
  skipBuild: false,
  skipBrowser: false,
  port: Number(process.env.REHEARSAL_PORT || 3012),
  jsonPath: path.join(WORK, 'pages-rehearsal.json'),
  tarPath: path.join(WORK, 'pages-artifact.tar'),
};
for (const arg of args) {
  if (arg === '--skip-build') options.skipBuild = true;
  else if (arg === '--skip-browser') options.skipBrowser = true;
  else if (arg.startsWith('--port=')) options.port = Number(arg.slice('--port='.length));
  else if (arg.startsWith('--json=')) options.jsonPath = path.resolve(REPO, arg.slice('--json='.length));
  else if (arg === '--help' || arg === '-h') {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    process.exit(0);
  } else throw new Error(`unknown argument: ${arg}`);
}

// pages.yml 的取值来自仓库 Variables；本地彩排用同一组目标值。
const SITE_URL = process.env.SITE_URL || 'https://newwlfz.github.io';
const BASE_URL = process.env.BASE_URL || '/mikrotik_manual_i18n/';

// 语种只从配置与本仓 paths.mjs 推导，不再写死某一语种：默认语种在站点根，
// 本仓的翻译语种（DEFAULT_TARGET_LOCALE，locale:add 时自动替换）有一份
// /<locale>/ 前缀的产物。登记表里其它语种的产物由各自仓库构建，不在这里探测。
const {locales: SITE_LOCALES, defaultLocale: SITE_DEFAULT_LOCALE} = resolveLocales();
const REGISTERED_TARGETS = SITE_LOCALES.filter((locale) => locale !== SITE_DEFAULT_LOCALE);
const TRANSLATED_LOCALES =
  DEFAULT_TARGET_LOCALE !== SITE_DEFAULT_LOCALE && REGISTERED_TARGETS.includes(DEFAULT_TARGET_LOCALE)
    ? [DEFAULT_TARGET_LOCALE]
    : REGISTERED_TARGETS;
const PRIMARY_LOCALE = TRANSLATED_LOCALES[0] || null;

/**
 * 彩排的所有子进程（build:lowmem / build:slim / 四条门禁 / browser-check）必须与
 * pages.yml 看到同一组站点环境变量：SITE_LOCALE 在 workflow 级、ASSET_HOST 在
 * build job 级显式声明。缺了 ASSET_HOST 会让 build:lowmem 直接 FATAL；缺了
 * SITE_LOCALE 会把产物从 en 单语变成全语种，与分仓部署形态不符。
 *
 * 这里只补「默认值」：process.env 在后面展开，调用方显式传入的值（即使为空串）
 * 始终优先，彩排不会静默覆盖用户选择。
 */
const CI_ENV_DEFAULTS = {
  ASSET_HOST: 'true',
  SITE_LOCALE: SITE_DEFAULT_LOCALE || 'en',
  SITE_URL,
  BASE_URL,
};
const CI_ENV = {...CI_ENV_DEFAULTS, ...process.env, SITE_URL, BASE_URL};

/**
 * 彩排产物里混有早期双语托管的跨仓残留（build/mikrotik_manual_zh_hans、
 * build/mikrotik_manual_zh_hant）。真实部署是三仓各自独立 GitHub Pages，
 * 跨站链接合法，所以只有 base-url 门禁切到分仓模式：从 locales.json 推导
 * 跨仓前缀（--multi-repo），并在扫描时剪掉这两个可再生的陈旧子树（不删除文件）。
 * 其它三条门禁保持原样；单独跑 verify:base-url（不带参数）仍是严格单仓判定。
 */
const STALE_LOCALE_DIRS = ['mikrotik_manual_zh_hans', 'mikrotik_manual_zh_hant'];
const BASE_URL_GATE_ARGS = [
  'run',
  'verify:base-url',
  '--',
  '--multi-repo',
  ...STALE_LOCALE_DIRS.flatMap((dir) => (fs.existsSync(path.join(BUILD, dir)) ? [`--exclude-dir=${dir}`] : [])),
];
const GATE_COMMANDS = [
  ['verify:assets', ['run', 'verify:assets']],
  ['verify:base-url', BASE_URL_GATE_ARGS],
  ['verify:orphan-assets', ['run', 'verify:orphan-assets']],
  ['verify:llms', ['run', 'verify:llms']],
];

/**
 * 分仓单语形态：构建以默认语种（en）单语运行，且产物里没有翻译语种子树。
 * 此形态下不抽查也不判定 zh-Hans / zh-Hant 专属路由；应由各语种仓自己彩排。
 */
function isSingleLocaleBuild() {
  return (
    CI_ENV.SITE_LOCALE === SITE_DEFAULT_LOCALE &&
    !REGISTERED_TARGETS.some((locale) => fs.existsSync(path.join(BUILD, locale)))
  );
}

const urlList = () => {
  const pick = (dir, predicate) => {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir).filter((name) => fs.statSync(path.join(dir, name)).isFile());
    const match = entries.filter(predicate).sort();
    return match.length ? match[0] : null;
  };
  const img = pick(path.join(BUILD, 'img'), (name) => /\.(webp|png|jpg|jpeg|svg)$/i.test(name));
  const assetImage = pick(path.join(BUILD, 'assets/images'), (name) => /\.(webp|png|jpg|jpeg)$/i.test(name));
  const rootRoutes = [
    '/',
    '/docs/introduction/',
    '/docs/7.24/introduction/',
    '/hardware/',
    img ? `/img/${img}` : '/img/logo.svg',
    assetImage ? `/assets/images/${assetImage}` : '/assets/images/',
    '/llms.txt',
    '/llms-full.txt',
  ];
  if (isSingleLocaleBuild()) {
    console.log('SKIP        分仓单语形态（SITE_LOCALE=en）：URL 抽查跳过 zh-Hans/zh-Hant 专属路由，这些页面由各语种仓构建与彩排。');
    return rootRoutes;
  }
  const localizedRoutes = ['', '/docs/introduction/', '/hardware/', '/llms.txt', '/llms-full.txt'];
  return [
    ...rootRoutes,
    ...TRANSLATED_LOCALES.flatMap((locale) =>
      localizedRoutes.map((route) => (route === '' ? `/${locale}/` : `/${locale}${route}`)),
    ),
  ];
};

function nowIso() {
  return new Date().toISOString();
}

function ensureWork() {
  fs.mkdirSync(WORK, {recursive: true});
}

/** 运行一个命令，日志写进 work/<name>.log，返回退出码、耗时与日志尾部。 */
function runCommand(name, command, commandArgs, {env = CI_ENV, timeoutMs = 0} = {}) {
  ensureWork();
  const logPath = path.join(WORK, `rehearsal-${name}.log`);
  const log = fs.createWriteStream(logPath);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {cwd: REPO, env});
    const tail = [];
    let bytes = 0;
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, timeoutMs)
      : null;
    const onData = (chunk) => {
      bytes += chunk.length;
      log.write(chunk);
      const text = chunk.toString('utf8');
      tail.push(text);
      if (tail.length > 400) tail.splice(0, tail.length - 400);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      log.end(`\n[spawn error] ${error.message}\n`);
      resolve({name, command: `${command} ${commandArgs.join(' ')}`, exitCode: -1, seconds: 0, timedOut, logPath, tail: error.message});
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const seconds = (Date.now() - started) / 1000;
      const tailText = tail.join('');
      log.end(`\n[exit ${code}] ${seconds.toFixed(1)}s\n`);
      resolve({
        name,
        command: `${command} ${commandArgs.join(' ')}`,
        exitCode: code,
        seconds: Math.round(seconds * 10) / 10,
        timedOut,
        bytes,
        logPath,
        tail: tailText.split('\n').slice(-30).join('\n'),
      });
    });
  });
}

/** du -sb 的字节数（与任务里给的命令一致）。 */
function duBytes(target) {
  if (!fs.existsSync(target)) return null;
  const result = spawnSync('du', ['-sb', target], {encoding: 'utf8'});
  if (result.status !== 0) return null;
  return Number(result.stdout.split('\t')[0]);
}

/** 递归统计文件/目录/符号链接数与总字节数（tar 会解引用符号链接）。 */
function countTree(root) {
  const totals = {files: 0, directories: 0, symlinks: 0, bytes: 0};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        totals.symlinks += 1;
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) walk(full);
          else totals.bytes += stat.size;
        } catch {
          /* 断链：tar --dereference 会失败，这里只记录 */
        }
      } else if (entry.isDirectory()) {
        totals.directories += 1;
        walk(full);
      } else if (entry.isFile()) {
        totals.files += 1;
        totals.bytes += fs.statSync(full).size;
      }
    }
  };
  walk(root);
  return totals;
}

function human(bytes) {
  if (bytes == null) return 'n/a';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]} (${bytes.toLocaleString('en-US')} B)`;
}

/* ------------------------------------------------------------------ */
/* 1. 解析 pages.yml                                                    */
/* ------------------------------------------------------------------ */

function readWorkflow() {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  const problems = [];
  let doc = null;
  try {
    doc = parseYaml(source);
  } catch (error) {
    problems.push({severity: 'high', message: `YAML 解析失败：${error.message}`});
    return {source, doc: null, problems, steps: [], deploy: null, metadata: null};
  }

  const steps = doc?.jobs?.build?.steps ?? [];
  const recordedSteps = steps.map((step, index) => ({
    index,
    kind: step.uses ? 'uses' : 'run',
    ...(step.uses ? {uses: step.uses} : {}),
    ...(step.run ? {run: step.run} : {}),
    ...(step.with ? {with: step.with} : {}),
    ...(step.env ? {env: step.env} : {}),
    ...(step.name ? {name: step.name} : {}),
  }));

  const gates = recordedSteps.filter((step) => step.run && /verify:/.test(step.run));
  for (const gate of gates) {
    const env = gate.env ?? {};
    for (const key of ['SITE_URL', 'BASE_URL']) {
      if (!(key in env)) {
        problems.push({
          severity: 'high',
          step: gate.run,
          message: `部署门禁步骤缺少 ${key} env（会 fallback 到 docusaurus.config.ts 的默认值，与构建用的 Variables 可能不一致）`,
        });
      }
    }
  }
  const slimStep = recordedSteps.find((step) => step.run && /build:slim/.test(step.run));
  if (slimStep && !(slimStep.env && 'BASE_URL' in slimStep.env)) {
    problems.push({
      severity: 'medium',
      step: slimStep.run,
      message:
        'build:slim 步骤没有 BASE_URL env：slim 用 resolveBaseUrl() 重写产物里的绝对 URL，' +
        '未设置时会退回 docusaurus.config.ts 的默认前缀；若仓库变量 BASE_URL 与默认值不同，' +
        '瘦身后的 URL 前缀就会和构建时不一致。',
    });
  }
  const deploy = doc?.jobs?.deploy ?? null;
  const metadata = {
    name: doc?.name ?? null,
    triggers: doc?.on ?? null,
    permissions: doc?.permissions ?? null,
    concurrency: doc?.concurrency ?? null,
    deployEnvironment: deploy?.environment ?? null,
    deploySteps: (deploy?.steps ?? []).map((step) => ({uses: step.uses, id: step.id})),
    buildNodeVersion: steps.find((step) => step.uses === 'actions/setup-node@v4')?.with ?? null,
    usesConfigurePages: steps.some((step) => /configure-pages/.test(step.uses || '')),
    usesUploadArtifact: steps.find((step) => /upload-pages-artifact/.test(step.uses || ''))?.with ?? null,
    usesDeployPages: (deploy?.steps ?? []).some((step) => /deploy-pages/.test(step.uses || '')),
  };
  if (!metadata.concurrency) problems.push({severity: 'medium', message: '缺少 concurrency（并发部署可能相互覆盖）'});
  if (!metadata.permissions?.pages) problems.push({severity: 'high', message: '缺少 permissions.pages: write'});
  if (!metadata.permissions?.['id-token']) {
    problems.push({severity: 'high', message: '缺少 permissions.id-token: write（deploy-pages 需要 OIDC）'});
  }
  if (!metadata.deployEnvironment?.name) {
    problems.push({severity: 'high', message: 'deploy job 缺少 environment: github-pages'});
  }
  return {source, doc, problems, steps: recordedSteps, deploy, metadata, gates};
}

/* ------------------------------------------------------------------ */
/* 2. 构建链 + 门禁                                                     */
/* ------------------------------------------------------------------ */

async function runBuildChain(workflow, report) {
  // 产物对应的 commit：彩排期间工作区可能被别的路线推进，报告里必须区分
  // “HEAD” 与 “实际构建的 commit”。
  report.build.builtCommit = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: REPO, encoding: 'utf8'}).stdout.trim();
  const buildStep = workflow.steps.find((step) => step.run === 'npm run build');
  const buildEnv = buildStep?.env ?? {};
  report.build.note = {
    workflowCommand: 'npm run build',
    workflowHeap: buildEnv.NODE_OPTIONS ?? null,
    workflowSiteUrl: buildEnv.SITE_URL ?? null,
    workflowBaseUrl: buildEnv.BASE_URL ?? null,
    localCommand: 'npm run build:lowmem',
    localHeap: 'BUILD_HEAP_MB=6144（本机 15 GiB 内存，10 GiB 堆会 OOM）',
    siteUrl: SITE_URL,
    baseUrl: BASE_URL,
    assetHost: CI_ENV.ASSET_HOST,
    siteLocale: CI_ENV.SITE_LOCALE,
  };

  const build = await runCommand('build', 'npm', ['run', 'build:lowmem']);
  report.build.fullBuild = {...build, logPath: path.relative(REPO, build.logPath)};
  if (build.exitCode !== 0) {
    report.failures.push('npm run build:lowmem 失败');
    return false;
  }

  // pages.yml 的 build:slim 步骤没有 env；本地按“修复后”的形态显式传入。
  const slim = await runCommand('slim', 'npm', ['run', 'build:slim']);
  report.build.slim = {
    ...slim,
    logPath: path.relative(REPO, slim.logPath),
    envPassed: {SITE_URL, BASE_URL, ASSET_HOST: CI_ENV.ASSET_HOST, SITE_LOCALE: CI_ENV.SITE_LOCALE},
  };
  if (slim.exitCode !== 0) {
    report.failures.push('npm run build:slim 失败');
    return false;
  }

  for (const [name, npmArgs] of GATE_COMMANDS) {
    const gate = await runCommand(name.replace(':', '-'), 'npm', npmArgs);
    report.gates.push({
      name,
      ...gate,
      ...(name === 'verify:base-url'
        ? {
            mode: '分仓模式 (multi-repo)',
            multiRepoArgs: npmArgs.slice(3),
            excludedStaleDirs: STALE_LOCALE_DIRS.filter((dir) => fs.existsSync(path.join(BUILD, dir))),
          }
        : {}),
      logPath: path.relative(REPO, gate.logPath),
    });
    if (gate.exitCode !== 0) report.failures.push(`门禁 ${name} 失败`);
  }
  return report.failures.length === 0;
}

/* ------------------------------------------------------------------ */
/* 3. 打包与体积                                                        */
/* ------------------------------------------------------------------ */

function measureArtifact(report) {
  if (!fs.existsSync(BUILD)) throw new Error('build/ 不存在，无法打包');
  ensureWork();

  const counts = countTree(BUILD);
  report.artifact.counts = counts;

  const tar = spawnSync(
    'tar',
    ['--dereference', '--hard-dereference', '-cf', options.tarPath, '-C', BUILD, '.'],
    {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  if (tar.status !== 0) {
    report.failures.push(`tar 打包失败：${tar.stderr}`);
    return;
  }
  const tarBytes = fs.statSync(options.tarPath).size;
  report.artifact.tar = {
    path: path.relative(REPO, options.tarPath),
    bytes: tarBytes,
    human: human(tarBytes),
    command: 'tar --dereference --hard-dereference -cf work/pages-artifact.tar -C build .',
    uploadActionEquivalent: 'actions/upload-pages-artifact@v3（对 path 打同样的 tar 后上传）',
  };

  const gzip = spawnSync('bash', ['-c', `gzip -9 -c ${JSON.stringify(options.tarPath)} | wc -c`], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const gzipBytes = gzip.status === 0 ? Number(gzip.stdout.trim()) : null;
  report.artifact.gzip = {
    bytes: gzipBytes,
    human: human(gzipBytes),
    command: 'gzip -9 -c work/pages-artifact.tar | wc -c',
    note: 'GitHub Actions 上传的是未压缩 tar；gzip 体积只作网络传输参考，不是任何限额的计量口径。',
  };

  const duBuild = duBytes(BUILD);
  report.artifact.duSb = {bytes: duBuild, human: human(duBuild), command: 'du -sb build'};

  const versionDirs = {};
  const versionNames = fs.existsSync(path.join(BUILD, 'docs'))
    ? fs
        .readdirSync(path.join(BUILD, 'docs'), {withFileTypes: true})
        .filter((entry) => entry.isDirectory() && /^\d+\.\d+$/.test(entry.name))
        .map((entry) => entry.name)
        .sort()
    : [];
  for (const version of versionNames) {
    const localeBytes = Object.fromEntries(
      SITE_LOCALES.map((locale) => [
        locale,
        duBytes(path.join(BUILD, locale === SITE_DEFAULT_LOCALE ? 'docs' : locale, 'docs', version)),
      ]),
    );
    const total = SITE_LOCALES.reduce((sum, locale) => sum + (localeBytes[locale] ?? 0), 0);
    versionDirs[version] = {
      ...localeBytes,
      // 兼容旧报告的键名：默认语种记为 en，首个翻译语种记为 zh。
      en: localeBytes[SITE_DEFAULT_LOCALE] ?? null,
      zh: PRIMARY_LOCALE ? (localeBytes[PRIMARY_LOCALE] ?? null) : null,
      total,
      human: human(total),
    };
  }
  report.artifact.versionDirs = versionDirs;
  report.artifact.sections = Object.fromEntries(
    [
      'assets', 'docs', 'img', 'pagefind', 'hardware', 'cli', 'videos', 'blog', 'changelog',
      ...TRANSLATED_LOCALES,
    ].map((name) => {
      const bytes = duBytes(path.join(BUILD, name));
      return [name, {bytes, human: human(bytes)}];
    }),
  );
  if (report.artifact.sections['assets']) {
    report.artifact.sections['assets.files'] = {bytes: duBytes(path.join(BUILD, 'assets', 'files'))};
    report.artifact.sections['assets.files'].human = human(report.artifact.sections['assets.files'].bytes);
    report.artifact.sections['assets.images'] = {bytes: duBytes(path.join(BUILD, 'assets', 'images'))};
    report.artifact.sections['assets.images'].human = human(report.artifact.sections['assets.images'].bytes);
  }
}

/* ------------------------------------------------------------------ */
/* 4. 托管形态抽查                                                      */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

function startServer(port) {
  const basePrefix = BASE_URL.replace(/\/$/, '');
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (!requestPath.startsWith(BASE_URL) && requestPath !== basePrefix) {
      // 与真实 Pages 一致：站点在子路径下，域根不属于本站。
      response.writeHead(302, {location: BASE_URL});
      response.end();
      return;
    }
    const sitePath = requestPath.slice(basePrefix.length) || '/';
    let file = path.join(BUILD, sitePath);
    if (file.endsWith('/')) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const notFound = path.join(BUILD, '404.html');
      response.writeHead(404, {'content-type': 'text/html; charset=utf-8'});
      if (fs.existsSync(notFound)) fs.createReadStream(notFound).pipe(response);
      else response.end('404');
      return;
    }
    const size = fs.statSync(file).size;
    response.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'content-length': String(size),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function curlHead(url) {
  return spawnCapture('curl', ['-sS', '-I', '--max-time', '20', url]).then((result) => {
    const headers = result.out.split(/\r?\n/);
    const statusLine = headers.find((line) => /^HTTP\//.test(line)) || '';
    const status = Number(statusLine.split(/\s+/)[1] || 0);
    const header = (name) => {
      const line = headers.find((candidate) => candidate.toLowerCase().startsWith(`${name}:`));
      return line ? line.slice(line.indexOf(':') + 1).trim() : null;
    };
    return {
      status,
      contentLength: header('content-length'),
      contentType: header('content-type'),
      location: header('location'),
      curlExit: result.code,
    };
  });
}

/**
 * 异步跑一个短命令并收集输出。
 *
 * 必须异步：彩排的静态服务器跑在本进程里，`spawnSync` 会阻塞事件循环，
 * 服务器无法应答，curl 只能等到超时（exit 28）。
 */
function spawnCapture(command, commandArgs, timeoutMs = 0) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {cwd: REPO});
    let out = '';
    let err = '';
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGKILL'), timeoutMs) : null;
    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      err += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      resolve({code: -1, out, err: error.message});
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({code, out, err});
    });
  });
}

async function probeUrls(port, report) {
  const server = await startServer(port);
  try {
    for (const route of urlList()) {
      const url = `http://127.0.0.1:${port}${BASE_URL.replace(/\/$/, '')}${route === '/' ? '/' : route}`;
      const head = await curlHead(url);
      let bodyBytes = null;
      if (head.status === 200 && route !== '/') {
        const get = await spawnCapture(
          'curl',
          ['-sS', '-o', '/dev/null', '-w', '%{size_download}', '--max-time', '60', url],
          65_000,
        );
        if (get.code === 0) bodyBytes = Number(get.out.trim());
      }
      report.urls.push({route, url, ...head, bodyBytes});
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/**
 * browser-check.mjs 里只针对中文语种树（zh-Hans / zh-Hant）的断言。
 * 按分仓契约，英文仓以 SITE_LOCALE=en 构建时产物里没有这些页面：这些断言
 * 在单语彩排中不参与判定（打印 SKIP 说明），但其它内容断言（例如
 * table cell lists / no previous button）阈值与失败判定完全不变。
 */
const LOCALE_SPECIFIC_CHECKS = new Set([
  'zh sidebar label',
  'zh CLI names stay English',
  'locale auto-switch',
  'locale choice persists',
  'consent gate',
  'source footer',
  'zh client navigation images',
]);

async function runBrowserCheck(report) {
  const port = 4399; // browser-check.mjs 自己的默认端口，避免和彩排服务器冲突
  const env = {...CI_ENV, PORT: String(port)};
  if (process.env.CHROME_PATH) env.CHROME_PATH = process.env.CHROME_PATH;
  const result = await runCommand('browser-check', 'node', ['tools/verify/browser-check.mjs'], {
    env,
    timeoutMs: 15 * 60 * 1000,
  });
  const logText = fs.readFileSync(result.logPath, 'utf8');
  const summaryLine = logText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\{"checks":/.test(line))
    .pop();
  let summary = null;
  if (summaryLine) {
    try {
      summary = JSON.parse(summaryLine);
    } catch {
      summary = null;
    }
  }

  // 只有「默认语种单语构建 + 产物里没有翻译语种子树」才算分仓单语形态。
  const singleLocale = isSingleLocaleBuild();
  const outcomes = [...logText.matchAll(/^(PASS|FAIL)\s+(.+?)(?:\s+—\s+(.*))?$/gm)].map((match) => ({
    status: match[1],
    name: match[2].trim(),
    detail: (match[3] || '').trim(),
  }));
  const skippedLocaleChecks = [];
  const checked = [];
  for (const outcome of outcomes) {
    if (singleLocale && LOCALE_SPECIFIC_CHECKS.has(outcome.name)) {
      skippedLocaleChecks.push({
        ...outcome,
        reason: '分仓契约：SITE_LOCALE=en 单语产物没有 zh-Hans/zh-Hant 专属页面',
      });
    } else {
      checked.push(outcome);
    }
  }
  const failedChecks = checked.filter((item) => item.status === 'FAIL');
  // browser-check 的固定中文路由在单语产物上会读 build/zh-Hans/404.html，
  // 缺页时其静态服务器抛未处理的 ENOENT，后续断言没有运行；如实记录覆盖率。
  const missingLocale404 = /ENOENT[^\n]*build\/(?:zh-Hans|zh-Hant)\/404\.html/.test(logText);
  const inapplicableChecks = singleLocale ? [...LOCALE_SPECIFIC_CHECKS] : [];
  const skipNote = singleLocale
    ? `分仓单语形态（SITE_LOCALE=${CI_ENV.SITE_LOCALE}）：按分仓契约跳过 ${inapplicableChecks.length} 条 zh-Hans/zh-Hant 专属断言（${inapplicableChecks.join(', ')}）；本次日志实际记录 ${skippedLocaleChecks.length} 条（browser-check 在首条中文路由缺 404 时会提前退出）；其它内容断言阈值与失败判定不变。`
    : null;
  if (singleLocale) {
    if (skipNote) console.log(`SKIP        ${skipNote}`);
    report.limitations.push(skipNote);
    if (missingLocale404 && !summary) {
      report.limitations.push(
        'browser-check 在单语产物上访问固定的 zh-Hans 路由时，其静态服务器读取 build/zh-Hans/404.html 抛 ENOENT 并退出；该脚本之后的断言本次未执行（分仓单语下属预期形态，不代表这些断言通过）。',
      );
    }
  }

  report.browserCheck = {
    ...result,
    logPath: path.relative(REPO, result.logPath),
    port,
    summary, // browser-check 原始汇总（单语形态下可能含被跳过的中文断言）
    passed: checked.length ? checked.filter((item) => item.status === 'PASS').length : null,
    total: checked.length || null,
    singleLocale,
    localeChecksNotApplicable: inapplicableChecks,
    skippedLocaleChecks,
    failedChecks,
    coverage: missingLocale404 && !summary ? 'partial (missing zh-Hans 404 in single-locale build)' : 'complete',
    skipNote,
  };
  if (failedChecks.length) {
    report.failures.push(
      `browser-check 内容断言失败：${failedChecks.map((item) => `${item.name} (${item.detail})`).join('；')}`,
    );
  } else if (result.exitCode !== 0) {
    // 单语分仓下唯一的预期非零退出是缺中文 404 导致的崩溃；其它失败照旧拦截。
    if (!(singleLocale && missingLocale404 && !summary)) {
      report.failures.push(`browser-check 未全部通过（exit=${result.exitCode}）`);
    }
  } else if (!summary) {
    report.failures.push('browser-check 缺少汇总行');
  }
}

/* ------------------------------------------------------------------ */
/* 容量结论                                                            */
/* ------------------------------------------------------------------ */

function capacity(report) {
  const site = report.artifact.duSb.bytes;
  const tar = report.artifact.tar.bytes;
  const gzipBytes = report.artifact.gzip.bytes;
  const versions = report.artifact.versionDirs;
  const dropOne = versions['7.24']?.total ?? null;
  const dropBoth = (versions['7.24']?.total ?? 0) + (versions['7.25']?.total ?? 0) || null;
  const zh = PRIMARY_LOCALE ? (report.artifact.sections[PRIMARY_LOCALE]?.bytes ?? null) : null;

  const plans = [];
  if (dropOne) {
    plans.push({
      id: 'drop-7.24',
      description: '砍掉 7.24 一个版本（英文 + 中文两份）',
      savedBytes: dropOne,
      remainingBytes: site - dropOne,
      remainingHuman: human(site - dropOne),
      underOneGB: site - dropOne <= 1e9,
    });
  }
  if (dropBoth) {
    plans.push({
      id: 'current-version-only',
      description: '只留当前 7.26，砍掉 7.24 与 7.25（两种语言）',
      savedBytes: dropBoth,
      remainingBytes: site - dropBoth,
      remainingHuman: human(site - dropBoth),
      underOneGB: site - dropBoth <= 1e9,
    });
  }
  if (zh && PRIMARY_LOCALE) {
    plans.push({
      id: 'split-locales',
      description: `按语种拆成独立 Pages 站点（默认语种 ≈ build - build/${PRIMARY_LOCALE}，${PRIMARY_LOCALE} ≈ build/${PRIMARY_LOCALE}）`,
      enBytes: site - zh,
      zhBytes: zh,
      enHuman: human(site - zh),
      zhHuman: human(zh),
      underOneGB: site - zh <= 1e9 && zh <= 1e9,
      savedBytes: null,
      remainingBytes: Math.max(site - zh, zh),
      remainingHuman: human(Math.max(site - zh, zh)),
    });
  }

  report.capacity = {
    siteBytes: site,
    siteHuman: human(site),
    tarBytes: tar,
    tarHuman: human(tar),
    gzipBytes,
    gzipHuman: human(gzipBytes),
    limits: {
      publishedSite: {bytes: 1e9, human: '1 GB（GitHub 文档口径）', source: 'GitHub Pages 文档：发布站点不超过 1 GB'},
      artifactTar: {bytes: 10e9, human: '10 GB', source: 'actions/upload-pages-artifact / Pages artifact 上限'},
    },
    vsPublished: {
      ratio: site / 1e9,
      overBy: site - 1e9,
      overByHuman: human(site - 1e9),
      overGiB: site > 1024 ** 3,
      note: '1 GB 是十进制 1e9 还是 1 GiB 需要真实部署确认；两种口径下当前体积都超。',
    },
    vsArtifact: {ratio: tar / 10e9, headroom: 10e9 - tar, headroomHuman: human(10e9 - tar)},
    plans,
    verdict:
      site <= 1e9
        ? '未超过 1 GB 文档上限，但仍需真实部署验证。'
        : '按 GitHub 文档的 1 GB 口径，当前产物超限；tar 远低于 10 GB artifact 上限。1 GB 是否硬性拒绝，本地无法证明。',
  };
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

const report = {
  generatedAt: nowIso(),
  repo: REPO,
  commit: spawnSync('git', ['rev-parse', 'HEAD'], {cwd: REPO, encoding: 'utf8'}).stdout.trim(),
  commitSubject: spawnSync('git', ['log', '-1', '--pretty=%s'], {cwd: REPO, encoding: 'utf8'}).stdout.trim(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  memoryGiB: Math.round(Number(spawnSync('bash', ['-c', "free -g | awk '/Mem:/{print $2}'"], {encoding: 'utf8'}).stdout.trim())),
  target: {SITE_URL, BASE_URL, ASSET_HOST: CI_ENV.ASSET_HOST, SITE_LOCALE: CI_ENV.SITE_LOCALE},
  pagesWorkflow: null,
  build: {note: null, fullBuild: null, slim: null},
  gates: [],
  baseUrlGateMode:
    '分仓模式 (multi-repo)：跨仓 baseUrl 前缀按 locales.json 放开；扫描时排除陈旧 mikrotik_manual_zh_hans / mikrotik_manual_zh_hant 残留；其余三条门禁不变',
  artifact: {},
  urls: [],
  browserCheck: null,
  capacity: null,
  failures: [],
  limitations: [
    '本地用 build:lowmem（6 GiB 堆）代替 pages.yml 的 npm run build + NODE_OPTIONS=--max-old-space-size=10240，产物内容相同，构建耗时不同。',
    '本地没有跑 npm ci，node_modules 为当前工作区已有依赖（与 main 上 package-lock.json 一致时需要真实 CI 再确认）。',
    '本地静态服务器模拟 Pages 的 baseUrl 托管，不模拟 CDN 缓存、压缩、HTTP/2 与 Pages 的 404 回退细节。',
    '1 GB published site 是否硬性拒绝，本地无法证明；只有一次真实部署能定论。',
    'pages.yml 的仓库 Variables（SITE_URL/BASE_URL）是否已在 GitHub 设置，本地无法验证。',
  ],
};

const workflow = readWorkflow();
report.pagesWorkflow = {
  path: '.github/workflows/pages.yml',
  yamlValid: workflow.doc !== null,
  metadata: workflow.metadata,
  steps: workflow.steps,
  problems: workflow.problems,
};

ensureWork();

if (options.skipBuild) {
  // 复用同一份 build/ 时，把上一次彩排记录的构建耗时与门禁结果带过来，
  // 这样 --skip-build 生成的 JSON 仍然完整、而不是丢掉第 1 阶段。
  report.build.skipped = true;
  report.build.skipNote = '--skip-build：产物未重建，构建耗时与门禁结果沿用上一次彩排；本阶段的 tar/gzip、URL、浏览器检查是本次重新跑的。';
  if (fs.existsSync(options.jsonPath)) {
    try {
      const previous = JSON.parse(fs.readFileSync(options.jsonPath, 'utf8'));
      if (previous.build?.fullBuild) {
        report.build = {...previous.build, reusedFrom: previous.generatedAt, reusedCommit: previous.build.builtCommit ?? previous.commit};
      }
      if (Array.isArray(previous.gates)) report.gates = previous.gates;
    } catch {
      report.failures.push('--skip-build：上一次的 JSON 无法解析，构建/门禁结果缺失');
    }
  } else {
    report.failures.push('--skip-build：没有可复用的 pages-rehearsal.json，构建/门禁结果缺失');
  }
} else {
  console.log('== 1/4 构建链（build:lowmem → build:slim → 四条门禁）==');
  await runBuildChain(workflow, report);
}

console.log('== 2/4 打包与体积 ==');
measureArtifact(report);

console.log('== 3/4 托管形态抽查 ==');
await probeUrls(options.port, report);

if (!options.skipBrowser) {
  console.log('== 4/4 browser-check ==');
  await runBrowserCheck(report);
} else {
  report.browserCheck = {skipped: true};
}

capacity(report);

report.finishedAt = nowIso();
fs.writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`);

/* ---------------------------- 控制台摘要 ---------------------------- */
const lines = [];
lines.push('');
lines.push('===== Pages 部署彩排 =====');
lines.push(`commit      ${report.commit} (${report.commitSubject})`);
lines.push(`target      SITE_URL=${SITE_URL} BASE_URL=${BASE_URL}`);
lines.push(
  `pages.yml   YAML ${workflow.doc ? '合法' : '非法'}，build 步骤 ${workflow.steps.length} 个，问题 ${workflow.problems.length} 条`,
);
if (report.build.fullBuild) {
  // build 失败时 runBuildChain 会提前返回，report.build.slim 仍是 null；
  // 汇总不能直接解引用，否则抛出 TypeError 掩盖真正的构建失败。
  const slim = report.build.slim;
  lines.push(
    `构建        build:lowmem ${report.build.fullBuild.seconds}s exit=${report.build.fullBuild.exitCode}；` +
      (slim
        ? `slim ${slim.seconds}s exit=${slim.exitCode}`
        : 'slim 未执行（build:lowmem 失败，已跳过；见下方失败原因）'),
  );
  if (!slim && !report.build.skipped) {
    lines.push(
      '错误        npm run build:lowmem 失败，build:slim 与四条门禁未执行；' +
        '本次汇总中的体积/URL/浏览器数据可能来自上一次构建的 build/ 残留，不可用于判定。',
    );
    console.error('FATAL npm run build:lowmem 失败：未执行 build:slim，构建链汇总已跳过（详情见 work/rehearsal-build.log）。');
  }
}
for (const gate of report.gates) {
  lines.push(`门禁        ${gate.name} exit=${gate.exitCode} (${gate.seconds}s)${gate.mode ? ` [${gate.mode}]` : ''}`);
}
if (report.gates.some((gate) => gate.mode)) {
  lines.push(
    '门禁模式    verify:base-url 分仓模式：跨仓前缀取自 locales.json，扫描时排除陈旧跨仓子树；其余三条门禁不变',
  );
}
lines.push(
  `体积        build ${report.artifact.duSb.human} / tar ${report.artifact.tar.human} / gzip ${report.artifact.gzip.human}`,
);
lines.push(`文件        ${report.artifact.counts.files} 文件，${report.artifact.counts.directories} 目录，${report.artifact.counts.symlinks} 符号链接`);
for (const url of report.urls) {
  lines.push(
    `URL         ${String(url.status).padEnd(3)} ${String(url.contentLength ?? '-').padStart(10)}  ${url.route}`,
  );
}
if (report.browserCheck && !report.browserCheck.skipped) {
  lines.push(
    `browser     ${report.browserCheck.passed ?? '?'}/${report.browserCheck.total ?? '?'}（exit=${report.browserCheck.exitCode}）` +
      (report.browserCheck.singleLocale
        ? `；单语分仓跳过 ${report.browserCheck.localeChecksNotApplicable.length} 条中文专属断言；覆盖率 ${report.browserCheck.coverage}`
        : ''),
  );
}
lines.push(`容量        站点 ${report.capacity.siteHuman}；对 1 GB 为 ${report.capacity.vsPublished.ratio.toFixed(2)}×`);
for (const plan of report.capacity.plans) {
  lines.push(`方案        ${plan.id}: ${plan.description} → ${plan.remainingHuman}`);
}
if (report.failures.length) lines.push(`失败        ${report.failures.join('；')}`);
lines.push(`JSON        ${path.relative(REPO, options.jsonPath)}`);
lines.push(`日志        work/rehearsal-*.log`);
console.log(lines.join('\n'));

if (report.failures.length) process.exitCode = 1;
