#!/usr/bin/env node
/**
 * One wording for "newsletter" in prose, not only in titles.
 *
 * `normalize-titles.mjs` fixes the six "Newsletter <Month> <Year>" blog titles,
 * but their first sentence and the three `introduction` overlays still carried
 * three different renderings (时事通讯 / 新闻通讯 / 简报). The glossary already
 * maps `Newsletter -> 新闻简报` (config/glossary/zh-Hans.yml); this pass makes the
 * prose follow it, and nothing else.
 *
 * Scope is deliberate: only the Newsletter posts (an English title that
 * `canonicalTitle` recognises) and `docs/<version>/introduction.md`. "订阅" is
 * untouched, because the MQTT/eSIM pages use it in its own sense.
 *
 *   node tools/translate/normalize-newsletter.mjs            # report only
 *   node tools/translate/normalize-newsletter.mjs --apply    # rewrite overlays
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter, readField} from './lib/frontmatter.mjs';
import {canonicalTitle} from './normalize-titles.mjs';

/** Deprecated renderings and the one wording the glossary defines. */
export const NEWSLETTER_TERMS = [
  ['时事通讯', '新闻简报'],
  ['新闻通讯', '新闻简报'],
];

/** A bare "最新简报" reads as if it were the only issue; name the issue instead. */
const PHRASES = [
  [/最新简报/g, '最新一期新闻简报'],
  [/最新一期简报/g, '最新一期新闻简报'],
];

export function normalizeNewsletterText(text) {
  let next = String(text);
  for (const [from, to] of NEWSLETTER_TERMS) next = next.split(from).join(to);
  for (const [pattern, to] of PHRASES) next = next.replace(pattern, to);
  return next;
}

/** Which deprecated terms a body still contains (for the label verifier). */
export function deprecatedNewsletterTerms(text) {
  return NEWSLETTER_TERMS.map(([from]) => from).filter((from) => String(text).includes(from));
}

/** The overlay files this pass owns: Newsletter posts + docs/introduction.md. */
export function newsletterTargets() {
  const targets = [];
  for (const section of SECTIONS) {
    const overlayBase = path.join(REPO, section.overlay);
    if (!fs.existsSync(overlayBase)) continue;
    if (section.name === 'blog') {
      const sourceBase = path.join(REPO, section.source);
      for (const file of walkMarkdown(overlayBase)) {
        const rel = relative(overlayBase, file);
        const sourceFile = path.join(sourceBase, rel);
        if (!fs.existsSync(sourceFile)) continue;
        const english = readField(
          splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter,
          'title',
        );
        if (english && canonicalTitle(english)) targets.push({file, rel: `blog/${rel}`});
      }
      continue;
    }
    if (!/^docs/.test(section.name)) continue;
    const intro = path.join(overlayBase, 'introduction.md');
    if (fs.existsSync(intro)) targets.push({file: intro, rel: `${section.name}/introduction.md`});
  }
  return targets;
}

export function main() {
  const APPLY = process.argv.includes('--apply');
  const changed = [];
  let scanned = 0;

  for (const {file, rel} of newsletterTargets()) {
    scanned++;
    const text = fs.readFileSync(file, 'utf8');
    const {body} = splitFrontMatter(text);
    const nextBody = normalizeNewsletterText(body);
    if (nextBody === body) continue;
    changed.push(rel);
    if (!APPLY) continue;
    // Front matter (including the English `tags`) is copied byte for byte.
    const head = text.slice(0, text.length - body.length);
    fs.writeFileSync(file, `${head}${nextBody}`);
  }

  console.log(
    JSON.stringify({apply: APPLY, scanned, changed: changed.length, files: changed}),
  );
}

// Importing this module must not run the pass or print a second JSON line.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
