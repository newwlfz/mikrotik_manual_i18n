#!/usr/bin/env node
/**
 * 已知译文：在链尾把已经审核过的英文块强制替换成中文。
 *
 * `apply` 与 `derive` 都会用翻译记忆（TM）重建正文，而 TM 里没有的块只能留在
 * 英文；模型偶尔也会把一段 `:::info` 只翻一半，留下“中文 + 英文”的混合容器。
 * 这类块不该靠手工改 `i18n/` 下的文件解决（下一次 apply 会覆盖），也不该在
 * derive 内部开特例，所以统一放在流水线最后一步：
 *
 *   config/known-translations.yml
 *     schema: 1
 *     <locale>:                                            # 每个语种一个顶层键
 *       - paths: ["diagnostics-.../traffic-generator.md"]   # 可选；省略即全站
 *         sections: ["docs-7.24"]                        # 可选；只作用于某几个 section
 *         from: "English block, byte for byte as it lands in the overlay"
 *         to: "审核过的中文"
 *
 * 目标语种由 `--locale=` 决定（默认 zh-Hans，须在 docusaurus.config.ts 里启用），
 * 顶层键按该语种取；同时读取 `config/translation-patches/<locale>/<section>/<rel>.yml` 里的
 * `replace` 规则（那份数据的主人是 apply，这里只补一次同样的替换，好让 derive
 * 之后的结果与 apply 一致）。
 *
 * 只改已存在的 overlay：缺失的页面由 `translate apply` 负责生成，这里不造文件。
 *
 *   node tools/translate/apply-known-translations.mjs                        # 写入
 *   node tools/translate/apply-known-translations.mjs --check                 # 只报告
 *   node tools/translate/apply-known-translations.mjs --locale=zh-Hans --check
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  DEFAULT_TARGET_LOCALE,
  LocaleError,
  assertTranslationLocale,
  sectionsFor,
  patchDir,
  REPO,
  walkMarkdown,
  relative,
} from './lib/paths.mjs';

const CHECK = process.argv.includes('--check');
const REQUESTED_LOCALE = process.argv
  .find((arg) => arg.startsWith('--locale='))
  ?.slice('--locale='.length);
// `--check` is read-only, so a locale that is only conventional can be probed.
let LOCALE;
try {
  LOCALE = assertTranslationLocale(REQUESTED_LOCALE || DEFAULT_TARGET_LOCALE, {
    readOnly: CHECK,
  });
} catch (error) {
  // A bad `--locale=` is a user error: one line, no stack trace.
  if (!(error instanceof LocaleError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
const KNOWN_FILE = path.join(REPO, 'config/known-translations.yml');
const PATCH_ROOT = patchDir(LOCALE);

/** `paths` 省略即全站；否则按 overlay 相对路径做精确或后缀匹配。 */
function matches(rule, rel) {
  const paths = Array.isArray(rule.paths) ? rule.paths : rule.paths ? [rule.paths] : [];
  if (paths.length === 0) return true;
  return paths.some((entry) => {
    const wanted = String(entry).replace(/^\/+/, '');
    return rel === wanted || rel.endsWith(`/${wanted}`) || rel.endsWith(wanted);
  });
}

function loadKnown() {
  if (!fs.existsSync(KNOWN_FILE)) return [];
  const data = YAML.parse(fs.readFileSync(KNOWN_FILE, 'utf8')) || {};
  const entries = data[LOCALE] || [];
  const rules = [];
  for (const entry of entries) {
    if (!entry || typeof entry.from !== 'string' || typeof entry.to !== 'string') continue;
    rules.push({source: 'known', paths: entry.paths, sections: entry.sections, from: entry.from, to: entry.to, note: entry.note});
  }
  return rules;
}

/** 递归收集 `.yml`（`walkMarkdown` 只认 Markdown，补丁文件是 `<rel>.md.yml`）。 */
function walkYaml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkYaml(full, out);
    else if (entry.name.endsWith('.yml')) out.push(full);
  }
  return out;
}

/** `config/translation-patches/<locale>/<section>/<rel>.yml` -> 该 overlay 的 replace 规则。 */
function loadPatchRules() {
  const rules = [];
  for (const section of sectionsFor(LOCALE)) {
    const dir = path.join(PATCH_ROOT, section.name);
    if (!fs.existsSync(dir)) continue;
    for (const file of walkYaml(dir)) {
      const rel = relative(dir, file).replace(/\.yml$/, '');
      const data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
      for (const rule of data.replace || []) {
        if (!rule || typeof rule.from !== 'string' || typeof rule.to !== 'string') continue;
        rules.push({source: `patch:${section.name}/${rel}`, section: section.name, paths: [rel], from: rule.from, to: rule.to});
      }
    }
  }
  return rules;
}

const rules = [...loadKnown(), ...loadPatchRules()];
const report = {schema: 1, locale: LOCALE, mode: CHECK ? 'check' : 'write', rules: rules.length, sections: {}, totals: {files: 0, changed: 0, replacements: 0, pending: 0}};

for (const section of sectionsFor(LOCALE)) {
  const dir = path.join(REPO, section.overlay);
  const sectionReport = {files: 0, changed: 0, replacements: 0};
  for (const file of walkMarkdown(dir)) {
    const rel = relative(dir, file);
    const text = fs.readFileSync(file, 'utf8');
    let out = text;
    let hits = 0;
    for (const rule of rules) {
      if (rule.section && rule.section !== section.name) continue;
      if (Array.isArray(rule.sections) && !rule.sections.includes(section.name)) continue;
      if (!matches(rule, rel)) continue;
      const count = out.split(rule.from).length - 1;
      if (count === 0) continue;
      out = out.split(rule.from).join(rule.to);
      hits += count;
    }
    sectionReport.files++;
    report.totals.files++;
    if (hits === 0) continue;
    if (out === text) continue;
    sectionReport.changed++;
    sectionReport.replacements += hits;
    report.totals.changed++;
    report.totals.replacements += hits;
    report.totals.pending++;
    if (!CHECK) fs.writeFileSync(file, out);
  }
  report.sections[section.name] = sectionReport;
}

console.log(JSON.stringify(report, null, 1));
console.log(
  CHECK
    ? `known translations would touch ${report.totals.changed} overlay file(s), ${report.totals.replacements} replacement(s)`
    : `known translations touched ${report.totals.changed} overlay file(s), ${report.totals.replacements} replacement(s)`,
);
