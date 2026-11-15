// Unit tests for the rendered-image recovery used by `sync:assets`.
//
// The fixtures are fixed snippets of the shapes the official site actually
// emits: content-hashed `<img>` tags without alt text, and images inlined as
// `data:` URIs below Webpack's size limit. No network.
//
// Run with: npm run test:sync-assets

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIME_EXTENSION,
  alignRenderedImage,
  decodeInlineImage,
  imageFileName,
  imageLinksOf,
  imageReferencesOf,
  parseDataUri,
  renderedImages,
} from './rendered-images.mjs';

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const WEBP_1X1 = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
const SVG_1X1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>').toString('base64');

/** The article/footer split matters: the logo is outside `.theme-doc-markdown`. */
const HTML = `<!doctype html><html><body>
<nav class="navbar"><img src="/img/logo.svg" alt="MikroTik RouterOS"></nav>
<article>
  <div class="theme-doc-markdown markdown">
    <p>Pick the packages, then install them.</p>
    <img decoding=async loading=lazy src="/assets/images/packages1-4e46fb956c156b37b9f1540e53e65830.png" width=3138 height=2056 class=img_ev3q />
    <img decoding=async loading=lazy src="data:image/webp;base64,${WEBP_1X1}" width=1138 height=154 class=img_ev3q />
    <center><img alt="WiFi network in WinBox" src="data:image/png;base64,${PNG_1X1}" /></center>
  </div>
</article>
</body></html>`;

const MARKDOWN = `| Package list | After "Check for updates" |
| :--- | :--- |
| [![](img/packages1.png)](img/packages1.png) | [![](img/packages2.png)](img/packages2.png) |

![](./img/packages-01.webp)Success in the log entries![](./img/packages-02.webp)Failure
`;

test('renderedImages keeps article order and skips the navbar logo', () => {
  const images = renderedImages(HTML, 'https://manual.mikrotik.com');
  assert.equal(images.length, 3);
  assert.equal(images[0].url, 'https://manual.mikrotik.com/assets/images/packages1-4e46fb956c156b37b9f1540e53e65830.png');
  assert.equal(images[1].url, null, 'a data: URI has no fetchable URL');
  assert.equal(images[1].src.startsWith('data:image/webp;base64,'), true);
  assert.equal(images[2].alt, 'WiFi network in WinBox');
});

test('the fixed data: URI decodes to the declared MIME and keeps its Markdown name', () => {
  const image = renderedImages(HTML, 'https://manual.mikrotik.com')[1];
  const decoded = decodeInlineImage(image.src);
  assert.equal(decoded.mime, 'image/webp');
  assert.equal(decoded.extension, '.webp');
  assert.ok(decoded.bytes.length > 0);
  assert.equal(decoded.bytes.subarray(0, 4).toString('ascii'), 'RIFF');
  // The Markdown reference is what has to resolve after the write.
  assert.equal(imageFileName('./img/packages1.png#gh-light-mode-only'), 'packages1.png');
  assert.equal(imageFileName('img/packages-01.webp?v=2#frag'), 'packages-01.webp');
});

test('all five allowed types decode, including a text SVG', () => {
  const cases = [
    [`data:image/png;base64,${PNG_1X1}`, 'image/png', '.png'],
    [`data:image/webp;base64,${WEBP_1X1}`, 'image/webp', '.webp'],
    [`data:image/svg+xml;base64,${SVG_1X1}`, 'image/svg+xml', '.svg'],
    [`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"></svg>')}`, 'image/svg+xml', '.svg'],
  ];
  for (const [uri, mime, extension] of cases) {
    const decoded = decodeInlineImage(uri);
    assert.equal(decoded.mime, mime);
    assert.equal(decoded.extension, extension);
    assert.equal(MIME_EXTENSION[mime], extension);
  }
});

test('a #gh-light-mode-only fragment is not part of the base64 payload', () => {
  // 7.26's SVG diagrams keep the display hint on the src:
  // `data:image/svg+xml;base64,…=#gh-light-mode-only`.
  const decoded = decodeInlineImage(`data:image/svg+xml;base64,${SVG_1X1}#gh-light-mode-only`);
  assert.equal(decoded.mime, 'image/svg+xml');
  assert.equal(decoded.bytes.toString('utf8').startsWith('<svg'), true);
  assert.equal(parseDataUri(`data:image/png;base64,${PNG_1X1}#frag`).payload, PNG_1X1);
});

test('decode rejects a non-image type, an empty payload and bytes that contradict the label', () => {
  assert.throws(() => decodeInlineImage('data:text/plain;base64,aGk='), /unsupported inline image type/);
  assert.throws(() => decodeInlineImage('data:image/webp;base64,'), /empty|not valid base64/);
  assert.throws(() => decodeInlineImage('data:image/png;base64,aGk='), /not image\/png/);
  assert.throws(() => decodeInlineImage('data:image/webp;base64,!!!!'), /not valid base64/);
  assert.throws(() => decodeInlineImage('not a data uri'), /not a data: URI/);
  assert.equal(parseDataUri('https://manual.mikrotik.com/img/logo.svg'), null);
});

test('alt text wins when the rendered page has extra images', () => {
  const images = [
    {src: '/a.png', alt: '', url: 'https://x/a.png'},
    {src: '/b.png', alt: 'WiFi network in WinBox', url: 'https://x/b.png'},
    {src: '/c.png', alt: '', url: 'https://x/c.png'},
  ];
  const match = alignRenderedImage(images, {alt: 'wifi   network in winbox', index: 0, count: 2});
  assert.equal(match.src, '/b.png');
});

test('position is used only when the lists have the same length', () => {
  const images = [{src: '/a.png', alt: '', url: 'https://x/a.png'}, {src: '/b.png', alt: '', url: 'https://x/b.png'}];
  assert.equal(alignRenderedImage(images, {index: 1, count: 2}).src, '/b.png');
  assert.equal(alignRenderedImage(images, {index: 1, count: 3}), null);
  assert.equal(alignRenderedImage([], {index: 0, count: 0}), null);
});

test('image references and thumbnail links are read in document order', () => {
  const images = imageReferencesOf(MARKDOWN);
  assert.deepEqual(
    images.map((image) => [image.url, image.alt, image.kind]),
    [
      ['img/packages1.png', '', 'image'],
      ['img/packages2.png', '', 'image'],
      ['./img/packages-01.webp', '', 'image'],
      ['./img/packages-02.webp', '', 'image'],
    ],
  );
  // `](target)` also sees the destination of a Markdown image, so the list
  // contains both halves of each thumbnail and the bare images. The caller
  // deduplicates by path (image references are added first).
  const links = imageLinksOf(MARKDOWN);
  assert.deepEqual(
    links.map((link) => link.url),
    [
      'img/packages1.png',
      'img/packages1.png',
      'img/packages2.png',
      'img/packages2.png',
      './img/packages-01.webp',
      './img/packages-02.webp',
    ],
  );
});
