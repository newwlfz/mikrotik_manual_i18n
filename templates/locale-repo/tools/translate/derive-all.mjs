#!/usr/bin/env node
/**
 * Run the derivation chain oldest → newest.
 *
 * Every docs section is derived from the next older one (`paths.mjs`), so a new
 * release reuses the reviewed wording of the previous one instead of being
 * retranslated. `derive.mjs` handles one pair; this wrapper walks the chain, so
 * importing a release keeps *all* versions in sync (7.24 → 7.25 → 7.26) rather
 * than only the newest one.
 *
 *   node tools/translate/derive-all.mjs                          # report only
 *   node tools/translate/derive-all.mjs --apply                  # write the overlays
 *   node tools/translate/derive-all.mjs --dry-run --locale=ru-RU # probe another locale
 *
 * `--locale` defaults to `zh-Hans` and is forwarded to every `derive.mjs` step;
 * the chain order itself is version-shaped and does not depend on the locale.
 * `--dry-run` is forwarded too and is the read-only form: it reports exactly
 * what `--apply` would write and writes nothing (it wins over `--apply`).
 */

import {execFileSync} from 'node:child_process';
import {DEFAULT_TARGET_LOCALE, REPO, sectionsFor} from './lib/paths.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply') && !DRY_RUN;
if (DRY_RUN && process.argv.includes('--apply')) {
  process.stderr.write('note: --dry-run overrides --apply; nothing will be written\n');
}
const LOCALE = arg('locale', DEFAULT_TARGET_LOCALE);

const docsSections = sectionsFor(LOCALE).filter(
  (section) => /^docs/.test(section.name) && section.derivedFrom,
);
const byName = new Map(docsSections.map((section) => [section.name, section]));

/** Distance to the canonical version; the canonical itself is 0. */
function depth(section, seen = new Set()) {
  if (!section.derivedFrom) return 0;
  if (seen.has(section.name)) throw new Error(`derivation cycle at ${section.name}`);
  seen.add(section.name);
  return 1 + depth(byName.get(section.derivedFrom) || {derivedFrom: null}, seen);
}

const chain = [...docsSections].sort((a, b) => depth(a) - depth(b));
if (!chain.length) {
  console.log('nothing to derive: no section declares derivedFrom');
  process.exit(0);
}

for (const section of chain) {
  const args = [
    'tools/translate/derive.mjs',
    `--from=${section.derivedFrom}`,
    `--to=${section.name}`,
    `--locale=${LOCALE}`,
  ];
  if (DRY_RUN) args.push('--dry-run');
  if (APPLY) args.push('--apply');
  console.log(`\n=== ${section.derivedFrom} → ${section.name}`);
  try {
    execFileSync(process.execPath, args, {cwd: REPO, stdio: 'inherit'});
  } catch (error) {
    if (typeof error.status === 'number') {
      // `derive.mjs` already printed the one-line reason (bad locale, unknown
      // section, ...); naming the step here keeps the chain readable without a
      // stack trace for a user error.
      process.stderr.write(
        `derive-all: ${section.derivedFrom} → ${section.name} failed (exit ${error.status}); ` +
          'stopping the chain\n',
      );
      process.exit(error.status || 1);
    }
    throw error;
  }
}
