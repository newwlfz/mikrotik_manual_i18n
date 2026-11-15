/**
 * Shared code-fence language rules.
 *
 * The same `config/code-fence-languages.yml` drives two consumers:
 *
 *   - `tools/build/normalize-fences.mjs`, which reports (and optionally writes)
 *     the markdown that would change;
 *   - `src/remark/fence-language.mjs`, which applies the same result while
 *     Docusaurus compiles every locale and every version, so a page does not
 *     have to be rewritten on disk to render highlighted.
 *
 * Keep the matching semantics here and nowhere else; the checker and the
 * renderer must agree on which block gets which language.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const DEFAULT_CONFIG = 'config/code-fence-languages.yml';
const DOC_PATH_RE = /(?:^|\/)(?:versioned_docs\/version-[^/]+\/|docs\/)(.*)$/;
/**
 * A localised overlay is compiled from its own tree, so the path Docusaurus
 * hands a remark plugin is
 * `i18n/<locale>/docusaurus-plugin-content-docs[-<plugin>]/<current|version-x>/<route>`.
 * Without stripping that prefix every `path_rules` entry stopped matching in the
 * Chinese build, which is why a bare ``` fence in `mobile-networking/` was
 * highlighted in English and plain black in Chinese.
 */
const I18N_PATH_RE =
  /(?:^|\/)i18n\/[^/]+\/docusaurus-plugin-content-[^/]+\/(?:current|version-[^/]+)\/(.*)$/;
// `hardware/` is its own Docusaurus docs plugin root, so `DOC_PATH_RE` never
// matches it. Docusaurus hands remark plugins the absolute path
// (`/repo/hardware/...`), so the test must accept a `/hardware/` segment as
// well as a site-relative `hardware/` prefix.
const HARDWARE_PATH_RE = /(?:^|\/)hardware\//;

function compileRules(rules) {
  return (rules || []).map((rule) => ({
    ...rule,
    paths: Array.isArray(rule.paths) ? rule.paths : rule.paths ? [rule.paths] : [],
    regex: new RegExp(rule.pattern),
  }));
}

export function loadFenceConfig(configPath = DEFAULT_CONFIG) {
  const file = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  const raw = yaml.load(fs.readFileSync(file, 'utf8')) || {};
  return {
    aliases: new Map(Object.entries(raw.aliases || {})),
    autoDetect: compileRules(raw.auto_detect),
    pathRules: compileRules(raw.path_rules),
    prismLanguages: raw.prism_languages || [],
  };
}

/**
 * Path relative to the docs root, so `docs/mobile-networking/x.md`,
 * `versioned_docs/version-7.25/mobile-networking/x.md` and
 * `i18n/zh-Hans/docusaurus-plugin-content-docs/version-7.25/mobile-networking/x.md`
 * all share one rule path. The locale and release are not part of the rules: a
 * block that is a RouterOS script in English is one in Chinese too.
 */
export function canonicalDocPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const localised = I18N_PATH_RE.exec(normalized);
  if (localised) return localised[1];
  const match = DOC_PATH_RE.exec(normalized);
  return match ? match[1] : normalized.replace(/^\.?\//, '');
}

/**
 * Whether a compiled file belongs to the standalone `hardware` docs plugin.
 * Accepts both the relative path used by tooling and the absolute path
 * Docusaurus passes to remark plugins.
 */
export function isHardwareDocPath(filePath) {
  return HARDWARE_PATH_RE.test(String(filePath || '').replace(/\\/g, '/'));
}

export function firstContentLine(value) {
  for (const line of String(value || '').split(/\r?\n/)) {
    if (line.trim()) return line.trim();
  }
  return '';
}

