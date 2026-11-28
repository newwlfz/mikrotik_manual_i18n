// Regression tests for the GitHub Pages project-site redirect bug:
// `baseUrl` must be part of every localized path, and an already-Chinese path
// must never be prefixed twice.
//
// Run with: npm run test:locale

import test from 'node:test';
import assert from 'node:assert/strict';

import {localizedPath} from '../../src/clientModules/locale-detect.js';

test('base "/" + "/docs/x" -> "/zh-Hans/docs/x"', () => {
  assert.deepEqual(localizedPath('/docs/x', '/'), {
    path: '/zh-Hans/docs/x',
    alreadyChinese: false,
    outsideBase: false,
  });
});

test('base "/" + "/zh-Hans/docs/x" -> unchanged, alreadyChinese=true', () => {
  assert.deepEqual(localizedPath('/zh-Hans/docs/x', '/'), {
    path: '/zh-Hans/docs/x',
    alreadyChinese: true,
    outsideBase: false,
  });
});

test('base "/repo/" + "/repo/docs/x" -> "/repo/zh-Hans/docs/x"', () => {
  assert.deepEqual(localizedPath('/repo/docs/x', '/repo/'), {
    path: '/repo/zh-Hans/docs/x',
    alreadyChinese: false,
    outsideBase: false,
  });
});

test('base "/repo/" + "/repo/zh-Hans/docs/x" -> unchanged', () => {
  assert.deepEqual(localizedPath('/repo/zh-Hans/docs/x', '/repo/'), {
    path: '/repo/zh-Hans/docs/x',
    alreadyChinese: true,
    outsideBase: false,
  });
});

test('base "/repo/" + "/repo" and "/repo/" -> "/repo/zh-Hans/"', () => {
  // `/repo` is the base root without its trailing slash.
  assert.deepEqual(localizedPath('/repo', '/repo/'), {
    path: '/repo/zh-Hans/',
    alreadyChinese: false,
    outsideBase: false,
  });
  assert.deepEqual(localizedPath('/repo/', '/repo/'), {
    path: '/repo/zh-Hans/',
    alreadyChinese: false,
    outsideBase: false,
  });
  // `/` itself is localized to `/zh-Hans/`.
  assert.deepEqual(localizedPath('/', '/'), {
    path: '/zh-Hans/',
    alreadyChinese: false,
    outsideBase: false,
  });
});

test('trailing slash is preserved', () => {
  assert.equal(localizedPath('/repo/docs/x/', '/repo/').path, '/repo/zh-Hans/docs/x/');
  assert.equal(localizedPath('/docs/x/', '/').path, '/zh-Hans/docs/x/');
});

test('query and hash stay the caller concern; the pure helper only sees pathname', () => {
  // The browser splits them off, so the helper cannot receive or corrupt them;
  // the caller appends the originals unchanged.
  const {path} = localizedPath('/repo/docs/x', '/repo/');
  assert.equal(`${path}?q=1&lang=zh#section`, '/repo/zh-Hans/docs/x?q=1&lang=zh#section');
  // A pathname containing a literal `?` is just an unusual filename.
  assert.equal(localizedPath('/docs/a?b', '/').path, '/zh-Hans/docs/a?b');
});

test('baseUrl without a trailing slash is normalized', () => {
  assert.equal(localizedPath('/repo/docs/x', '/repo').path, '/repo/zh-Hans/docs/x');
});

test('paths outside baseUrl are never localized (stale prefixed URLs)', () => {
  // The historical broken target: /zh-Hans/mikrotik_manual_i18n/docs/introduction.
  assert.deepEqual(localizedPath('/zh-Hans/mikrotik_manual_i18n/docs/introduction', '/mikrotik_manual_i18n/'), {
    path: '/zh-Hans/mikrotik_manual_i18n/docs/introduction',
    alreadyChinese: false,
    outsideBase: true,
  });
  // A sibling path such as /repository must not match baseUrl /repo/.
  assert.equal(localizedPath('/repository/docs/x', '/repo/').outsideBase, true);
});
