#!/usr/bin/env node
/**
 * Offline regression tests for the translation rules that can be enforced in
 * code. They run before a build in CI, so a change to the pipeline that breaks
 * one of the ledger rules fails fast instead of shipping a bad overlay.
 *
 *   node tools/translate/selftest.mjs
 */

import {
  normalize,
  isTranslatableProse,
  retargetLinks,
  fenceMask,
  alignBlocks,
  sameBlockShape,
  splitBlockSpans,
  isCodeBlock,
  codeParagraphs,
  englishSegments,
} from './lib/blocks.mjs';
import {renderAdmonition, splitAdmonitions} from './lib/admonitions.mjs';
import {loadFenceConfig, resolveFenceLanguage} from '../../src/lib/fence-rules.mjs';
import {pairBlocks} from './lib/legacy.mjs';
import {alignImages, imageAlignment, rebaseImages, rebuildFromPairs} from './lib/apply.mjs';
import {cjkCount, cjkRegression} from './lib/cjk.mjs';
import {containLinkText} from './lib/links.mjs';
import {applyReplacements} from './lib/patches.mjs';
import {
  classifyComment,
  commentKey,
  commentLines,
  isLikelyTableHeader,
  rewriteCommentLine,
  translateCodeComments,
} from './lib/code-comments.mjs';
import {compareFence, untranslatedBlocks} from './lib/verify.mjs';
import {spawn, spawnSync} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadModelMemory,
  readModelMemory,
  saveModelMemory,
  shardFiles,
} from './lib/model-memory.mjs';
import {Client, loadPromptConfig} from './lib/provider.mjs';
import {profileFor} from './lib/locale-profile.mjs';
import {checkScript, feedbackFor} from './lib/script-check.mjs';
import {commentRules, descriptionPrompt, titlePrompt} from './lib/prompts.mjs';
import {guardScript} from './lib/script-guard.mjs';
import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  localeHasResources,
  overlayRootFor,
  sectionsFor,
  translatableLocales,
} from './lib/paths.mjs';
import {
  buildGlobalTm,
  blockKey,
  commentTmKey,
  lookupBlock,
  lookupComment,
  lookupTitle,
  titleKey,
} from './lib/tm.mjs';
import {
  decodeBlockHashes,
  refreshChanged,
  refreshEnabled,
} from './lib/refresh.mjs';
import {sha256Hex} from './lib/digest.mjs';

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`);
  if (!ok) {
    failed++;
    process.stdout.write(`  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}\n`);
  }
}

// link-canonical-match: four spellings of one route compare equal
const linkForms = [
  'See [DNS](/docs/7.25/network-management/dns.md).',
  'See [DNS](/docs/7.25/network-management/dns/).',
  'See [DNS](/docs/network-management/dns).',
  'See [DNS](/docs/network-management/dns/index).',
];
check('link-canonical-match', new Set(linkForms.map(normalize)).size, 1);

// link-canonical-match also covers the raw HTML anchors that restored table
// cells carry; a version prefix inside href is link spelling, not content.
check(
  'html-link-canonical',
  normalize('<a href="/docs/7.24/wireless/x">y</a>') ===
    normalize('<a href="/docs/wireless/x">y</a>'),
  true,
);

// image paths never affect the comparison
check(
  'image-path-ignored',
  normalize('![a](./img/x.webp)') === normalize('![a](../img/other.webp)'),
  true,
);

// admonition-untouched and cli-heading-english
check('admonition-skipped', isTranslatableProse(':::info'), false);
check('cli-heading-skipped', isTranslatableProse('## ip/media'), false);
check('heading-prose-kept', isTranslatableProse('## Configuration example'), true);
check('sentence-kept', isTranslatableProse('This page explains how the firewall works.'), true);
// An image wrapped in a link and emphasis is not prose (it would be sent to the
// model, come back unchanged, and keep the page pending forever).
check(
  'linked-image-skipped',
  isTranslatableProse('**[![](./img/chr_video.png)](https://www.youtube.com/watch?v=x)**'),
  false,
);
check('linked-image-prose-kept', isTranslatableProse('See [the video](https://example.com) for details'), true);

check('console-path-skipped', isTranslatableProse('/interface/bridge/add name=bridge1'), false);

// code-fence-language: `text` / `plaintext` mean "no colour", not a language,
// so they must still be classified from the first content line. Without this,
// 443 RouterOS blocks rendered black in both languages.
const fenceConfig = loadFenceConfig();
const fenceInfo = (info, firstLine, docPath = 'wireless/user-guides/x.md') =>
  resolveFenceLanguage({config: fenceConfig, info, firstLine, docPath}).info;
check('fence-text-is-unlabelled', fenceInfo('text', '/interface/bridge/port/print'), 'ros');
check('fence-plaintext-prompt', fenceInfo('plaintext', '[admin@MikroTik] > /ip/address/print'), 'ros');
check('fence-bare-prompt', fenceInfo('', '[admin@R1] > /system/reboot'), 'ros');
check('fence-script-keyword', fenceInfo('', ':local address 10.0.0.1'), 'ros');
check('fence-add-command', fenceInfo('text', 'add chain=forward action=accept'), 'ros');
// No rule: `plaintext` is the fallback, a bare fence stays bare, and a Unix
// path or HTTP request is not RouterOS.
check('fence-plaintext-fallback', fenceInfo('plaintext', 'POST https://192.168.88.1/rest/password'), 'plaintext');
check('fence-bare-unchanged', fenceInfo('', 'GET https://example.com'), '');
check('fence-unix-path-not-ros', fenceInfo('', '/etc/nginx/nginx.conf'), '');
check('fence-explicit-language-kept', fenceInfo('bash', '/ip/address/print'), 'bash');

// fenced-admonition: a warning that shows a command is prose, not code.
//
// `hasFence(block)` used to mean "this block is code", so every `:::note` that
// carried a command sample was skipped by the splitter, the model queue and
// `verify` — 32 warnings stayed English while all counters read zero.
const fencedAdmonition = [
  ':::note Alternative approach',
  'Use `tls-host` instead of the DNS cache:',
  '',
  '```ros',
  '/ip firewall filter add tls-host=*.youtube.com action=drop',
  '```',
  '',
  'This avoids the cache.',
  ':::',
].join('\n');
check('fenced-admonition-not-code', isCodeBlock(fencedAdmonition), false);
check('fenced-admonition-is-translatable', isTranslatableProse(fencedAdmonition), true);
// The containing body decides: the admonition span is not code, the fence-only
// span before it is.
check(
  'fenced-admonition-span-not-code',
  splitBlockSpans(`\`\`\`ros\n/ip address\n\`\`\`\n\n${fencedAdmonition}`).map((span) => span.code),
  [true, false],
);
// A block whose first content line is a fence is still code, including the
// list-prefixed form the manual uses ("9. ```ros").
check('fence-first-line-is-code', isCodeBlock('```ros\n/ip address\n```'), true);
check('fence-list-prefixed-is-code', isCodeBlock('9. ```ros\n/ip address\n```'), true);

