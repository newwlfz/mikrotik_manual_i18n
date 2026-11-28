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
  normalizeAssetOrigin,
  homeBasePath,
  resolveSites,
  validateRegistry,
} from '../content/locales.js';
import {pickTargetLocale} from '../../src/clientModules/locale-detect.js';

// Build output: root-absolute base paths only — no origin is baked into the
// artifact. The browser adds `location.origin` (127.0.0.1, LAN or Pages).
const HOMES = {
  en: '/mikrotik_manual_i18n',
  'zh-Hans': '/mikrotik_manual_zh_hans',
  'zh-Hant': '/mikrotik_manual_zh_hant',
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

/** Hub with both Chinese sites reserved in the registry but not deployed yet. */
const REGISTRY_SINGLE = {
  default: 'en',
  locales: {
    en: {
      label: 'English',
      repo: 'newwlfz/mikrotik_manual_i18n',
      baseUrl: '/mikrotik_manual_i18n/',
      site: 'https://newwlfz.github.io/mikrotik_manual_i18n/',
      available: true,
    },
    'zh-Hans': {
      label: '简体中文',
      repo: 'newwlfz/mikrotik_manual_zh_hans',
      baseUrl: '/mikrotik_manual_zh_hans/',
      site: 'https://newwlfz.github.io/mikrotik_manual_zh_hans/',
      available: false,
    },
    'zh-Hant': {
      label: '繁體中文',
      repo: 'newwlfz/mikrotik_manual_zh_hant',
      baseUrl: '/mikrotik_manual_zh_hant/',
      site: 'https://newwlfz.github.io/mikrotik_manual_zh_hant/',
      available: false,
    },
  },
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
function runHeadScript({
  languages,
  siteLocale = 'en',
  homes = HOMES,
  cookie = '',
  origin = 'http://127.0.0.1:3030',
  localStorage = {},
}) {
  const replacements = [];
  const writes = [];
  let jar = cookie;
  const sandbox = {
    navigator: {languages, language: languages[0] || ''},
    location: {
      origin,
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
      store: new Map(Object.entries(localStorage)),
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
    'http://127.0.0.1:3030/mikrotik_manual_zh_hant/docs/introduction/',
  ]);
  assert.match(result.cookie, /docusaurus_locale_auto=zh-Hant/);
});

test('<head> script: zh-CN on the English site goes to the Simplified site', () => {
  const result = runHeadScript({languages: ['zh-CN']});
  assert.deepEqual(result.replacements, [
    'http://127.0.0.1:3030/mikrotik_manual_zh_hans/docs/introduction/',
  ]);
  assert.match(result.cookie, /docusaurus_locale_auto=zh-Hans/);
});

test('<head> script: the same base path follows the serving host (LAN/Pages)', () => {
  const lan = runHeadScript({languages: ['zh-CN'], origin: 'http://192.168.2.220:3030'});
  assert.deepEqual(lan.replacements, [
    'http://192.168.2.220:3030/mikrotik_manual_zh_hans/docs/introduction/',
  ]);
  const pages = runHeadScript({languages: ['zh-CN'], origin: 'https://newwlfz.github.io'});
  assert.deepEqual(pages.replacements, [
    'https://newwlfz.github.io/mikrotik_manual_zh_hans/docs/introduction/',
  ]);
});

test('<head> script: legacy absolute HOMES are normalized to base paths', () => {
  const result = runHeadScript({
    languages: ['zh-TW'],
    homes: {
      en: 'https://newwlfz.github.io/mikrotik_manual_i18n',
      'zh-Hans': 'https://newwlfz.github.io/mikrotik_manual_zh_hans',
      'zh-Hant': 'https://newwlfz.github.io/mikrotik_manual_zh_hant',
    },
    origin: 'http://192.168.2.220:3030',
  });
  assert.deepEqual(result.replacements, [
    'http://192.168.2.220:3030/mikrotik_manual_zh_hant/docs/introduction/',
  ]);
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

test('<head> script: a manual zh choice outranks automatic adaptation', () => {
  // A Traditional browser on the English site would normally hop to the
  // Traditional site. A manual Simplified choice must win: no redirect, no
  // redirecting signal and no auto marker written behind the reader's back.
  const cookie = runHeadScript({
    languages: ['zh-TW'],
    cookie: 'docusaurus_locale=zh-Hans',
  });
  assert.deepEqual(cookie.replacements, []);
  assert.equal(cookie.sandbox.__LOCALE_SETTLED__, true);
  assert.equal(cookie.sandbox.__LOCALE_REDIRECTING__, undefined);
  assert.doesNotMatch(cookie.cookie, /docusaurus_locale_auto=/);

  // The locale dropdown writes the explicit key to localStorage as well; that
  // store must carry the same priority as the cookie.
  const storage = runHeadScript({
    languages: ['zh-TW'],
    localStorage: {docusaurus_locale: 'zh-Hant'},
  });
  assert.deepEqual(storage.replacements, []);
  assert.equal(storage.sandbox.__LOCALE_SETTLED__, true);
  assert.equal(storage.sandbox.__LOCALE_REDIRECTING__, undefined);
  assert.doesNotMatch(storage.cookie, /docusaurus_locale_auto=/);
});

test('<head> script: the auto marker stops a second redirect', () => {
  const result = runHeadScript({
    languages: ['zh-TW'],
    cookie: 'docusaurus_locale_auto=zh-Hant',
  });
  assert.deepEqual(result.replacements, []);
});

test('ASSET_ORIGIN: path-only is canonical, full URL is compatible, junk fails', () => {
  assert.equal(normalizeAssetOrigin('/mikrotik_manual_i18n/'), '/mikrotik_manual_i18n');
  assert.equal(
    normalizeAssetOrigin('https://newwlfz.github.io/mikrotik_manual_i18n/'),
    'https://newwlfz.github.io/mikrotik_manual_i18n',
  );
  assert.equal(normalizeAssetOrigin('  '), null);
  assert.throws(() => normalizeAssetOrigin('mikrotik_manual_i18n'), /ASSET_ORIGIN must be/);
});

test('resolveSites: homes are base paths while localeConfigs keep absolute URLs', () => {
  const registry = {
    default: 'en',
    locales: {
      en: {
        label: 'English',
        baseUrl: '/mikrotik_manual_i18n/',
        site: 'https://newwlfz.github.io/mikrotik_manual_i18n/',
      },
      'zh-Hans': {
        label: '简体',
        baseUrl: '/mikrotik_manual_zh_hans/',
        site: 'https://newwlfz.github.io/mikrotik_manual_zh_hans/',
      },
    },
  };
  const sites = resolveSites(registry, {
    env: {SITE_LOCALE: 'en', SITE_URL: 'http://192.168.2.220:3030'},
  });
  assert.deepEqual(sites.homes, {
    en: '/mikrotik_manual_i18n',
    'zh-Hans': '/mikrotik_manual_zh_hans',
  });
  assert.equal(sites.zhHome, '/mikrotik_manual_zh_hans');
  assert.equal(sites.defaultHome, '/mikrotik_manual_i18n');
  assert.equal(sites.localeConfigs['zh-Hans'].url, 'https://newwlfz.github.io');
  assert.equal(homeBasePath('https://x.test/repo/'), '/repo');
});

// --- Single-locale fallback -------------------------------------------------
// Declaring a locale is not the same as deploying it. The hub keeps both
// Chinese entries reserved (repo/address), but `available:false` must take them
// out of i18n.locales, localeConfigs, homes, the dropdown and the redirect.

test('single-locale registry: declared-but-unavailable zh never redirects', () => {
  assert.equal(pickRedirectLocale(REGISTRY_SINGLE, ['zh-CN']), null);
  assert.equal(pickRedirectLocale(REGISTRY_SINGLE, ['zh-TW']), null);
  assert.equal(pickRedirectLocale(REGISTRY_SINGLE, ['zh']), null);
});

test('single-locale registry: resolveSites exposes only the online locale', () => {
  const sites = resolveSites(REGISTRY_SINGLE, {env: {SITE_LOCALE: 'en'}});
  assert.deepEqual(sites.availableLocales, ['en']);
  assert.deepEqual(Object.keys(sites.localeConfigs), ['en']);
  assert.deepEqual(sites.homes, {en: '/mikrotik_manual_i18n'});
  assert.equal(sites.defaultZh, null);
  assert.equal(sites.zhHome, null);
  assert.equal(sites.defaultHome, '/mikrotik_manual_i18n');
});

test('single-locale fallback: head script with only the en home stays put', () => {
  const {homes} = resolveSites(REGISTRY_SINGLE, {env: {SITE_LOCALE: 'en'}});
  const result = runHeadScript({languages: ['zh-TW'], homes});
  assert.deepEqual(result.replacements, []);
  assert.equal(result.sandbox.__LOCALE_SETTLED__, true);
  // The client helper receives the same (available-only) HOMES map.
  assert.equal(pickTargetLocale('zh-Hans', RULES, homes, null, 'en'), null);
});

test('flipping available back on restores the trilingual entries', () => {
  const online = structuredClone(REGISTRY_SINGLE);
  online.locales['zh-Hans'].available = true;
  online.locales['zh-Hant'].available = true;
  const sites = resolveSites(online, {env: {SITE_LOCALE: 'en'}});
  assert.deepEqual(sites.availableLocales, ['en', 'zh-Hans', 'zh-Hant']);
  assert.equal(sites.defaultZh, 'zh-Hans');
  assert.equal(sites.zhHome, '/mikrotik_manual_zh_hans');
  assert.equal(pickRedirectLocale(online, ['zh-TW']), 'zh-Hant');
  const result = runHeadScript({languages: ['zh-TW'], homes: sites.homes});
  assert.deepEqual(result.replacements, [
    'http://127.0.0.1:3030/mikrotik_manual_zh_hant/docs/introduction/',
  ]);
});

test('validation: available is boolean and at least one locale stays online', () => {
  assert.deepEqual(validateRegistry(REGISTRY_SINGLE), []);
  const badFlag = structuredClone(REGISTRY_SINGLE);
  badFlag.locales.en.available = 'yes';
  assert.ok(validateRegistry(badFlag).some((line) => /available must be a boolean/.test(line)));
  const allOffline = structuredClone(REGISTRY_SINGLE);
  allOffline.locales.en.available = false;
  assert.ok(
    validateRegistry(allOffline).some((line) => /at least one available locale/.test(line)),
  );
  assert.ok(validateRegistry(allOffline).some((line) => /default.*must be available/.test(line)));
});
