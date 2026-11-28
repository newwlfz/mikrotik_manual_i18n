#!/usr/bin/env node
/**
 * `npm run lock:check` — package-lock integrity gate (hub-only).
 *
 * Why this exists: a previous lockfile had the root deps in sync with
 * package.json but was *incomplete* — `pagefind` declared seven platform
 * packages under `optionalDependencies` while the lock carried none of them.
 * `npm ci` still succeeded, so the defect only surfaced at build time on a
 * machine that needed one of those binaries. This verifier runs *before* `npm
 * ci` (it uses only Node built-ins) and fails with the exact missing keys.
 *
 * Assertions:
 *   A  lock.packages[""] dependencies / devDependencies === package.json's
 *   B  every `packages[pkg].optionalDependencies[name]` resolves to a
 *      `packages["node_modules/<name>"]` entry (root or a valid nested slot)
 *   C  the number of pagefind platform packages equals the number of names in
 *      pagefind's optionalDependencies (7 today)
 *
 * The verifier is read-only: it never rewrites or "repairs" the lockfile.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_DEPS = ['dependencies', 'devDependencies'];

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const packages = lock.packages || {};

const failures = [];

/** Key-order-insensitive comparison of two flat {name: range} maps. */
const canonical = (map) =>
  map && typeof map === 'object'
    ? JSON.stringify(Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))))
    : JSON.stringify(map ?? null);

/**
 * Resolve an optional dependency from the package that declares it, walking
 * Node's node_modules chain up to the root. A root-level `node_modules/<name>`
 * entry is the normal answer; nested slots are accepted because a transitive
 * package may legitimately pin a different version there.
 */
function resolveOptional(from, name) {
  const suffix = `node_modules/${name}`;
  let dir = from || '';
  for (;;) {
    const candidate = dir ? `${dir}/${suffix}` : suffix;
    if (packages[candidate]) return candidate;
    if (!dir) return null;
    const index = dir.lastIndexOf('node_modules/');
    if (index < 0) return packages[suffix] ? suffix : null;
    dir = dir.slice(0, index);
  }
}

// --- Assertion 0: this verifier knows the lockfile format it is reading. ---
if (lock.lockfileVersion !== 3) {
  failures.push(`lockfileVersion: expected 3, got ${String(lock.lockfileVersion)}`);
}

// --- Assertion A: the root package record mirrors package.json exactly. ---
const root = packages[''] || {};
for (const section of ROOT_DEPS) {
  const expected = canonical(pkg[section]);
  const actual = canonical(root[section]);
  if (expected !== actual) {
    const wanted = new Set(Object.keys(pkg[section] || {}));
    const got = new Set(Object.keys(root[section] || {}));
    const onlyPkg = [...wanted].filter((name) => !got.has(name));
    const onlyLock = [...got].filter((name) => !wanted.has(name));
    failures.push(
      `packages[""].${section} differs from package.json (package.json-only: ${onlyPkg.join(', ') || 'none'}; lock-only: ${onlyLock.join(', ') || 'none'}; values may also differ)`,
    );
  }
}

// --- Assertion B: every declared optional dependency has a lock entry. ---
let optionalPackages = 0;
let optionalDeclarations = 0;
const missing = [];
for (const [from, entry] of Object.entries(packages)) {
  const declared = entry && entry.optionalDependencies;
  if (!declared || typeof declared !== 'object') continue;
  optionalPackages++;
  for (const name of Object.keys(declared)) {
    optionalDeclarations++;
    if (!resolveOptional(from, name)) missing.push({from: from || '(root)', name, key: `node_modules/${name}`});
  }
}
for (const item of missing) {
  failures.push(`MISSING optional dependency ${item.key} (declared by ${item.from})`);
}

// --- Assertion C: pagefind's platform packages are all present. ---
const pagefind = packages['node_modules/pagefind'] || null;
const pagefindDeclared = pagefind?.optionalDependencies && typeof pagefind.optionalDependencies === 'object'
  ? Object.keys(pagefind.optionalDependencies)
  : [];
const pagefindMissing = pagefindDeclared.filter((name) => !packages[`node_modules/${name}`]);
if (!pagefind) {
  failures.push('MISSING packages["node_modules/pagefind"]');
}
if (pagefindMissing.length) {
  failures.push(`pagefind platform package(s) missing: ${pagefindMissing.join(', ')}`);
}
const pagefindPresent = pagefindDeclared.length - pagefindMissing.length;

// --- Report (numbers first, then failures) ---
console.log(
  `lock:check: lockfileVersion=${String(lock.lockfileVersion)} rootDeps=${Object.keys(pkg.dependencies || {}).length} rootDevDeps=${Object.keys(pkg.devDependencies || {}).length}`,
);
console.log(
  `lock:check: optional packages=${optionalPackages} declarations=${optionalDeclarations} missing=${missing.length}`,
);
console.log(`lock:check: pagefind platform packages=${pagefindPresent}/${pagefindDeclared.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`lock:check: ${failure}`);
  console.error(`lock:check: FAIL (${failures.length} problem(s)); the lockfile was NOT modified.`);
  process.exit(1);
}
console.log('lock:check: PASS (0 failures; lockfile left untouched)');