// The rebuild keeps the container and the sample byte for byte: only the title
// and the prose paragraphs are replaced.
const admonitionParts = splitAdmonitions(fencedAdmonition);
const rebuiltAdmonition = renderAdmonition(admonitionParts, (unit) =>
  unit === 'Alternative approach'
    ? '替代方案'
    : unit === 'This avoids the cache.'
      ? '这样就不依赖缓存。'
      : null,
);
check('admonition-rebuild-title', rebuiltAdmonition.startsWith(':::note 替代方案\n'), true);
check('admonition-rebuild-container', (rebuiltAdmonition.match(/^:::/gm) || []).length, 2);
check('admonition-rebuild-fences', (rebuiltAdmonition.match(/^```/gm) || []).length, 2);
check(
  'admonition-rebuild-code-verbatim',
  rebuiltAdmonition.includes('```ros\n/ip firewall filter add tls-host=*.youtube.com action=drop\n```'),
  true,
);
check('admonition-rebuild-prose', rebuiltAdmonition.includes('这样就不依赖缓存。'), true);
// The command paragraph is code, not a translation unit.
check('admonition-code-paragraph', codeParagraphs(admonitionParts.body).size, 1);

// `verify` now counts the warning instead of skipping it as code, and does not
// count the byte-identical command sample inside it as untranslated prose.
check(
  'verify-counts-fenced-admonition',
  untranslatedBlocks(fencedAdmonition, fencedAdmonition).fenced,
  {total: 1, untranslated: 1},
);
check(
  'verify-code-block-not-admonition',
  untranslatedBlocks('```ros\n/ip address\n```', '```ros\n/ip address\n```').fenced,
  {total: 0, untranslated: 0},
);
// The review list (`englishSegments`) must use the same verdict: a fenced
// warning is one pending unit, a whole code block is none.
check('english-segments-counts-fenced-admonition', englishSegments(fencedAdmonition).length, 1);
check('english-segments-skips-code', englishSegments('```ros\n/ip address\n```').length, 0);

// link-text-containment: only the run the page title names is translated, so a
// prose label keeps the author's surrounding words; a technical title (no CJK)
// or a label that is exactly the title is not touched here.
check(
  'link-text-partial',
  containLinkText('Working with Static DNS rules', 'Static DNS', '静态 DNS'),
  'Working with 静态 DNS rules',
);
check(
  'link-text-partial-needed-cjk',
  containLinkText('Centralized management with WiFi CAPsMAN', 'WiFi CAPsMAN', 'WiFi CAPsMAN'),
  null,
);
check('link-text-partial-not-whole', containLinkText('Back To Home', 'Back To Home', 'Back To Home（远程回家）'), null);
check(
  'link-text-partial-keeps-prose',
  containLinkText('See the Static DNS page for details', 'Static DNS', '静态 DNS'),
  'See the 静态 DNS page for details',
);

// link-retarget: the reused Chinese block points at the current English target
const retargeted = retargetLinks(
  '参见 [DNS](/docs/7.25/old/dns.md)。',
  'See [DNS](/docs/network-management/dns).',
);
check('link-retarget', retargeted, '参见 [DNS](/docs/network-management/dns)。');

// image-rebase: a relative image climbs back to the English source directory
check(
  'image-rebase',
  rebaseImages('docs/a/b', 'i18n/zh-Hans/x/current/a/b/c.md', '![](./img/p.png)'),
  '![](../../../../../../docs/a/b/img/p.png)',
);
check(
  'image-align-drops-stale',
  alignImages('no images', '![](./img/gone.webp)'),
  '',
);

// image-align-adds-missing: the source grew a third picture; the overlay keeps
// its translated prose and gets the new reference after the one it followed.
const imageAddSource =
  'Intro\n\n![one](/img/a.webp)\n\nMiddle\n\n![two](/img/b.webp)\n\nTail\n\n![three](/img/c.webp)';
const imageAddOverlay = '介绍\n\n![one](/img/a.webp)\n\n中间\n\n![two](/img/b.webp)';
const imageAdd = imageAlignment(imageAddSource, imageAddOverlay);
check('image-align-adds-missing-count', (imageAdd.body.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length, 3);
check('image-align-adds-missing-url', imageAdd.body.includes('![three](/img/c.webp)'), true);
check('image-align-adds-missing-keeps-prose', /介绍[\s\S]*中间/.test(imageAdd.body), true);
check('image-align-adds-missing-added', imageAdd.added, 1);

// image-align-removes-extra: an image the source dropped disappears, the text
// around it stays untouched.
const imageDrop = imageAlignment(
  'Intro\n\n![one](/img/a.webp)\n\nTail',
  '介绍\n\n![one](/img/a.webp)\n\n中间\n\n![old](/img/old.webp)\n\n尾巴',
);
check('image-align-removes-extra-count', (imageDrop.body.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length, 1);
check('image-align-removes-extra-url', imageDrop.body.includes('/img/old.webp'), false);
check('image-align-removes-extra-keeps-prose', /介绍[\s\S]*中间[\s\S]*尾巴/.test(imageDrop.body), true);

// image-align-html-source: an `<img src>` the overlay renders as Markdown is
// kept and reported, because deleting it would remove the picture.
const imageHtml = imageAlignment(
  '<img alt="x" src="/img/x.webp"/>',
  '![x](/img/x.webp)',
);
check('image-align-html-kept', imageHtml.body.includes('/img/x.webp'), true);
check('image-align-html-warning', imageHtml.warnings[0]?.reason, 'html-image-in-source');

// image-align-fence: image syntax inside a fence is example text, not a page
// image, and must stay byte-identical.
const imageFence = imageAlignment(
  '![one](/img/a.webp)\n\n```\n![example](/img/example.webp)\n```',
  '![one](/img/a.webp)\n\n```\n![example](/img/example.webp)\n```',
);
check('image-align-fence-untouched', imageFence.body.includes('![example](/img/example.webp)'), true);

// structure-preserved: horizontal rules come from English, code stays English
const english = 'Intro\n\n-----------\n\n```ros\n/ip/route\n```\n\nOutro';
const chinese = '介绍\n\n```ros\n/ip/route\n```\n\n结尾';
const rebuilt = rebuildFromPairs(english, chinese);
check('rule-restored', rebuilt.body.split('\n').filter((line) => line === '-----------').length, 1);
check('code-from-source', rebuilt.body.includes('/ip/route'), true);
check('prose-from-translation', rebuilt.body.includes('介绍') && rebuilt.body.includes('结尾'), true);

// fence detection handles a fence opened inside a list item
const listFence = '9. ```ros\n/admin\n```\n\nAfter';
check('list-fence-mask', fenceMask(listFence).filter(Boolean).length, 3);

// block alignment pairs prose with prose and leaves code alone
const enBlocks = ['# Title', 'One paragraph.', '```\ncode\n```', 'Last paragraph.'];
const zhBlocks = ['# 标题', '一段文字。', '最后一段。'];
check('align-pairs', alignBlocks(enBlocks, zhBlocks).size >= 2, true);
check('shape-check', sameBlockShape(['A'], ['B']), true);
check('shape-check-mismatch', sameBlockShape(['# A'], ['B']), false);

// patch layer: replacements are deterministic
check(
  'patch-replace',
  applyReplacements('旧译法在这里', {replace: [{from: '旧译法', to: '新译法'}]}),
  '新译法在这里',
);

// pairing keeps a page whose only drift is a dropped rule
const pair = pairBlocks('A\n\n-----------\n\nB', '甲\n\n乙');
check('pair-dropped-rule', pair.pairs.length, 2);

// cjk-not-reduced: the counting rule behind the apply guard. Han characters of
// every plane count, Chinese and fullwidth punctuation counts, and fullwidth
// Latin letters/digits do not (they are ASCII text set wide, not Chinese).
check('cjk-body-count', cjkCount('中文，测试。'), 6);
check('cjk-extension-a-counted', cjkCount('㐀'), 1);
check('cjk-astral-counted', cjkCount('𠀀'), 1);
check('cjk-fullwidth-letters-not-counted', cjkCount('ＡＢＣ１２３（）'), 2);
check('cjk-ascii-zero', cjkCount('Hello, world.'), 0);
check('cjk-empty-zero', cjkCount(''), 0);
check('cjk-missing-zero', cjkCount(null), 0);
// A rebuild that keeps the same Chinese, gains some, or trims a little is not a
// regression: `cjk-not-reduced` tolerates a 5% shrink so a wording update is
// not frozen. Beyond that — a paragraph replaced by English, a table dropped —
// is a regression. An empty old body (new page, English page) never is.
check('cjk-equal-is-not-loss', cjkRegression('中文正文', '中文正文'), null);
check('cjk-growth-is-not-loss', cjkRegression('中文', '中文正文'), null);
check('cjk-punctuation-gain-is-not-loss', cjkRegression('说明', '说明，'), null);
check('cjk-four-percent-allowed', cjkRegression('中'.repeat(50), '中'.repeat(48)), null);
check('cjk-five-percent-boundary-allowed', cjkRegression('中'.repeat(20), '中'.repeat(19)), null);
check('cjk-six-percent-blocked', cjkRegression('中'.repeat(100), '中'.repeat(94)), {old: 100, new: 94});
check('cjk-one-char-in-40-allowed', cjkRegression('中'.repeat(40), '中'.repeat(39)), null);
check('cjk-short-page-loss-blocked', cjkRegression('已禁用', '禁用'), {old: 3, new: 2});
check('cjk-empty-overlay-untouched', cjkRegression('', 'English rewrite'), null);
check('cjk-english-page-untouched', cjkRegression('Hello there', 'Hello world'), null);


// ---------------------------------------------------------------------------
// code-verbatim-except-comments
// ---------------------------------------------------------------------------

const fence = (language, ...lines) =>
  [`\`\`\`${language}`, ...lines, '\`\`\`'].join('\n');

// A translated comment changes only its own text; the code lines are identical.
const commentBody = fence(
  'ros',
  '/interface/bridge',
  '# Create a new bridge interface',
  'add name=bridge1',
);
const commentMemory = new Map([
  [commentKey('ros', 'Create a new bridge interface'), '创建新的网桥接口'],
]);
const commentRun = translateCodeComments(commentBody, (key) => commentMemory.get(key) ?? null);
check('comment-translated', commentRun.body.includes('# 创建新的网桥接口'), true);
check(
  'code-verbatim-under-comment',
  commentRun.body.includes('/interface/bridge') &&
    commentRun.body.includes('add name=bridge1'),
  true,
);
check('comment-hit-count', commentRun.hits, 1);

// A `#` inside a string or after code is not a line-leading comment.
const stringBody = fence(
  'ros',
  ':local note "# not a comment"',
  'add name=bridge1 ; # trailing comment',
);
const stringRun = translateCodeComments(stringBody, () => '不应该出现');
check('hash-in-string-untouched', stringRun.body, stringBody);
check('trailing-comment-untouched', stringRun.hits, 0);

// Fences in other languages are never touched.
const jsonBody = fence('json', '{', '  "#key": "# value"', '}');
check('json-fence-untouched', translateCodeComments(jsonBody, () => '中文').body, jsonBody);
const yamlBody = fence('yaml', '# not a shell comment', 'key: value');
check('yaml-fence-untouched', translateCodeComments(yamlBody, () => '中文').body, yamlBody);

// RouterOS print headers and output must stay English even in a `ros` fence.
const tableBody = fence(
  'ros',
  '/interface/print',
  '#   NAME    TYPE    MTU',
  '0   ether1  ether   1500',
);
check('table-header-detected', isLikelyTableHeader('NAME    TYPE    MTU'), true);
check('table-header-untouched', translateCodeComments(tableBody, () => '中文').body, tableBody);

// Indentation and the `# ` spelling survive the rewrite.
check(
  'comment-indent-preserved',
  rewriteCommentLine('    # Old text', '新文本'),
  '    # 新文本',
);
check('comment-no-space-preserved', rewriteCommentLine('#'+'old', '新文本'), '#'+'新文本');

// A `##` comment keeps its double hash.
check(
  'double-hash-preserved',
  rewriteCommentLine('## Input MAC address', '输入 MAC 地址'),
  '## 输入 MAC 地址',
);
check('banner-skipped', classifyComment(' Adjustable values #########', '', 7).kind, 'decoration');

// A changed English comment has a different memory key, so the old Chinese is
// not reused.
const changedBody = fence('ros', '# Create a new bridge port interface');
const changedRun = translateCodeComments(changedBody, (key) => commentMemory.get(key) ?? null);
check('changed-comment-invalidates', changedRun.body, changedBody);
check('changed-comment-miss', changedRun.misses.length, 1);

// A key block, a certificate or a `cat` dump is file content, not comments.
const keyBody = fence(
  'ros',
  '<tls-auth>',
  '#',
  '# 2048 bit OpenVPN static key',
  '#',
  '-----BEGIN OpenVPN Static key V1-----',
);
check('opaque-block-untouched', translateCodeComments(keyBody, () => '中文').body, keyBody);
const dumpBody = fence(
  'ros',
  'user@host:~$ cat /etc/resolv.conf',
  '# Generated by resolvconf',
  'nameserver 2001:db8::2',
);
check('file-dump-untouched', translateCodeComments(dumpBody, () => '中文').body, dumpBody);

// Verification: a translated comment is not a fence diff, a changed code line is.
const sourceFence = fence('ros', '/ip route', '# Add route', 'add dst-address=10.0.0.0/8');
const translatedFence = fence('ros', '/ip route', '# 添加路由', 'add dst-address=10.0.0.0/8');
const accepted = compareFence(sourceFence, translatedFence);
check('verify-accepts-comment', accepted.code.length, 0);
check('verify-comment-not-code', accepted.commentDiff.length, 0);
const brokenFence = fence('ros', '/ip route', '# 添加路由', 'add dst-address=10.0.0.1/8');
check('verify-rejects-code', compareFence(sourceFence, brokenFence).code.length, 1);
const englishLeft = fence('ros', '/ip route', '# Add route', 'add dst-address=10.0.0.0/8');
check('verify-counts-untranslated', compareFence(sourceFence, englishLeft).untranslated.length, 1);

// commentLines reports language and indentation for the pipeline.
const lines = commentLines(fence('routeros', '  # For ARM64', '/system'));
check('comment-language-normalised', lines[0].language, 'ros');
check('comment-indent-reported', lines[0].indent, '  ');


// ---------------------------------------------------------------------------
// glue-and-labels (regressions found in review)
// ---------------------------------------------------------------------------

// A paragraph the capture glued directly above a fence, and a fence that
// contains a blank line: both must yield separate prose and code blocks.
// Before this, the prose was never queued (its "block" held a fence) and the
// fence was split into two half-block fragments.
const gluedDocument = [
  'Example `connection-tracking-mode` configuration:',
  '```',
  'R1',
  '/interface/vrrp',
  '',
  'R2',
  '/interface/vrrp',
  '```',
  '',
  'VRRP instances run on LAN and WAN networks.',
  '```',
  '/interface/vrrp',
  '```',
].join('\n');
const gluedSpans = splitBlockSpans(gluedDocument);
check(
  'glued-fence-shape',
  gluedSpans.map((span) => span.code),
  [false, true, false, true],
);
check(
  'glued-fence-prose-first',
  gluedSpans[0].text,
  'Example `connection-tracking-mode` configuration:',
);
check(
  'fence-blank-line-kept-together',
  gluedSpans[1].text.split('\n').length,
  7,
);
check('glued-prose-is-translatable', isTranslatableProse(gluedSpans[0].text), true);
check(
  'glued-prose-queued',
  englishSegments(gluedDocument).length,
  2,
);
// `verify` counts both paragraphs of an all-English page instead of skipping
// them because they sit next to a fence.
const gluedVerify = untranslatedBlocks(gluedDocument, gluedDocument);
check('glued-prose-counted', gluedVerify.prose.length, 2);
check('glued-fences-are-code', gluedVerify.fenced.total, 0);

// A link label is translated by `rewriteLinks` independently of the sentence.
// An English paragraph whose only Chinese is the label must stay a translation
// unit, and `verify` must count it: the ramdisk warning stayed English in all
// three trees because `[存储]` made it look translated.
const labelOnlyEnglish =
  'Ramdisks need the `rose-storage` package (see [存储](./index.md)). ' +
  'To install the package when it is available on the router, enable it and ' +
  'apply the change. Applying the change reboots the router:';
check('localised-label-not-chinese', isTranslatableProse(labelOnlyEnglish), true);
const labelAdmonition = [
  ':::info',
  labelOnlyEnglish,
  '',
  '```ros',
  '/system/package/enable rose-storage',
  '```',
  '',
  'For more about packages, see [软件包](../getting-started/packages.md).',
  ':::',
].join('\n');
check('localised-label-admonition-translatable', isTranslatableProse(labelAdmonition), true);
const translatedLabelsOnly = [
  ':::info',
  labelOnlyEnglish,
  '',
  '```ros',
  '/system/package/enable rose-storage',
  '```',
  '',
  'For more about packages, see [软件包](../getting-started/packages.md).',
  ':::',
].join('\n');
const labelVerify = untranslatedBlocks(translatedLabelsOnly, translatedLabelsOnly);
check('localised-label-warning-counted', labelVerify.fenced, {total: 1, untranslated: 1});
check('localised-label-warning-units', labelVerify.admonitions.length, 1);

// A capture can swallow a Markdown heading into the fence. The heading is not
// code, so the rules look past it; a shell script behind a heading stays plain.
const headingScript = [
  '#### Script for decoding',
  'Add a new script under the "**System>Scripts**" tab.',
  '',
  '# POSIX regex for filtering advertisement Bluetooth addresses.',
  ':local addressRegex "2C:C8:1B:4B:BB:0A"',
].join('\n');
check(
  'fence-heading-then-script',
  resolveFenceLanguage({
    config: fenceConfig,
    info: '',
    firstLine: '#### Script for decoding',
    content: headingScript,
    docPath: 'internet-of-things/bluetooth/x.md',
  }).info,
  'ros',
);
check(
  'fence-heading-then-shell-still-bare',
  resolveFenceLanguage({
    config: fenceConfig,
    info: '',
    firstLine: '#### Install',
    content: '#### Install\nsh ./install.sh --prefix=/opt\nls -l /opt',
    docPath: 'internet-of-things/bluetooth/x.md',
  }).info,
  '',
);
check(
  'fence-first-line-still-wins',
  resolveFenceLanguage({
    config: fenceConfig,
    info: '',
    firstLine: '/ip/address/print',
    content: '/ip/address/print\n\n# note',
    docPath: 'x/y.md',
  }).info,
  'ros',
);

// ---------------------------------------------------------------------------
// tm-single-source (global translation memory)
// ---------------------------------------------------------------------------

const tmBuilt = buildGlobalTm({
  legacy: {
    'v7.24': {'Alpha block': '甲（7.24）', 'Beta block': '乙'},
    'v7.25': {'Alpha block': '甲（7.25）', 'Beta block': '乙', 'Gamma block': '丙（7.25）'},
  },
  model: {
    'docs\u0000Alpha block': '甲（模型）',
    'hardware\u0000Gamma block': '丙（模型）',
    'title:Some Title': '某标题',
  },
  comment: {entries: {'ros\u0000Alpha block': '注释甲'}},
});

check('tm-model-wins', lookupBlock(tmBuilt, 'Alpha block'), '甲（模型）');
check('tm-shared-key-kept-once', lookupBlock(tmBuilt, 'Beta block'), '乙');
check('tm-cross-section', lookupBlock(tmBuilt, 'Gamma block'), '丙（模型）');
check('tm-title', lookupTitle(tmBuilt, 'Some Title'), '某标题');
check('tm-comment-separate-from-block', lookupComment(tmBuilt, 'ros', 'Alpha block'), '注释甲');
check('tm-block-unaffected-by-comment', lookupBlock(tmBuilt, 'Alpha block'), '甲（模型）');
check('tm-conflicts-recorded', tmBuilt.conflicts.length, 3);
check(
  'tm-conflict-keeps-new',
  tmBuilt.conflicts.every((item) => item.kept === item.kept && item.dropped !== item.kept),
  true,
);
check('tm-normalised-key', blockKey('A  b') === blockKey('A b'), true);

// ---------------------------------------------------------------------------
// locale-aware derive / verify
// ---------------------------------------------------------------------------

// Every section path is derived from the locale, so a second language never
// reads or writes the zh-Hans overlay tree.
check(
  'locale-overlay-root-docs',
  sectionsFor('ru-RU').find((section) => section.name === 'docs').overlay,
  'i18n/ru-RU/docusaurus-plugin-content-docs/current',
);
check(
  'locale-overlay-root-hardware',
  overlayRootFor('ru-RU', 'hardware'),
  'i18n/ru-RU/docusaurus-plugin-content-docs-hardware/current',
);

const runNode = (script, args) =>
  spawnSync(process.execPath, [script, ...args], {cwd: REPO, encoding: 'utf8'});

// `ru-RU` has no glossary, patch directory, TM file or overlay tree. That is a
// probe, not 1,484 missing pages: verify reports zero files and exits 0.
check('ru-has-no-resources', localeHasResources('ru-RU'), false);
const verifyRu = runNode('tools/translate/index.mjs', ['verify', '--locale=ru-RU', '--no-compile']);
check('verify-ru-no-resources-exit', verifyRu.status, 0);
check('verify-ru-no-resources-zero-files', /0 files under i18n\/ru-RU\//.test(verifyRu.stdout), true);
check('verify-ru-no-resources-zero-overlays', /docs: \{"sources":0,"overlays":0,/.test(verifyRu.stdout), true);

// `--all-locales` visits only configured targets that have resources; a locale
// that is only a name so far is not reported as a failing tree.
const resourceLocales = translatableLocales().filter((locale) => localeHasResources(locale));
const verifyAll = runNode('tools/translate/index.mjs', ['verify', '--all-locales', '--no-compile']);
// The hub checkout has no overlay tree at all; there, "every page is missing"
// is the correct result, and checking it for exit 0 would assert the wrong
// thing. A language checkout has at least one tree and must pass.
const overlayTrees = resourceLocales.filter((locale) =>
  fs.existsSync(path.join(REPO, 'i18n', locale)),
);
check('verify-all-locales-exit', verifyAll.status, overlayTrees.length ? 0 : 1);
check(
  'verify-all-locales-visits-resource-locales',
  [...verifyAll.stdout.matchAll(/^=== locale (\S+)$/gm)].map((match) => match[1]),
  resourceLocales,
);
check('verify-all-locales-skips-ru', /=== locale ru-RU/.test(verifyAll.stdout), false);
check('verify-all-locales-summary', /all-locales: checked \d+ \(/.test(verifyAll.stdout), true);

// The source locale is never a target, for verify and for the derive chain.
const verifyEn = runNode('tools/translate/index.mjs', ['verify', '--locale=en', '--no-compile']);
check('verify-en-is-rejected', verifyEn.status, 1);
check('verify-en-source-locale-message', /is the source locale/.test(verifyEn.stderr), true);
const deriveEn = runNode('tools/translate/derive-all.mjs', ['--dry-run', '--locale=en']);
check('derive-en-is-rejected', deriveEn.status, 1);
check('derive-en-source-locale-message', /is the source locale/.test(deriveEn.stderr), true);

// ---------------------------------------------------------------------------
// locale profiles and the prompt actually sent to the provider
// ---------------------------------------------------------------------------

// Every locale profile must declare the writing system and at least one
// preferred term; without those the prompt has nothing locale-specific to say.
for (const locale of ['zh-Hans', 'zh-Hant', 'en']) {
  const profile = profileFor(locale);
  check(`profile-${locale}-exists`, profile.exists, true);
  check(`profile-${locale}-script`, profile.script, locale === 'en' ? 'Latn' : locale === 'zh-Hant' ? 'Hant' : 'Hans');
  check(`profile-${locale}-has-terms`, profile.preferredTerms.length > 0, true);
  check(`profile-${locale}-has-examples`, profile.examples.length > 0, true);
}

/**
 * The system prompt of one request, captured from the request body a mocked
 * `fetch` receives. This is the same code path a real batch uses, so an
 * assertion here is an assertion about what the model is sent — not about a
 * prompt string reassembled in the test.
 */
async function captureSystem(locale, text) {
  const config = {
    ...loadPromptConfig(locale),
    provider: 'mock',
    model: 'mock',
    baseUrl: 'http://mock.invalid/v1',
    apiKey: 'test',
    maxRetries: 0,
    timeoutMs: 5000,
    extraHeaders: {},
    batchSize: 8,
    maxChars: 8000,
  };
  const client = new Client(config);
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        choices: [{message: {content: '譯文'}, finish_reason: 'stop'}],
        usage: {prompt_tokens: 1, completion_tokens: 1},
      }),
      {status: 200, headers: {'content-type': 'application/json'}},
    );
  };
  try {
    await client.chat(text);
  } finally {
    globalThis.fetch = originalFetch;
  }
  return captured?.messages?.[0]?.content ?? '';
}

const sample = 'Configure the interface queue and the firewall on this router.';
const hansSystem = await captureSystem('zh-Hans', sample);
check('prompt-hans-target', /简体/.test(hansSystem), true);
check('prompt-hans-profile-terms', /接口/.test(hansSystem) && /队列/.test(hansSystem), true);
check('prompt-hans-localisation-rule', /localization|locale's documentation conventions/i.test(hansSystem), true);
check('prompt-hans-no-hardcoded-target', /Simplified Chinese\./.test(hansSystem), false);
check('prompt-hans-output-contract', /Return ONLY the translation/.test(hansSystem), true);

const hantSystem = await captureSystem('zh-Hant', sample);
check('prompt-hant-target', /臺灣正體/.test(hantSystem) && /繁體/.test(hantSystem), true);
check('prompt-hant-profile-terms', /軟體/.test(hantSystem) && /網路/.test(hantSystem), true);
check('prompt-hant-guard', /Never output Simplified/.test(hantSystem), true);
check('prompt-hant-no-simplified-target', /Simplified Chinese\./.test(hantSystem), false);

const enSystem = await captureSystem('en', sample);
check('prompt-en-target', /into English/.test(enSystem), true);
check('prompt-en-no-chinese-instruction', /[\u4e00-\u9fff]/.test(enSystem), false);
check('prompt-en-no-simplified-target', /Simplified Chinese/.test(enSystem), false);

// The per-request glossary slice is capped and relevance-filtered, not the
// whole file: only terms that occur in the text, and never more than the limit.
const promptConfig = loadPromptConfig('zh-Hans');
const limitedClient = new Client({
  ...promptConfig,
  model: 'mock',
  baseUrl: 'http://mock.invalid/v1',
  apiKey: 'test',
  timeoutMs: 1000,
  extraHeaders: {},
  glossaryLimit: 2,
});
const limitedSystem = limitedClient.system('RouterOS Newsletter MikroTik WinBox');
const terminology = limitedSystem.split('Terminology for this passage')[1] || '';
const quotedTerms = terminology.split('\n').filter((line) => line.startsWith('- ')).length;
check('prompt-glossary-slice-capped', promptConfig.glossary.length > 2 ? quotedTerms <= 2 : true, true);
check('prompt-glossary-slice-present', promptConfig.glossary.length > 0 ? quotedTerms > 0 : true, true);
check(
  'prompt-glossary-only-relevant',
  limitedClient.system('A sentence without any glossary term at all').includes('Terminology for this passage'),
  false,
);

// The four prompt builders outside the block contract read the profile too.
check('title-prompt-hant', /繁體/.test(titlePrompt('zh-Hant', 'Routing Decision')), true);
check('title-prompt-hant-no-simplified', /Simplified Chinese/.test(titlePrompt('zh-Hant', 'Routing Decision')), false);
check('description-prompt-hans', /简体/.test(descriptionPrompt('zh-Hans', 'A page about queues')), true);
check('comment-rules-hant', /繁體/.test(commentRules('zh-Hant')), true);
check('comment-rules-hant-json', /JSON array/.test(commentRules('zh-Hant')), true);

// ---------------------------------------------------------------------------
// script-check: Simplified characters/words in a zh-Hant answer
// ---------------------------------------------------------------------------

check('script-hant-simplified-warns', checkScript('软件', 'zh-Hant').ok, false);
check('script-hant-traditional-passes', checkScript('軟體', 'zh-Hant').ok, true);
check(
  'script-hant-model-word',
  checkScript('这个用户需要修改服务器的数据包队列', 'zh-Hant').issues.map((issue) => issue.form).includes('用户'),
  true,
);
check('script-hant-word-suggestion', checkScript('软件', 'zh-Hant').issues[0].suggestion, '軟體');
check('script-hant-code-ignored', checkScript('`软件` ```\n软件\n```', 'zh-Hant').ok, true);
check('script-hant-feedback', /必須使用繁體用詞/.test(feedbackFor('zh-Hant', checkScript('软件', 'zh-Hant').issues)), true);
check('script-hant-document-file-allowed', checkScript('請參閱 RouterOS 文件', 'zh-Hant').ok, true);
check('script-hans-reverse-warns', checkScript('軟體', 'zh-Hans').ok, false);
check('script-hans-correct-passes', checkScript('软件', 'zh-Hans').ok, true);
check('script-en-not-checked', checkScript('software', 'en').ok, true);

// ---------------------------------------------------------------------------
// script-guard: one feedback retry, then keep and report
// ---------------------------------------------------------------------------

// The guard asks once with the offending forms quoted; a correct second answer
// is written with no warning.
const guardCalls = [];
const recoveredWarnings = [];
const recovered = await guardScript({
  client: {
    chat: async (prompt) => {
      guardCalls.push(prompt);
      return '此軟體可以設定佇列';
    },
  },
  text: '这个软件可以设置队列',
  locale: 'zh-Hant',
  file: 'docs/example',
  record: (warning) => recoveredWarnings.push(warning),
});
check('guard-retries-once', guardCalls.length, 1);
check('guard-quotes-wrong-forms', /软件→軟體/.test(guardCalls[0]), true);
check('guard-uses-corrected-answer', recovered.text, '此軟體可以設定佇列');
check('guard-clean-after-retry', recoveredWarnings.length, 0);

// A retry that is still in the wrong script is kept (never replaced by
// English) and recorded, so the report cannot silently pass it.
let stubbornWarnings = [];
const stubborn = await guardScript({
  client: {chat: async () => '这个软件'},
  text: '这个软件',
  locale: 'zh-Hant',
  file: 'docs/example',
  record: (warning) => stubbornWarnings.push(warning),
});
check('guard-keeps-stubborn-answer', stubborn.text, '这个软件');
check('guard-records-script-warning', stubbornWarnings.length, 1);
check(
  'guard-warning-names-form',
  stubbornWarnings[0].issues.some((issue) => issue.form === '软件'),
  true,
);

// A retry the caller cannot use (here: the structure check rejects it) falls
// back to the first answer and still records the warning.
let rejectedWarnings = [];
const rejected = await guardScript({
  client: {chat: async () => '```\n这个软件\n```'},
  text: '这个软件',
  locale: 'zh-Hant',
  rewrite: () => null,
  record: (warning) => rejectedWarnings.push(warning),
});
check('guard-rejects-unusable-retry', rejected.text, '这个软件');
check('guard-records-rejected-retry', rejectedWarnings.length, 1);

// ---------------------------------------------------------------------------
// memory shards: only new/changed keys reach git, and loading merges them
// ---------------------------------------------------------------------------
// `model-memory.json` is 26 MB and gitignored, so a CI batch used to lose what
// it translated. Each save also writes a small shard with just the changed
// keys; these assertions pin that contract.
const shardWork = fs.mkdtempSync(path.join(os.tmpdir(), 'translate-shards-'));
try {
  const at = (minute) => new Date(Date.UTC(2026, 0, 2, 3, 4, minute));
  const first = saveModelMemory(new Map([['block\u0000Hello', '你好']]), {
    workDir: shardWork,
    locale: 'zh-Hans',
    now: at(5),
  });
  check('shard-written', shardFiles(shardWork).length, 1);
  check('shard-filename', path.basename(first.file), '20260102-030405-zh-Hans.json');
  const payload = JSON.parse(fs.readFileSync(first.file, 'utf8'));
  check('shard-schema', payload.schema, 1);
  check('shard-locale', payload.locale, 'zh-Hans');
  check('shard-only-changed-key', Object.keys(payload.entries), ['block\u0000Hello']);
  check('shard-reload', loadModelMemory({workDir: shardWork}).get('block\u0000Hello'), '你好');

  // Saving the same memory again must not create a second shard: otherwise a
  // fresh CI checkout (no model-memory.json) would re-commit every entry.
  saveModelMemory(new Map([['block\u0000Hello', '你好']]), {
    workDir: shardWork,
    locale: 'zh-Hans',
    now: at(6),
  });
  check('shard-noop-writes-nothing', shardFiles(shardWork).length, 1);

  // One unchanged + one new key: the new shard holds only the new key.
  saveModelMemory(
    new Map([
      ['block\u0000Hello', '你好'],
      ['block\u0000Bye', '再见'],
    ]),
    {workDir: shardWork, locale: 'zh-Hans', now: at(7)},
  );
  check('shard-incremental-count', shardFiles(shardWork).length, 2);
  check(
    'shard-incremental-keys',
    Object.keys(JSON.parse(fs.readFileSync(shardFiles(shardWork)[1], 'utf8')).entries),
    ['block\u0000Bye'],
  );

  // A shard outranks the big file it was split out of.
  fs.writeFileSync(
    path.join(shardWork, 'model-memory.json'),
    JSON.stringify({'block\u0000Hello': '旧译文'}),
  );
  check('shard-overrides-model-memory', loadModelMemory({workDir: shardWork}).get('block\u0000Hello'), '你好');
  check('shard-merge-order', readModelMemory({workDir: shardWork}).get('block\u0000Bye'), '再见');
} finally {
  fs.rmSync(shardWork, {recursive: true, force: true});
}

// ---------------------------------------------------------------------------
// refresh-changed: a changed source rebuilds only what changed
// ---------------------------------------------------------------------------
// The pipeline's promise to a reviewer is narrow and testable: a page whose
// English changed keeps the wording of every block that did not, and only the
// changed/new blocks reach the model. These fixtures use a throwaway repository
// root so nothing here can touch the real `i18n/` tree.

// The overlay root of *this* checkout's default target, not a hard-coded
// `zh-Hans`: the same test file runs in the zh-Hant repository too.
const refreshOverlayRoot = overlayRootFor(DEFAULT_TARGET_LOCALE, 'docs');
const refreshSection = {
  name: 'docs',
  source: 'docs',
  overlay: refreshOverlayRoot,
  legacy: ['v7.24'],
  stripVersion: '7.25',
  locale: DEFAULT_TARGET_LOCALE,
};
const refreshRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'translate-refresh-'));
const refreshDemo = path.join(refreshRoot, 'docs/demo.md');
const refreshDemoOverlay = path.join(refreshRoot, refreshOverlayRoot, 'demo.md');
const zhLine = (n) => `第${n}段译文说明这一部分的行为。`;
const refreshDemoV1 =
  '---\ntitle: "Refresh demo"\n---\n\n' +
  'Block one explains the first behaviour.\n\n' +
  'Block two explains the second behaviour.\n\n' +
  'Block three explains the third behaviour.\n';
