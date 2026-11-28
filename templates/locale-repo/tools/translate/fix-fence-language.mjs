#!/usr/bin/env node
/**
 * Keep the code-fence language of an overlay identical to its English source.
 *
 * A fenced block's info string (` ```ros `) is syntax, not prose, so the
 * translation pipeline has no reason to touch it - but any pass that rewrites a
 * body can drop it, and a dropped language means the Chinese page renders the
 * same RouterOS script as black text while the English page highlights it.
 *
 * This pass compares the fence openers of one overlay with the English page it
 * mirrors *in document order* and copies the English info string onto the
 * Chinese fence. It only runs when both sides have the same number of fences
 * (a different count means the page was restructured, and positional alignment
 * would move languages onto the wrong blocks); such pages are reported as
 * `skipped` instead. The marker, indentation and body are never touched, so the
 * pass is idempotent: a second run changes nothing.
 *
 * The render-side twin (`src/remark/fence-language.mjs`) adds a language to a
 * bare fence whose content matches `config/code-fence-languages.yml`; this pass
 * is what makes the markdown itself carry the language the English page has.
 *
 *   node tools/translate/fix-fence-language.mjs            # apply
 *   node tools/translate/fix-fence-language.mjs --check    # report only
 *   node tools/translate/fix-fence-language.mjs --section=docs-7.25
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';

/** A fence opener: indentation, marker run, and the info string after it. */
const OPENER = /^(\s*)(`{3,}|~{3,})(.*)$/;
/** A closing fence is a bare marker run (Markdown allows trailing whitespace). */
const CLOSER = /^\s*(?:`{3,}|~{3,})\s*$/;

/**
 * Every fence opener of a body, in order, with what is needed to rewrite it.
 *
 * `segmentSpans` is not used here: `OPENER` deliberately changes nothing but the
 * info string, and the pass must keep every other byte of the document.
 */
export function fenceOpeners(body) {
  const lines = String(body).split('\n');
  const openers = [];
  let marker = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (marker) {
      if (CLOSER.test(line) && line.trim().startsWith(marker[0])) marker = null;
      continue;
    }
    const match = OPENER.exec(line);
    if (!match) continue;
    marker = match[2];
    openers.push({index, indent: match[1], fence: match[2], info: match[3].trim()});
  }
  return openers;
}

/**
 * Copy the English info strings onto the Chinese fences, in order.
 *
 * Returns `{body, changed, fences}` where `fences` is the number of fences the
 * two sides share; `changed` counts the info strings that differ. When the
 * counts differ the body is returned unchanged and `skipped` is set.
 */
export function alignFenceLanguages(sourceBody, overlayBody) {
  const source = fenceOpeners(sourceBody);
  const overlay = fenceOpeners(overlayBody);
  if (!source.length || source.length !== overlay.length) {
    return {body: overlayBody, changed: 0, fences: overlay.length, skipped: source.length !== overlay.length};
  }
  const lines = String(overlayBody).split('\n');
  let changed = 0;
  for (const [position, opener] of overlay.entries()) {
    const wanted = source[position].info;
    if (opener.info === wanted) continue;
    // The English bytes win, including a space-or-not right after the marker.
    lines[opener.index] = `${opener.indent}${opener.fence}${wanted}`;
    changed++;
  }
  return {body: lines.join('\n'), changed, fences: overlay.length, skipped: false};
}

function option(name, fallback) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

export function main() {
  const CHECK = process.argv.includes('--check');
  const ONLY = option('section', '');
  const stats = {files: 0, changedFiles: 0, changedFences: 0, skipped: [], samples: []};

  for (const section of SECTIONS) {
    if (ONLY && section.name !== ONLY) continue;
    const overlayBase = path.join(REPO, section.overlay);
    if (!fs.existsSync(overlayBase)) continue;
    const sourceBase = path.join(REPO, section.source);
    for (const file of walkMarkdown(overlayBase)) {
      const rel = relative(overlayBase, file);
      const sourceFile = path.join(sourceBase, rel);
      if (!fs.existsSync(sourceFile)) continue;
      stats.files++;
      const source = splitFrontMatter(fs.readFileSync(sourceFile, 'utf8'));
      const overlay = splitFrontMatter(fs.readFileSync(file, 'utf8'));
      const aligned = alignFenceLanguages(source.body, overlay.body);
      if (aligned.skipped) {
        // A restructured page: report it instead of moving languages blindly.
        stats.skipped.push(`${section.name}/${rel}`);
        continue;
      }
      if (!aligned.changed) continue;
      stats.changedFiles++;
      stats.changedFences += aligned.changed;
      if (stats.samples.length < 5) stats.samples.push(`${section.name}/${rel} (${aligned.changed})`);
      if (CHECK) continue;
      const text = fs.readFileSync(file, 'utf8');
      const head = text.slice(0, text.length - overlay.body.length);
      fs.writeFileSync(file, `${head}${aligned.body}`);
    }
  }

  console.log(JSON.stringify({mode: CHECK ? 'check' : 'apply', ...stats}, null, 1));
  if (CHECK && stats.changedFiles) process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry === fileURLToPath(import.meta.url)) main();
