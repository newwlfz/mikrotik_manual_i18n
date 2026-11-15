#!/usr/bin/env node
/**
 * Code-fence colouring coverage, read-only.
 *
 * A fence with no info string (or `text`/`plaintext`, which are "no colour"
 * markers rather than a language) renders as black text. `src/lib/fence-rules.mjs`
 * classifies those blocks at build time, so the question this report answers is:
 * how many uncoloured blocks does each tree still have, how many of them can the
 * rules classify, and how many *look* like RouterOS but would stay black?
 *
 *   node tools/verify/fence-coverage.mjs
 *   node tools/verify/fence-coverage.mjs --strict
 *   node tools/verify/fence-coverage.mjs --strict --threshold=5
 *
 * `--strict` fails when more than `--threshold` percent of the fences look like
 * RouterOS yet would not be highlighted as `ros`. That is the gap that makes a
 * Chinese page show a RouterOS script as plain text while the English page
 * highlights it.
 *
 * Only the reader matters here: nothing under `docs/` or `versioned_docs/` is
 * rewritten. The markdown keeps its info string; `src/remark/fence-language.mjs`
 * applies the same rules while Docusaurus compiles every locale and version.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  canonicalDocPath,
  candidateContentLines,
  firstContentLine,
  loadFenceConfig,
  resolveFenceLanguage,
} from '../../src/lib/fence-rules.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(REPO, 'config/code-fence-languages.yml');
const TREE_ROOT = 'versioned_docs';

/** `text`/`plaintext` are "no colour", not a language (see the YAML comment). */
const UNCOLOURED = new Set(['', 'text', 'plaintext', 'txt', 'none', 'plain']);

/**
 * A broader RouterOS fingerprint than `auto_detect`, used only to judge whether
 * a still-uncoloured block *should* have been coloured. `[novlan]` prompts and
 * bare `print` output are RouterOS but are deliberately not auto-detected.
 */
const ROUTEROS_LOOK = new RegExp(
  '^\\s*(?:' +
    '\\[[A-Za-z0-9_.@-]+(?:@[^\\]]*)?\\]|' +
    ':(?:local|global|if|else|set|put|log|foreach|while|do|on-?error)\\b|' +
    '/(?:ip|interface|system|tool|routing|disk|queue|user|log|snmp|ppp|ipv6|mpls|caps-man|container|iot|file|radius|certificate|wireless|bridge|port)\\b|' +
    '(?:add|set|remove|print)\\s+[a-z-]+=' +
    ')',
);

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Every fence opener of a body, with its info string and first content line. */
export function fenceBlocks(body) {
  const lines = String(body).split('\n');
  const out = [];
  let marker = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (marker) {
      const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
      if (close && close[1][0] === marker[0] && close[1].length >= marker.length) {
        marker = null;
        if (out.length) out[out.length - 1].close = index;
      }
      continue;
    }
    const open = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (!open) continue;
    marker = open[2];
    out.push({
      index,
      info: open[3].trim(),
      firstLine: firstContentLine(lines.slice(index + 1).join('\n')),
      content: lines.slice(index + 1).join('\n'),
      close: -1,
    });
  }
  return out;
}

function addCounts(target, key, value = 1) {
  target[key] = (target[key] || 0) + value;
}

/** Coverage of one tree. `root` is relative to the repository. */
export function coverageForTree(config, root) {
  const stats = {
    tree: root,
    files: 0,
    fences: 0,
    uncoloured: 0,
    detected: 0,
    detectedRos: 0,
    unresolved: 0,
    rosRendered: 0,
    suspicious: 0,
    byLanguage: {},
  };
  for (const file of walkMarkdown(path.join(REPO, root))) {
    stats.files += 1;
    const body = fs.readFileSync(file, 'utf8');
    const docPath = canonicalDocPath(path.relative(REPO, file));
    for (const block of fenceBlocks(body)) {
      stats.fences += 1;
      const language = block.info.split(/\s+/)[0];
      const key = language.toLowerCase();
      addCounts(stats.byLanguage, key || '(bare)');
      const uncoloured = UNCOLOURED.has(key);
      if (uncoloured) stats.uncoloured += 1;
      const resolved = resolveFenceLanguage({
        config,
        info: block.info,
        firstLine: block.firstLine,
        content: block.content,
        docPath,
      });
      const resolvedLanguage = resolved.info.split(/\s+/)[0].toLowerCase();
      if (resolvedLanguage === 'ros') stats.rosRendered += 1;
      if (uncoloured) {
        if (resolved.kind === 'auto') {
          stats.detected += 1;
          if (resolvedLanguage === 'ros') stats.detectedRos += 1;
        } else {
          stats.unresolved += 1;
          // Judge the whole candidate list, the same lines the rules see, so a
          // captured heading can no longer hide an uncoloured RouterOS script.
          if (candidateContentLines(block.content ?? block.firstLine).some((line) => ROUTEROS_LOOK.test(line))) {
            stats.suspicious += 1;
          }
        }
      }
    }
  }
  return stats;
}