const refreshDemoV2 =
  '---\ntitle: "Refresh demo"\n---\n\n' +
  'Block one explains the first behaviour.\n\n' +
  'Block two now explains a completely different behaviour of the router.\n\n' +
  'Block three explains the third behaviour.\n\n' +
  'Block four is new and explains the fourth behaviour.\n';
const refreshDemoOverlayV1 =
  '---\ntitle: "刷新演示"\n---\n\n' + `${zhLine(1)}\n\n${zhLine(2)}\n\n${zhLine(3)}\n`;

try {
  fs.mkdirSync(path.join(refreshRoot, 'work/translate'), {recursive: true});
  fs.mkdirSync(path.join(refreshRoot, 'docs'), {recursive: true});
  fs.mkdirSync(path.dirname(refreshDemoOverlay), {recursive: true});
  fs.writeFileSync(refreshDemo, refreshDemoV1);
  fs.writeFileSync(refreshDemoOverlay, refreshDemoOverlayV1);
  // The memory knows block one only: block three has to come back from the
  // previous overlay through the per-block fingerprints.
  const refreshTm = buildGlobalTm({
    legacy: {'v7.24': {'Block one explains the first behaviour.': zhLine(1)}},
  });
  const refreshState = {schema: 1, sections: {}, files: {}};

  let pass = refreshChanged({
    sections: [refreshSection],
    state: refreshState,
    tm: refreshTm,
    repo: refreshRoot,
    dryRun: true,
    log: () => {},
    warn: () => {},
  });
  check('refresh-bootstrap-dry-run-no-rebuild', pass.rebuilt, 0);
  check('refresh-bootstrap-detected', pass.baselined, 1);
  pass = refreshChanged({
    sections: [refreshSection],
    state: refreshState,
    tm: refreshTm,
    repo: refreshRoot,
    log: () => {},
    warn: () => {},
  });
  check('refresh-bootstrap-records-sha', refreshState.files['docs/demo.md']?.source_sha256, sha256Hex(refreshDemoV1));
  check(
    'refresh-bootstrap-records-blocks',
    decodeBlockHashes(refreshState.files['docs/demo.md']?.source_blocks).length,
    3,
  );
  check('refresh-bootstrap-keeps-overlay', fs.readFileSync(refreshDemoOverlay, 'utf8'), refreshDemoOverlayV1);

  fs.writeFileSync(refreshDemo, refreshDemoV2);
  const dry = refreshChanged({
    sections: [refreshSection],
    state: refreshState,
    tm: refreshTm,
    repo: refreshRoot,
    dryRun: true,
    log: () => {},
    warn: () => {},
  });
  const rebuiltBody = dry.pages[0]?.body ?? '';
  check('refresh-detects-source-change', dry.stale, 1);
  check('refresh-dry-run-writes-nothing', fs.readFileSync(refreshDemoOverlay, 'utf8'), refreshDemoOverlayV1);
  check('refresh-dry-run-keeps-old-sha', refreshState.files['docs/demo.md']?.source_sha256, sha256Hex(refreshDemoV1));
  check('refresh-memory-hit-count', dry.tmHits, 1);
  check('refresh-overlay-reuse-count', dry.reusedOverlay, 1);
  check('refresh-pending-block-count', dry.pendingBlocks, 2);
  check('refresh-keeps-unchanged-block-1', rebuiltBody.includes(zhLine(1)), true);
  check('refresh-keeps-unchanged-block-3', rebuiltBody.includes(zhLine(3)), true);
  check('refresh-drops-changed-wording', rebuiltBody.includes(zhLine(2)), false);
  check('refresh-changed-block-is-english', rebuiltBody.includes('completely different'), true);
  check('refresh-new-block-is-english', rebuiltBody.includes('Block four is new'), true);

  const written = refreshChanged({
    sections: [refreshSection],
    state: refreshState,
    tm: refreshTm,
    repo: refreshRoot,
    log: () => {},
    warn: () => {},
  });
  const overlayAfterWrite = fs.readFileSync(refreshDemoOverlay, 'utf8');
  check('refresh-writes-overlay', overlayAfterWrite.includes('completely different'), true);
  check('refresh-written-keeps-unchanged', overlayAfterWrite.includes(zhLine(1)) && overlayAfterWrite.includes(zhLine(3)), true);
  check('refresh-written-state-sha', refreshState.files['docs/demo.md']?.source_sha256, sha256Hex(refreshDemoV2));
  check('refresh-written-state-pending', refreshState.files['docs/demo.md']?.pendingBlocks, 2);
  check('refresh-written-state-status', refreshState.files['docs/demo.md']?.status, 'partial');
  check('refresh-written-state-blocks', decodeBlockHashes(refreshState.files['docs/demo.md']?.source_blocks).length, 4);
  check('refresh-written-overlay-hash', refreshState.files['docs/demo.md']?.overlay_sha256, sha256Hex(overlayAfterWrite));
  check('refresh-summary-rebuilt', written.rebuilt, 1);
  const idempotent = refreshChanged({
    sections: [refreshSection],
    state: refreshState,
    tm: refreshTm,
    repo: refreshRoot,
    dryRun: true,
    log: () => {},
    warn: () => {},
  });
  check('refresh-idempotent-after-write', idempotent.stale, 0);

  // No memory: warn and leave every overlay byte-identical (a rebuild without
  // memory would replace Chinese with English).
  const noMemoryWarnings = [];
  const noMemory = refreshChanged({
    sections: [refreshSection],
    state: refreshState,
    tm: null,
    repo: refreshRoot,
    log: () => {},
    warn: (line) => noMemoryWarnings.push(line),
  });
  check('refresh-no-tm-skipped', noMemory.skipped, true);
  check('refresh-no-tm-warns', noMemoryWarnings.some((line) => /refresh skipped/.test(line)), true);
  check('refresh-no-tm-writes-nothing', fs.readFileSync(refreshDemoOverlay, 'utf8'), overlayAfterWrite);

  // The 95% guard: an overlay whose wording the memory cannot attribute (no
  // fingerprints, no reverse entries) must not be replaced by English.
  const guardSource = path.join(refreshRoot, 'docs/guard.md');
  const guardOverlay = path.join(refreshRoot, refreshOverlayRoot, 'guard.md');
  const guardV1 =
    '---\ntitle: "Guard demo"\n---\n\n' +
    'The first guarded paragraph explains a behaviour.\n\n' +
    'The second guarded paragraph explains another behaviour.\n\n' +
    'The third guarded paragraph explains the last behaviour.\n';
  const guardV2 =
    '---\ntitle: "Guard demo"\n---\n\n' +
    'A completely different first paragraph appears here now.\n\n' +
    'A completely different second paragraph appears here now.\n\n' +
    'A completely different third paragraph appears here now.\n';
  const guardOverlayText = '---\ntitle: "守卫演示"\n---\n\n旧译文一。\n\n旧译文二。\n\n旧译文三。\n';
  fs.writeFileSync(guardSource, guardV1);
  fs.writeFileSync(guardOverlay, guardOverlayText);
  const guardState = {
    schema: 1,
    sections: {},
    files: {'docs/guard.md': {source_sha256: sha256Hex(guardV1)}},
  };
  fs.writeFileSync(guardSource, guardV2);
  const guardWarnings = [];
  const guarded = refreshChanged({
    sections: [refreshSection],
    state: guardState,
    tm: buildGlobalTm({}),
    repo: refreshRoot,
    log: () => {},
    warn: (line) => guardWarnings.push(line),
  });
  check('refresh-cjk-guard-blocks', guarded.blocked, 1);
  check('refresh-cjk-guard-reports', guardWarnings.some((line) => /refresh-blocked/.test(line)), true);
  check('refresh-cjk-guard-keeps-overlay', fs.readFileSync(guardOverlay, 'utf8'), guardOverlayText);
  check('refresh-cjk-guard-keeps-sha', guardState.files['docs/guard.md']?.source_sha256, sha256Hex(guardV1));

  // A page with no baseline whose overlay belongs to another version of the
  // page is refreshed; a page whose overlay still matches is only baselined.
  const oldEnglish = Array.from({length: 25}, (_, index) => `Old paragraph ${index + 1} describes an earlier version of the page.`);
  const oldChinese = Array.from({length: 25}, (_, index) => `第${index + 1}段旧译文说明这一部分的内容。`);
  const legacy = Object.fromEntries(oldEnglish.map((english, index) => [english, oldChinese[index]]));
  const drift = path.join(refreshRoot, 'docs/drift.md');
  const driftOverlay = path.join(refreshRoot, refreshOverlayRoot, 'drift.md');
  const driftEnglish = Array.from({length: 25}, (_, index) => `Fresh paragraph ${index + 1} describes the rewritten page.`);
  fs.writeFileSync(drift, `---\ntitle: "Drift demo"\n---\n\n${driftEnglish.join('\n\n')}\n`);
  fs.writeFileSync(driftOverlay, `---\ntitle: "漂移演示"\n---\n\n${oldChinese.join('\n\n')}\n`);
  const driftState = {schema: 1, sections: {}, files: {}};
  const driftTm = buildGlobalTm({legacy: {'v7.24': legacy}});
  const driftResult = refreshChanged({
    sections: [refreshSection],
    state: driftState,
    tm: driftTm,
    repo: refreshRoot,
    dryRun: true,
    log: () => {},
    warn: () => {},
  });
  const driftPage = driftResult.pages.find((page) => page.key === 'docs/drift.md');
  check('refresh-bootstrap-detects-foreign-overlay', driftPage?.reason, 'no-baseline');

  process.env.TRANSLATE_REFRESH_CHANGED = '0';
  check('refresh-disabled-by-env', refreshEnabled(), false);
  delete process.env.TRANSLATE_REFRESH_CHANGED;
  check('refresh-enabled-by-policy', refreshEnabled(), true);
} finally {
  fs.rmSync(refreshRoot, {recursive: true, force: true});
}

