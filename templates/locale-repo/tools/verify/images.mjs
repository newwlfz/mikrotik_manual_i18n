#!/usr/bin/env node
/**
 * Component images must survive translation.
 *
 * The hardware pages carry their product pictures as MDX components
 * (`<Img src="/img/....webp" alt="" width={799} height={559} />`), not as
 * markdown images, so `tools/translate/lib/verify.mjs` never compared them: its
 * image check only reads `![alt](url)`. The 7.26 Chinese capture dropped every
 * component block, the `exactOnly` rebuild replaced the page with that capture,
 * and 73 hardware pages silently lost all of their pictures while the
 * structural verifier stayed green.
 *
 * This verifier compares the component-image count of every English hardware
 * page with its Chinese overlay. A page without an overlay is reported as
 * untranslated (no assertion), because there is nothing to compare.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, walkMarkdown, relative} from '../translate/lib/paths.mjs';

const SOURCE = path.join(REPO, 'hardware');
const OVERLAY = path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware/current');
const IMAGE = /<Img\b|<img\b/gi;

function componentImages(body) {
  return [...String(body).matchAll(IMAGE)].map((match) => match[0]);
}

const failures = [];
let pages = 0;
let untranslated = 0;
let images = 0;

for (const file of walkMarkdown(SOURCE)) {
  const rel = relative(SOURCE, file);
  const english = componentImages(fs.readFileSync(file, 'utf8'));
  const overlayFile = path.join(OVERLAY, rel);
  if (!fs.existsSync(overlayFile)) {
    untranslated++;
    continue;
  }
  pages++;
  images += english.length;
  const chinese = componentImages(fs.readFileSync(overlayFile, 'utf8'));
  if (english.length !== chinese.length) {
    failures.push(`${rel}: en=${english.length} zh=${chinese.length}`);
  }
}

console.log(
  `  ${failures.length ? 'FAIL' : 'ok  '} hardware component images: ` +
    JSON.stringify({pages, images, untranslated, mismatched: failures.length}),
);
if (failures.length) {
  for (const line of failures.slice(0, 10)) console.log(`FAIL ${line}`);
  if (failures.length > 10) console.log(`FAIL ... and ${failures.length - 10} more page(s)`);
  process.exitCode = 1;
}
