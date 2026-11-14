#!/usr/bin/env node
/**
 * Escape pipes and braces inside inline HTML that sits in Markdown tables.
 *
 * The official rendered page has cells like `<code>|</code>`; inside a GFM
 * table that pipe ends the cell, so MDX sees an unclosed tag. The same applies
 * to `{` and `}`, which start a JSX expression. Escape them only while inside
 * an HTML element, never the cell separators.
 */
import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';

const APPLY = process.argv.includes('--apply');
const DIRS = [
  'docs',
  'versioned_docs',
  'hardware',
  'blog',
  'changelog',
  'i18n/zh-Hans/docusaurus-plugin-content-docs',
  'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware',
  'i18n/zh-Hans/docusaurus-plugin-content-blog',
  'i18n/zh-Hans/docusaurus-plugin-content-blog-changelog',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function escapeLine(line) {
  if (!line.includes('<')) return line;
  let out = '';
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '<') {
      const end = line.indexOf('>', i);
      if (end === -1) {
        out += line.slice(i);
        break;
      }
      const tag = line.slice(i, end + 1);
      if (/^<\//.test(tag)) depth = Math.max(0, depth - 1);
      else if (!/\/>$/.test(tag) && !/^<(br|hr|img|input|meta|link|source)\b/i.test(tag)) depth++;
      out += tag;
      i = end;
      continue;
    }
    const needsEscape = depth > 0 ? char === '|' || char === '{' || char === '}' : char === '{' || char === '}';
    if (needsEscape) {
      out += `\\${char}`;
      continue;
    }
    out += char;
  }
  return out;
}

const stats = {files: 0, lines: 0};
for (const dir of DIRS) {
  for (const file of walk(path.join(REPO, dir))) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*\|/.test(lines[i])) continue;
      lines[i] = lines[i].replace(/<!--[\s\S]*?-->/g, '');
      const next = escapeLine(lines[i]);
      if (next !== lines[i]) {
        lines[i] = next;
        changed = true;
        stats.lines++;
      }
    }
    if (changed) {
      stats.files++;
      if (APPLY) fs.writeFileSync(file, lines.join('\n'));
    }
  }
}
console.log(JSON.stringify({...stats, apply: APPLY}));
