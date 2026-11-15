// Browser-language → target-site mapping.
//
// The English site used to send every Chinese browser to the **first** Chinese
// locale in `locales.json`; with two Chinese sites that means a `zh-TW` reader
// lands on the Simplified site. These tests pin the mapping table, the shared
// client helper and the generated `<head>` script (the one that runs before
// React) to one another.
//
// Run with: npm run test:redirect

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {
  pickRedirectLocale,
  zhVariantTargets,
  localeRedirectScript,
} from '../content/locales.js';
import {pickTargetLocale} from '../../src/clientModules/locale-detect.js';

const HOMES = {
  en: 'https://newwlfz.github.io/mikrotik_manual_i18n',
  'zh-Hans': 'https://newwlfz.github.io/mikrotik_manual_zh_hans',
  'zh-Hant': 'https://newwlfz.github.io/mikrotik_manual_zh_hant',
};
const RULES = zhVariantTargets();
const REGISTRY = {
  default: 'en',
  locales: {
    en: {label: 'English'},
    'zh-Hans': {label: '简体中文'},
    'zh-Hant': {label: '繁體中文'},
  },
};

/** Only the Simplified site registered (a registry before this change). */
const REGISTRY_HANS_ONLY = {
  default: 'en',
  locales: {en: {label: 'English'}, 'zh-Hans': {label: '简体中文'}},
};

test('zh-TW maps to Traditional', () => {
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-TW']), 'zh-Hant');
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-TW', 'en']), 'zh-Hant');
});

test('zh-HK maps to Traditional', () => {
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-HK']), 'zh-Hant');
});

test('zh-MO and zh-Hant* map to Traditional', () => {
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-MO']), 'zh-Hant');
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-Hant']), 'zh-Hant');
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-Hant-TW']), 'zh-Hant');
});

test('zh-CN maps to Simplified', () => {
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-CN']), 'zh-Hans');
});

test('zh-SG maps to Simplified', () => {
  assert.equal(pickRedirectLocale(REGISTRY, ['zh-SG']), 'zh-Hans');
});

test('bare zh maps to Simplified (the registry default Chinese locale)', () => {
  assert.equal(pickRedirectLocale(REGISTRY, ['zh']), 'zh-Hans');
});

test('English and other languages never redirect', () => {
  for (const language of ['en', 'en-US', 'de', 'ja', 'fr-CA', '']) {
    assert.equal(pickRedirectLocale(REGISTRY, [language]), null, language);
  }
});

test('a target that is not registered never redirects', () => {
  assert.equal(pickRedirectLocale(REGISTRY_HANS_ONLY, ['zh-TW']), null);
  assert.equal(pickRedirectLocale(REGISTRY_HANS_ONLY, ['zh-Hant']), null);
  // Simplified is still registered, so a Simplified browser keeps working.
  assert.equal(pickRedirectLocale(REGISTRY_HANS_ONLY, ['zh-CN']), 'zh-Hans');
});

test('the client helper agrees with the shared table', () => {
  const cases = [
    ['zh-TW', 'zh-Hant'],
    ['zh-HK', 'zh-Hant'],
    ['zh-CN', 'zh-Hans'],
    ['zh-SG', 'zh-Hans'],
    ['zh', 'zh-Hans'],
    ['en', null],
  ];
  for (const [language, expected] of cases) {
    assert.equal(
      pickTargetLocale(language, RULES, HOMES, 'zh-Hans', 'en'),
      expected,
      language,
    );
  }
});

test('the current site is never a redirect target', () => {
  // Traditional site: a Traditional browser is already where it belongs.
  assert.equal(pickTargetLocale('zh-TW', RULES, HOMES, 'zh-Hans', 'zh-Hant'), null);
  // Simplified site: a Simplified browser is already where it belongs.
  assert.equal(pickTargetLocale('zh-CN', RULES, HOMES, 'zh-Hans', 'zh-Hans'), null);
  // …while the *other* variant still gets its own site.
  assert.equal(
    pickTargetLocale('zh-CN', RULES, HOMES, 'zh-Hans', 'zh-Hant'),
    'zh-Hans',
  );
  assert.equal(
    pickTargetLocale('zh-TW', RULES, HOMES, 'zh-Hans', 'zh-Hans'),
    'zh-Hant',
  );
});

