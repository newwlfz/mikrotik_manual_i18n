/**
 * Per-locale translation profiles.
 *
 * The prompt used to hard-code "Simplified Chinese": every target language got
 * the same rules and the same target, so a new locale could only be produced by
 * converting an existing one (which is how `zh-Hant` started, as an OpenCC
 * `s2twp` derivation). A profile is the missing input: one Markdown file per
 * locale under `config/locale-profiles/` that states the writing system, the
 * register, the punctuation, what stays verbatim and — most importantly — the
 * preferred wording, with one bad/good example pair per recurring mistake.
 *
 * The file format is deliberately the same for every locale (see the files in
 * that directory):
 *
 *   # <language name>
 *   - script: Hans|Hant|Latn
 *   - register: ...
 *   - punctuation: ...
 *   - keep-verbatim: ...
 *   - preferred terms: term→wording；term→wording
 *   - examples:
 *     - bad: ...
 *       good: ...
 *
 * `profileFor(locale)` is the only reader. A missing profile is a warning, not
 * a crash: the pipeline still runs on the generic template, because refusing to
 * translate is worse than translating with the default register. The warning is
 * what tells the operator to add the file.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO} from './paths.mjs';

/** `config/locale-profiles/`. */
export const PROFILE_DIR = path.join(REPO, 'config/locale-profiles');

const cache = new Map();
const warned = new Set();

/** Writing system of one locale tag when its profile is missing. */
export function scriptOf(locale) {
  const tag = String(locale ?? '').trim();
  if (/^(zh-Hant|zh-TW|zh-HK|zh-MO)$/i.test(tag)) return 'Hant';
  if (/^zh/i.test(tag)) return 'Hans';
  return 'Latn';
}

/** `config/locale-profiles/<locale>.md`. */
export function profilePath(locale) {
  return path.join(PROFILE_DIR, `${locale}.md`);
}

/** Split `preferred terms` on the separators the profiles use. */
function splitTerms(value) {
  return String(value ?? '')
    .split(/[；;]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

/** Parse one profile file. Exported for the selftest; `profileFor` caches it. */
export function parseProfile(text, {locale, file} = {}) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const fields = {};
  const examples = [];
  let pendingBad = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const heading = /^#\s+(.+?)\s*$/.exec(line);
    if (heading) {
      fields.label = heading[1];
      continue;
    }
    const bullet = /^-\s+([A-Za-z][A-Za-z -]*):\s*(.*)$/.exec(line);
    if (bullet) {
      const key = bullet[1].trim().toLowerCase().replace(/\s+/g, '-');
      if (key === 'examples') continue;
      fields[key] = bullet[2].trim();
      continue;
    }
    // `  - bad: …` / `    good: …` under `examples:`.
    const example = /^\s+-?\s*(bad|good):\s*(.*)$/.exec(line);
    if (example) {
      if (example[1] === 'bad') {
        pendingBad = {bad: example[2].trim(), good: ''};
        examples.push(pendingBad);
      } else if (pendingBad) {
        pendingBad.good = example[2].trim();
      }
    }
  }

  return {
    locale,
    file,
    exists: true,
    label: fields.label || locale,
    script: (fields.script || scriptOf(locale)).trim(),
    register: fields.register || '',
    punctuation: fields.punctuation || '',
    // `keep-verbatim` is the documented spelling; accept the joined variant too.
    keepVerbatim: fields['keep-verbatim'] || fields.keepverbatim || '',
    preferredTerms: splitTerms(fields['preferred-terms']),
    examples: examples.filter((example) => example.bad || example.good),
    raw: String(text ?? '').trim(),
    warnings: [],
  };
}

/**
 * The generic template used when a locale has no profile.
 *
 * It is intentionally minimal: the prompt still names the target language and
 * the rules still say "follow this locale's conventions", but there is no
 * terminology list to get wrong. The warning is the actionable part.
 */
function fallbackProfile(locale, file, message) {
  return {
    locale,
    file,
    exists: false,
    label: locale,
    script: scriptOf(locale),
    register: 'technical documentation, concise, second person',
    punctuation: scriptOf(locale) === 'Latn' ? 'ASCII' : 'full-width',
    keepVerbatim: 'code, commands, menu paths, parameter names, paths, anchors, URLs, product names',
    preferredTerms: [],
    examples: [],
    raw: '',
    warnings: [message],
  };
}

/**
 * The profile of one locale.
 *
 * A missing file warns once per locale (a batch run calls this per page, and a
 * warning per call would bury the batch log) and returns the generic template
 * with `exists: false`, so callers can tell "documented locale" from "guess".
 */
export function profileFor(locale) {
  const tag = String(locale ?? '').trim();
  if (cache.has(tag)) return cache.get(tag);

  const file = profilePath(tag);
  let profile;
  if (fs.existsSync(file)) {
    profile = parseProfile(fs.readFileSync(file, 'utf8'), {locale: tag, file});
  } else {
    const message =
      `no locale profile for "${tag}" (expected ${path.relative(REPO, file)}); ` +
      'using the generic template — add the file to describe register, punctuation and terminology';
    profile = fallbackProfile(tag, file, message);
    if (!warned.has(tag)) {
      warned.add(tag);
      process.stderr.write(`warning: ${message}\n`);
    }
  }
  cache.set(tag, profile);
  return profile;
}

/** Drop the cache; the selftest uses it after changing a profile on disk. */
export function clearProfileCache() {
  cache.clear();
  warned.clear();
}
