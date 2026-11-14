#!/usr/bin/env node
/**
 * Put `yes` / `no` back where the translator turned them into 是 / 否.
 *
 * A configuration value is not prose: `| make-default | 0 | 否 |` tells the
 * reader to type something that does not exist in RouterOS. The legacy memory
 * translated a few hundred of these cells, so this pass compares every table
 * row with its English counterpart and restores the two tokens verbatim.
 *
 * The repaired row is written to the model memory as well, otherwise the next
 * `translate:apply` / `translate:derive` would rebuild the overlay from the old
 * translation and undo the fix.
 *
 *   node tools/translate/fix-enum-cells.mjs            # report only
 *   node tools/translate/fix-enum-cells.mjs --apply    # rewrite overlays + TM
 */

import fs from 'node:fs';
import path from 'node:path';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {fenceMask, normalize} from './lib/blocks.mjs';
import {loadModelMemory, saveModelMemory} from './lib/model-memory.mjs';

const APPLY = process.argv.includes('--apply');
const ENUMS = new Map([
  ['yes', '是'],
  ['no', '否'],
]);

function tablesOf(body) {
  const lines = body.split('\n');
  const mask = fenceMask(body);
  const out = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    if (!mask[i] && /^\s*\|/.test(lines[i])) {
      if (!current) {
        current = {start: i, lines: []};
        out.push(current);
      }
      current.lines.push(i);
    } else {
      current = null;
    }
  }
  return {lines, tables: out};
}

const cells = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim());

const model = loadModelMemory();
let repaired = 0;
const report = {};

for (const section of SECTIONS) {
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) continue;
  let sectionCount = 0;

  for (const file of walkMarkdown(overlayBase)) {
    const rel = relative(overlayBase, file);
    const sourceFile = path.join(sourceBase, rel);
    if (!fs.existsSync(sourceFile)) continue;
    const english = splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).body;
    const overlayText = fs.readFileSync(file, 'utf8');
    const overlayBody = splitFrontMatter(overlayText).body;

    const source = tablesOf(english);
    const overlay = tablesOf(overlayBody);
    if (source.tables.length !== overlay.tables.length) continue;

    const overlayLines = overlay.lines.slice();
    let changed = false;
    let fileCount = 0;
    for (let t = 0; t < source.tables.length; t++) {
      const src = source.tables[t];
      const ovl = overlay.tables[t];
      if (src.lines.length !== ovl.lines.length) continue;
      for (let r = 0; r < src.lines.length; r++) {
        const englishLine = source.lines[src.lines[r]];
        const overlayIndex = ovl.lines[r];
        const overlayLine = overlayLines[overlayIndex];
        const englishCells = cells(englishLine);
        const overlayCells = cells(overlayLine);
        if (englishCells.length !== overlayCells.length) continue;
        let rowChanged = false;
        for (let c = 0; c < englishCells.length; c++) {
          const englishCell = englishCells[c].toLowerCase();
          const chinese = ENUMS.get(englishCell);
          if (!chinese || overlayCells[c] !== chinese) continue;
          overlayCells[c] = englishCell;
          rowChanged = true;
        }
        if (!rowChanged) continue;
        const rebuilt = `| ${overlayCells.join(' | ')} |`;
        overlayLines[overlayIndex] = rebuilt;
        model.set(`${section.name}\u0000${normalize(englishLine)}`, rebuilt.trim());
        fileCount++;
        changed = true;
      }
    }
    if (changed) {
      sectionCount += fileCount;
      if (APPLY) {
        const prefix = overlayText.slice(0, overlayText.length - overlayBody.length);
        fs.writeFileSync(file, `${prefix}${overlayLines.join('\n')}`);
      }
    }
  }
  repaired += sectionCount;
  report[section.name] = sectionCount;
}

if (APPLY) saveModelMemory(model);
console.log(JSON.stringify({apply: APPLY, cells: repaired, sections: report}));
