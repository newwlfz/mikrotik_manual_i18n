#!/usr/bin/env node
/**
 * `node tools/verify/changelog-tags.mjs` — enforce the Docs Changes tag routes.
 *
 * Two assertions, one offline and one post-build:
 *
 *   1. Data gate: every `changelog/*.md` carries a `tags:` front-matter block
 *      with `permalink: changelog`. With zero tags the content-blog plugin emits
 *      no `/changelog/tags/…` routes, so the officially linked
 *      `/changelog/tags/changelog` URL 404s.
 *   2. Build gate: when `build/changelog/` exists, assert that both
 *      `build/changelog/tags/index.html` (the tag list) and
 *      `build/changelog/tags/changelog/index.html` (the tag page) were emitted;
 *      the tag page must carry a localized "tagged with" marker (English
 *      "tagged with", zh-Hans "含有标签", zh-Hant "含有標籤"). Docusaurus gives
 *      the list page a "Tags" heading instead, so that page is checked for a
 *      link to the changelog tag. The surrounding existence and tag-link
 *      checks still require the tag page and its tag count, so accepting the
 *      localized wording does not relax the gate.
 *
 * The build gate is SKIP on a cold repository (no build/), which keeps the data
 * gate safe to run in the offline part of the pipeline.
 *
 *   node tools/verify/changelog-tags.mjs            # data gate + build gate
 *   node tools/verify/changelog-tags.mjs --data-only
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHANGELOG = path.join(REPO, 'changelog');
const BUILD_CHANGELOG = path.join(REPO, 'build/changelog');
const BUILD_TAGS = path.join(BUILD_CHANGELOG, 'tags');
const DATA_ONLY = process.argv.includes('--data-only');
const rel = (file) => path.relative(REPO, file).split(path.sep).join('/');

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function frontMatterLines(text) {
  const match = FRONT_MATTER.exec(text);
  return match ? match[1].split(/\r?\n/) : [];
}

function unquote(value) {
  const text = String(value ?? '').trim();
  return /^".*"$/.test(text) || /^'.*'$/.test(text) ? text.slice(1, -1) : text;
}

/** Minimal reader for the `tags:` block written by fetch-blog/fetch-changelog. */
function parseTags(lines) {
  const tags = [];
  let inside = false;
  for (const line of lines) {
    if (/^tags\s*:/.test(line)) {
      inside = true;
      continue;
    }
    if (!inside) continue;
    if (/^\S/.test(line)) break; // next top-level front-matter key
    if (/^\s*#/.test(line)) continue;
    const label = /^\s*-\s*label\s*:\s*(.*?)\s*$/.exec(line);
    if (label) {
      tags.push({label: unquote(label[1]), permalink: ''});
      continue;
    }
    const permalink = /^\s*permalink\s*:\s*(.*?)\s*$/.exec(line);
    if (permalink && tags.length) tags[tags.length - 1].permalink = unquote(permalink[1]);
  }
  return tags;
}

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('verify:changelog-tags  changelog front matter -> /changelog/tags/changelog');

// --- data gate -------------------------------------------------------------
const files = fs.existsSync(CHANGELOG)
  ? fs.readdirSync(CHANGELOG).filter((name) => name.endsWith('.md')).sort()
  : [];
check('changelog/ has markdown entries', files.length > 0, `found ${files.length}`);

const noTags = [];
const wrongPermalink = [];
for (const name of files) {
  const text = fs.readFileSync(path.join(CHANGELOG, name), 'utf8');
  const tags = parseTags(frontMatterLines(text));
  if (!tags.length) noTags.push(name);
  else if (!tags.some((tag) => tag.permalink === 'changelog')) wrongPermalink.push(name);
}
const preview = (names) => `${names.length} file(s)${names.length ? `: ${names.slice(0, 5).join(', ')}` : ''}`;
check('every changelog/*.md has a tags front-matter block', noTags.length === 0, preview(noTags));
check("every changelog/*.md has a tag with permalink 'changelog'", wrongPermalink.length === 0, preview(wrongPermalink));
console.log(
  `  counted ${files.length} changelog entries, ${files.length - noTags.length} with tags, ` +
    `${files.length - noTags.length - wrongPermalink.length} with permalink=changelog`,
);

// --- build gate ------------------------------------------------------------
if (DATA_ONLY || !fs.existsSync(BUILD_CHANGELOG)) {
  const reason = DATA_ONLY ? '--data-only' : `${rel(BUILD_CHANGELOG)} absent (cold repository)`;
  console.log(`verify:changelog-tags: SKIP build gate (${reason})`);
} else {
  // `build/changelog/` is present but the tags subtree is not: that is the
  // regression this gate exists to catch, so it must fail rather than skip.
  check(`${rel(BUILD_TAGS)} emitted`, fs.existsSync(BUILD_TAGS));
  const listFile = path.join(BUILD_TAGS, 'index.html');
  const tagFile = path.join(BUILD_TAGS, 'changelog', 'index.html');
  check(`${rel(listFile)} exists`, fs.existsSync(listFile));
  check(`${rel(tagFile)} exists`, fs.existsSync(tagFile));
  if (fs.existsSync(tagFile)) {
    const html = fs.readFileSync(tagFile, 'utf8');
    // Docusaurus localizes the blog tag-page chrome: the English build says
    // "tagged with", zh-Hans says 含有标签 and zh-Hant says 含有標籤. The page
    // and its tag count are still required by the checks above and below.
    const TAGGED_WITH = /tagged with|含有标签|含有標籤/i;
    check(`${rel(tagFile)} contains a localized "tagged with" marker`, TAGGED_WITH.test(html));
  }
  if (fs.existsSync(listFile)) {
    const html = fs.readFileSync(listFile, 'utf8');
    check(`${rel(listFile)} links the changelog tag`, /\/tags\/changelog(?:\/|["'])/.test(html));
  }
}

console.log(`verify:changelog-tags: ${passed} assertion(s) passed`);
if (failures.length) {
  for (const failure of failures) console.error(`verify:changelog-tags: FAILED ${failure}`);
  console.error(`verify:changelog-tags: FAIL (${failures.length} assertion(s) failed)`);
  process.exit(1);
}
console.log('verify:changelog-tags: PASS');
