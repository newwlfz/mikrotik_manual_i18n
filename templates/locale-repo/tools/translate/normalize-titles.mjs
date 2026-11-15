#!/usr/bin/env node
/**
 * One canonical wording for the recurring "Newsletter <Month> <Year>" posts.
 *
 * Six posts carried six different renderings (新闻通讯 / 通讯 / 简报 / 新闻简报 …),
 * because each title was translated once, years apart, with no shared rule. This
 * pass rewrites them from the English title and stores the result in the title
 * memory, so `apply` reproduces it instead of asking the model again.
 *
 *   node tools/translate/normalize-titles.mjs            # report only
 *   node tools/translate/normalize-titles.mjs --apply    # rewrite overlays + TM
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter, readField} from './lib/frontmatter.mjs';
import {loadModelMemory, saveModelMemory} from './lib/model-memory.mjs';

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const PATTERN = /^newsletter\s+([a-z]+)\s+(\d{4})$/i;

/**
 * The Chinese title of a "Newsletter <Month> <Year>" post, or `null` when the
 * English title is not one of them. Exported because `verify/labels.mjs` uses
 * the exact same rule instead of a second copy of the month names.
 */
export function canonicalTitle(english) {
  const match = PATTERN.exec(String(english).trim());
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return `新闻简报 ${match[2]} 年 ${month} 月`;
}

export function main() {
  const APPLY = process.argv.includes('--apply');
  const model = loadModelMemory();
  let changed = 0;
  const report = {};

  for (const section of SECTIONS) {
    if (section.name !== 'blog') continue;
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    if (!fs.existsSync(overlayBase)) continue;
    let count = 0;
    for (const file of walkMarkdown(overlayBase)) {
      const rel = relative(overlayBase, file);
      const sourceFile = path.join(sourceBase, rel);
      if (!fs.existsSync(sourceFile)) continue;
      const english = readField(splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter, 'title');
      const wanted = english ? canonicalTitle(english) : null;
      if (!wanted) continue;
      const overlayText = fs.readFileSync(file, 'utf8');
      const overlay = splitFrontMatter(overlayText);
      const current = readField(overlay.frontMatter, 'title');
      model.set(`title:${english}`, wanted);
      if (current === wanted) continue;
      count++;
      if (APPLY) {
        const body = overlayText.slice(overlayText.length - overlay.body.length);
        const frontMatter = overlay.frontMatter.replace(/^title:\s*.*$/m, `title: ${JSON.stringify(wanted)}`);
        fs.writeFileSync(file, `${frontMatter}${body}`);
      }
    }
    report[section.name] = count;
    changed += count;
  }

  if (APPLY) saveModelMemory(model);
  console.log(JSON.stringify({apply: APPLY, titles: changed, sections: report}));
}

// Importing this module must not run the pass or print a second JSON line.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
