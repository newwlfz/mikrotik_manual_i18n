#!/usr/bin/env node
/**
 * Add the missing `captured_at` front-matter key to the zh-Hans doc overlays.
 *
 * Every English page carries `captured_at` (the time the upstream capture ran,
 * restored by `tools/sync/backfill-captured-at.mjs`), but the overlays were
 * written before that key existed, so all 1484 current pages shipped without
 * it and `src/theme/DocItem/Footer` printed no capture time on the Chinese
 * side. `translate apply` / `derive` now copy the key from the source
 * (`lib/frontmatter.mjs` -> `copyKeys`), but re-running either of them rebuilds
 * every body from the translation memory and would overwrite the reviewed
 * working tree; this script only inserts the one missing line.
 *
 * Rules:
 *   - the value is the English source's own raw text, quote style included,
 *     copied verbatim: the overlay never invents a timestamp;
 *   - a page that already has `captured_at` is left byte for byte;
 *   - a source without the key is counted as `noValueInSource` and skipped
 *     (ten 7.24/7.25 archive pages were captured before the key existed);
 *   - the line is inserted right after `source:` so the order matches English;
 *   - the body, the other keys and the file's line endings are untouched.
 *
 * Idempotent: a second run reports `added: 0` and writes nothing.
 *
 *   node tools/translate/backfill-captured-at.mjs            # write (default)
 *   node tools/translate/backfill-captured-at.mjs --check     # report only
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, SECTIONS, walkMarkdown, relative} from './lib/paths.mjs';
import {copyKeys} from './lib/frontmatter.mjs';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const CHECK = process.argv.includes('--check');

/** The three versioned docs overlays, not the hardware/blog/changelog plugins. */
const isDocsOverlay = (section) => /docusaurus-plugin-content-docs(?:\/|$)/.test(section.overlay);

/**
 * Insert the source's `captured_at` into one overlay document.
 * Returns the new text, or null when nothing has to change.
 */
function withCapturedAt(text, sourceFrontMatter) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return null;
  const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
  const frontMatter = match[1];
  if (/^captured_at\s*:/m.test(frontMatter)) return null;
  const joined = frontMatter.split(/\r?\n/).join('\n');
  const next = copyKeys(joined, sourceFrontMatter, ['captured_at']);
  // `copyKeys` cannot add anything when the source has no value: leave the page
  // alone rather than fabricating a timestamp.
  if (next === joined) return null;
  const rendered = eol === '\n' ? next : next.split('\n').join(eol);
  return `${text.slice(0, match.index)}---${eol}${rendered}${eol}---${text.slice(
    match.index + match[0].length,
  )}`;
}

const report = {sections: {}, totals: {files: 0, present: 0, added: 0, noValueInSource: 0, noFrontMatter: 0}};
const skipped = [];

for (const section of SECTIONS.filter(isDocsOverlay)) {
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  const stat = {files: 0, present: 0, added: 0, noValueInSource: 0, noFrontMatter: 0};

  for (const overlayPath of walkMarkdown(overlayBase)) {
    const rel = relative(overlayBase, overlayPath);
    const sourcePath = path.join(sourceBase, rel);
    stat.files++;
    if (!fs.existsSync(sourcePath)) {
      stat.noValueInSource++;
      skipped.push(`${section.name}/${rel}: no English source`);
      continue;
    }
    const text = fs.readFileSync(overlayPath, 'utf8');
    const frontMatter = FRONT_MATTER.exec(text)?.[1] || '';
    if (!frontMatter) {
      stat.noFrontMatter++;
      continue;
    }
    if (/^captured_at\s*:/m.test(frontMatter)) {
      stat.present++;
      continue;
    }
    const sourceFrontMatter = FRONT_MATTER.exec(fs.readFileSync(sourcePath, 'utf8'))?.[1] || '';
    const next = withCapturedAt(text, sourceFrontMatter);
    if (next === null) {
      stat.noValueInSource++;
      skipped.push(`${section.name}/${rel}: source has no captured_at`);
      continue;
    }
    if (!CHECK) fs.writeFileSync(overlayPath, next);
    stat.added++;
  }

  report.sections[section.name] = stat;
  for (const key of ['files', 'present', 'added', 'noValueInSource', 'noFrontMatter']) {
    report.totals[key] += stat[key];
  }
}

report.checkOnly = CHECK;
console.log(JSON.stringify(report, null, 1));
if (skipped.length) {
  console.log(`pages skipped (${skipped.length}):`);
  for (const entry of skipped.slice(0, 20)) console.log(`  ${entry}`);
  if (skipped.length > 20) console.log(`  ... ${skipped.length - 20} more`);
}
if (CHECK) console.log('dry run only; re-run without --check to update the overlays');