/**
 * Lines worth classifying a bare fence by, in order.
 *
 * A capture can swallow a Markdown heading *into* a fence: the Bluetooth tag
 * page opens its decoding script with `#### Script for decoding`, and the
 * RouterOS code only starts four lines later. Testing the first content line
 * alone classified the whole script as plain text in every language and every
 * version. Headings are scaffolding, not code, so they are skipped here; the
 * remaining lines keep their order and only the first `limit` are returned.
 *
 * This is a *candidate list*, not a verdict: a language is only assigned when
 * one of the conservative rules in `config/code-fence-languages.yml` matches,
 * so skipping a heading cannot by itself turn a shell script into RouterOS.
 */
export function candidateContentLines(value, limit = 12) {
  const out = [];
  for (const line of String(value || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

function matchesPath(prefix, docPath) {
  if (!prefix) return true;
  const clean = prefix.replace(/^\.?\//, '');
  return docPath === clean || docPath.startsWith(clean.endsWith('/') ? clean : `${clean}/`);
}

/**
 * The first matching rule wins: path-scoped rules before global ones.
 *
 * `lines` is the ordered candidate list from `candidateContentLines`. Testing
 * more than one line is what lets a fence whose first lines are a captured
 * heading or an introductory sentence still be recognised by its code, without
 * weakening any individual rule.
 */
export function findBareRule(config, docPath, lines) {
  const candidates = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  if (candidates.length === 0) return null;
  for (const rule of config.pathRules) {
    if (rule.paths.length && !rule.paths.some((prefix) => matchesPath(prefix, docPath))) continue;
    if (candidates.some((line) => rule.regex.test(line))) return rule;
  }
  for (const rule of config.autoDetect) {
    if (candidates.some((line) => rule.regex.test(line))) return rule;
  }
  return null;
}

/**
 * `text` / `plaintext` are "no colour" markers, not languages.
 *
 * The manual wraps thousands of RouterOS commands in ` ```text `, which renders
 * as black text. Treating that as a terminal language is why 443 blocks stayed
 * uncoloured: the alias `text → plaintext` resolved and the block was never
 * offered to `path_rules` / `auto_detect`. Those info strings are now the same
 * as a bare fence — classified from the path and the candidate content lines
 * (the first content line, then the block itself; see
 * `candidateContentLines`) — and `plaintext` is only the final fallback when
 * nothing matches.
 */
const UNLABELLED = new Set(['', 'text', 'plaintext', 'txt', 'none', 'plain']);

/**
 * Resolve one fence. `info` is everything after the opening backticks.
 * Returns the replacement info string and why it changed, if it changed.
 */
export function resolveFenceLanguage({config, info, firstLine, content, docPath}) {
  const trimmed = String(info || '').trim();
  const tokens = trimmed ? trimmed.split(/\s+/) : [];
  const lang = tokens[0] || '';
  const extra = tokens.slice(1);
  const withLanguage = (language) => [language, ...extra].join(' ').trim();
  const target = lang ? config.aliases.get(lang.toLowerCase()) : null;
  const resolved = target || lang;

  if (UNLABELLED.has(lang.toLowerCase()) || UNLABELLED.has(resolved.toLowerCase())) {
    const candidates = [];
    if (firstLine) candidates.push(String(firstLine).trim());
    for (const line of candidateContentLines(content ?? firstLine)) {
      if (!candidates.includes(line)) candidates.push(line);
    }
    const rule = findBareRule(config, docPath, candidates);
    if (rule) {
      return {
        info: withLanguage(rule.language),
        changed: true,
        kind: 'auto',
        reason: rule.reason || '',
        from: lang || undefined,
      };
    }
    // A bare fence stays bare: adding `plaintext` to it would rewrite every
    // unclassified block in the repository for no rendering gain.
    if (!lang) return {info: '', changed: false, kind: 'none'};
    const fallback = resolved || 'plaintext';
    return {
      info: withLanguage(fallback),
      changed: fallback !== lang,
      kind: 'none',
    };
  }

  if (target && target !== lang) {
    return {
      info: withLanguage(target),
      changed: true,
      kind: 'alias',
      from: lang,
      to: target,
    };
  }
  return {info: trimmed, changed: false, kind: 'none'};
}