/**
 * Evaluate the generated `<head>` script in a fake browser.
 *
 * This is the code that actually runs before React, so the assertions below are
 * the behaviour a reader gets — not just the helper's return value.
 */
function runHeadScript({languages, siteLocale = 'en', homes = HOMES, cookie = ''}) {
  const replacements = [];
  const writes = [];
  let jar = cookie;
  const sandbox = {
    navigator: {languages, language: languages[0] || ''},
    location: {
      pathname: '/mikrotik_manual_i18n/docs/introduction/',
      search: '',
      hash: '',
      replace(url) {
        replacements.push(url);
      },
    },
    document: {
      get cookie() {
        return jar;
      },
      set cookie(value) {
        jar = jar ? `${jar}; ${value}` : value;
        writes.push(value);
      },
    },
    localStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
    },
    console,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout,
  };
  sandbox.window = sandbox;
  sandbox.dispatchEvent = () => {};

  const script = localeRedirectScript({
    base: '/mikrotik_manual_i18n/',
    currentLocale: siteLocale,
    homes,
    rules: RULES,
    defaultZh: 'zh-Hans',
    cookies: {
      explicit: 'docusaurus_locale',
      auto: 'docusaurus_locale_auto',
      maxAge: 31536000,
    },
  });
  vm.runInNewContext(script, sandbox);
  return {replacements, writes, sandbox, cookie: jar};
}

test('<head> script: zh-TW on the English site goes to the Traditional site', () => {
  const result = runHeadScript({languages: ['zh-TW']});
  assert.deepEqual(result.replacements, [
    'https://newwlfz.github.io/mikrotik_manual_zh_hant/docs/introduction/',
  ]);
  assert.match(result.cookie, /docusaurus_locale_auto=zh-Hant/);
});

test('<head> script: zh-CN on the English site goes to the Simplified site', () => {
  const result = runHeadScript({languages: ['zh-CN']});
  assert.deepEqual(result.replacements, [
    'https://newwlfz.github.io/mikrotik_manual_zh_hans/docs/introduction/',
  ]);
  assert.match(result.cookie, /docusaurus_locale_auto=zh-Hans/);
});

test('<head> script: an English browser stays put and is marked settled', () => {
  const result = runHeadScript({languages: ['en-US']});
  assert.deepEqual(result.replacements, []);
  assert.equal(result.sandbox.__LOCALE_SETTLED__, true);
});

test('<head> script: a Traditional browser on the Traditional site does not move', () => {
  const result = runHeadScript({languages: ['zh-TW'], siteLocale: 'zh-Hant'});
  assert.deepEqual(result.replacements, []);
  assert.equal(result.sandbox.__LOCALE_SETTLED__, true);
});

test('<head> script: an unregistered target does not move', () => {
  const result = runHeadScript({
    languages: ['zh-TW'],
    homes: {
      en: HOMES.en,
      'zh-Hans': HOMES['zh-Hans'],
    },
  });
  assert.deepEqual(result.replacements, []);
  assert.equal(result.sandbox.__LOCALE_SETTLED__, true);
});

test('<head> script: an explicit choice wins', () => {
  const result = runHeadScript({
    languages: ['zh-TW'],
    cookie: 'docusaurus_locale=en',
  });
  assert.deepEqual(result.replacements, []);
  assert.equal(result.sandbox.__LOCALE_SETTLED__, true);
});

test('<head> script: the auto marker stops a second redirect', () => {
  const result = runHeadScript({
    languages: ['zh-TW'],
    cookie: 'docusaurus_locale_auto=zh-Hant',
  });
  assert.deepEqual(result.replacements, []);
});