// ---------------------------------------------------------------------------
// refresh-changed through the CLI: mock model translates only the new blocks
// ---------------------------------------------------------------------------
// The unit fixture proves what the refresh *writes*; this one proves the whole
// loop — refresh, plan, mock model, write-back — because the batch script is
// where the two halves meet. The model is a local HTTP server; no real provider
// is contacted.

const cliRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'translate-refresh-cli-'));
const cliPage = path.join(cliRoot, 'docs/demo.md');
const cliOverlay = path.join(cliRoot, refreshOverlayRoot, 'demo.md');
const cliPageV1 =
  '---\ntitle: "Demo page"\n---\n\n' +
  'Block one explains the first behaviour.\n\n' +
  'Block two explains the second behaviour.\n\n' +
  'Block three explains the third behaviour.\n';
const cliPageV2 =
  '---\ntitle: "Demo page"\n---\n\n' +
  'Block one explains the first behaviour.\n\n' +
  'Block two now explains a completely different behaviour of the router.\n\n' +
  'Block three explains the third behaviour.\n\n' +
  'Block four is new and explains the fourth behaviour.\n';
let cliServer = null;
try {
  for (const rel of ['tools', 'src', 'config', 'locales.json', 'versions.json']) {
    fs.cpSync(path.join(REPO, rel), path.join(cliRoot, rel), {recursive: true});
  }
  fs.mkdirSync(path.join(cliRoot, 'data/manifests'), {recursive: true});
  fs.copyFileSync(
    path.join(REPO, 'data/manifests/current-version.json'),
    path.join(cliRoot, 'data/manifests/current-version.json'),
  );
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(cliRoot, 'node_modules'));
  fs.mkdirSync(path.join(cliRoot, 'state'), {recursive: true});
  fs.mkdirSync(path.join(cliRoot, 'work/translate'), {recursive: true});
  fs.writeFileSync(path.join(cliRoot, 'work/translate/translation-memory.json'), JSON.stringify({'v7.24': {}}));
  fs.mkdirSync(path.dirname(cliPage), {recursive: true});
  fs.mkdirSync(path.dirname(cliOverlay), {recursive: true});
  fs.writeFileSync(cliPage, cliPageV1);

  // The reply is derived from the *block text*, not from a request counter:
  // a retry (or a title prompt) must not renumber the assertions, and a block
  // that did not change must come back with the same wording.
  const blockReply = (paragraph) => {
    let hash = 0;
    for (const char of paragraph) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return `中文段落${hash.toString(36)}`;
  };
  const cliParagraphs = {
    one: 'Block one explains the first behaviour.',
    two: 'Block two explains the second behaviour.',
    twoChanged: 'Block two now explains a completely different behaviour of the router.',
    three: 'Block three explains the third behaviour.',
    four: 'Block four is new and explains the fourth behaviour.',
  };
  cliServer = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const user = (parsed.messages || []).find((message) => message.role === 'user')?.content || '';
      const pieces = user.split(/\n{2,}/).map((piece) => piece.trim()).filter(Boolean);
      const reply = pieces.map(blockReply).join('\n\n');
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(
        JSON.stringify({
          choices: [{message: {content: reply}, finish_reason: 'stop'}],
          usage: {prompt_tokens: 1, completion_tokens: 1},
        }),
      );
    });
  });
  await new Promise((resolve) => cliServer.listen(0, '127.0.0.1', resolve));

  const cliRun = (args) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, ['tools/translate/index.mjs', ...args], {
        cwd: cliRoot,
        env: {
          ...process.env,
          LLM_BASE_URL: `http://127.0.0.1:${cliServer.address().port}/v1`,
          LLM_MODEL: 'mock',
          LLM_API_KEY: 'selftest',
        },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('close', (status) => resolve({status, stdout, stderr}));
    });

  const first = await cliRun(['translate', '--apply', '--refresh-changed', '--kinds=blocks,titles']);
  check('refresh-cli-first-exit', first.status, 0);
  check('refresh-cli-first-no-locale-error', /locale is not defined/.test(first.stderr), false);
  const overlayV1 = fs.readFileSync(cliOverlay, 'utf8');
  check(
    'refresh-cli-first-translated',
    overlayV1.includes(blockReply(cliParagraphs.one)) && !/Block one explains/.test(overlayV1),
    true,
  );
  const stateFile = path.join(cliRoot, 'state/translation-state.json');
  const stateV1 = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  check('refresh-cli-first-state-sha', stateV1.files['docs/demo.md']?.source_sha256, sha256Hex(cliPageV1));

  fs.writeFileSync(cliPage, cliPageV2);
  const second = await cliRun(['translate', '--apply', '--refresh-changed', '--kinds=blocks,titles']);
  check('refresh-cli-second-exit', second.status, 0);
  check('refresh-cli-second-refreshed', /refresh: .*rebuilt=1/.test(second.stdout), true);
  const overlayV2 = fs.readFileSync(cliOverlay, 'utf8');
  check('refresh-cli-keeps-unchanged-1', overlayV2.includes(blockReply(cliParagraphs.one)), true);
  check('refresh-cli-keeps-unchanged-3', overlayV2.includes(blockReply(cliParagraphs.three)), true);
  check('refresh-cli-drops-changed-wording', overlayV2.includes(blockReply(cliParagraphs.two)), false);
  check('refresh-cli-translates-changed', overlayV2.includes(blockReply(cliParagraphs.twoChanged)), true);
  check('refresh-cli-translates-new', overlayV2.includes(blockReply(cliParagraphs.four)), true);
  check('refresh-cli-no-english-left', /Block (one|two|three|four)[^\n]*/.test(overlayV2), false);
  const stateV2 = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  check('refresh-cli-second-state-sha', stateV2.files['docs/demo.md']?.source_sha256, sha256Hex(cliPageV2));
  check('refresh-cli-second-state-pending', stateV2.files['docs/demo.md']?.pendingBlocks, 0);
  const pending = await cliRun(['pending']);
  check('refresh-cli-pending-zero', /pending=0 blocks=0 titles=0/.test(pending.stdout), true);
} finally {
  if (cliServer) cliServer.close();
  fs.rmSync(cliRoot, {recursive: true, force: true});
}

process.stdout.write(failed === 0 ? 'selftest: all rules pass\n' : `selftest: ${failed} failure(s)\n`);
process.exitCode = failed === 0 ? 0 : 1;