/** The trees the fence rules are meant to cover: English and the zh overlays. */
export function fenceTrees() {
  const trees = ['docs'];
  if (fs.existsSync(path.join(REPO, TREE_ROOT))) {
    for (const entry of fs.readdirSync(path.join(REPO, TREE_ROOT), {withFileTypes: true})) {
      if (entry.isDirectory() && entry.name.startsWith('version-')) {
        trees.push(`${TREE_ROOT}/${entry.name}`);
      }
    }
  }
  trees.sort();
  trees.push(
    ...trees.map((tree) =>
      tree === 'docs'
        ? 'i18n/zh-Hans/docusaurus-plugin-content-docs/current'
        : tree.replace(
            /^versioned_docs\/(version-[^/]+)/,
            'i18n/zh-Hans/docusaurus-plugin-content-docs/$1',
          ),
    ),
  );
  return trees;
}

function percent(part, whole) {
  return whole ? ` (${((part / whole) * 100).toFixed(1)}%)` : ' (0.0%)';
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const thresholdArg = args.find((value) => value.startsWith('--threshold='));
  const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 5;
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error('--threshold needs a non-negative number');
  }
  const config = loadFenceConfig(CONFIG_PATH);
  const rows = fenceTrees().map((tree) => coverageForTree(config, tree));
  for (const row of rows) {
    process.stdout.write(
      `${row.tree.padEnd(72)} fences=${String(row.fences).padStart(5)}` +
        ` uncoloured=${String(row.uncoloured).padStart(4)}` +
        ` detected=${String(row.detected).padStart(4)}${percent(row.detected, row.uncoloured)}` +
        ` ros=${String(row.rosRendered).padStart(5)}` +
        ` suspicious=${String(row.suspicious).padStart(3)}\n`,
    );
  }
  const total = rows.reduce(
    (sum, row) => ({
      fences: sum.fences + row.fences,
      uncoloured: sum.uncoloured + row.uncoloured,
      detected: sum.detected + row.detected,
      detectedRos: sum.detectedRos + row.detectedRos,
      rosRendered: sum.rosRendered + row.rosRendered,
      suspicious: sum.suspicious + row.suspicious,
    }),
    {fences: 0, uncoloured: 0, detected: 0, detectedRos: 0, rosRendered: 0, suspicious: 0},
  );
  process.stdout.write(
    `total: fences=${total.fences} uncoloured=${total.uncoloured}` +
      ` detected=${total.detected}${percent(total.detected, total.uncoloured)}` +
      ` detectedRos=${total.detectedRos} rosRendered=${total.rosRendered}` +
      ` suspicious=${total.suspicious}${percent(total.suspicious, total.fences)}\n`,
  );
  if (strict) {
    const ratio = total.fences ? (total.suspicious / total.fences) * 100 : 0;
    if (ratio > threshold) {
      process.stdout.write(
        `fence-coverage: ${ratio.toFixed(2)}% of fences look like RouterOS but would render uncoloured` +
          ` (threshold ${threshold}%)\n`,
      );
      process.exitCode = 1;
    } else {
      process.stdout.write(
        `fence-coverage: strict ok, ${ratio.toFixed(2)}% look RouterOS yet uncoloured` +
          ` (threshold ${threshold}%)\n`,
      );
    }
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry === fileURLToPath(import.meta.url)) main();
