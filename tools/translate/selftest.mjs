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
import {alignImages, rebaseImages, rebuildFromPairs} from './lib/apply.mjs';
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
import {spawnSync} from 'node:child_process';
import {
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
check('verify-all-locales-exit', verifyAll.status, 0);
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

process.stdout.write(failed === 0 ? 'selftest: all rules pass\n' : `selftest: ${failed} failure(s)\n`);
process.exitCode = failed === 0 ? 0 : 1;
