/**
 * Units the model returns unchanged, remembered outside the translation memory.
 *
 * `work/translate/model-memory.json` is ~26 MB and `translation-memory.json`
 * another ~19 MB. Committing them on every batch would grow the repository by
 * tens of megabytes per push, so the batch workflow commits only this compact
 * ledger: the *identity* subset — units whose "translation" is the English text
 * itself, because they are technical notation (identifier lists, grammar
 * fragments, numeric tables, product names) that must stay English.
 *
 * Two kinds of unit are locked here:
 *
 *   blocks  body blocks the model returned unchanged *and* that carry no
 *           translatable prose (commands, paths, parameters, links, symbols);
 *   titles  page titles that are a proper noun (`MACsec`, `VLAN`, `SXT-2`), so
 *           the model answers with the title it was given. A title that still
 *           contains an English sentence is not locked: it stays pending until
 *           it is translated, and the batch retries it once.
 *
 * Why it has to be persisted at all: without it every batch re-sends those
 * units, the model answers with the same English text, the page stays
 * `partial`, and `pending` never reaches zero — so the deploy gate would never
 * open. `planSection` skips a block or a title that is locked here exactly the
 * way it skipped identity entries from the TM; `config/force-translate.yml` and
 * the fenced-admonition exception still override a block lock.
 *
 * Block keys are `normalize()`d (see `lib/blocks.mjs`), so whitespace
 * differences do not create new entries. The file is sorted, which keeps a diff
 * readable and lets two runs merge without reordering.
 */

import fs from 'node:fs';
import path from 'node:path';
import {WORK_DIR, writeFileAtomic} from './paths.mjs';
import {normalize} from './blocks.mjs';

export const LOCKS_FILE = path.join(WORK_DIR, 'keep-english.json');
export const LOCKS_SCHEMA = 2;
/** Recorded reason for a title the model answered with the English title. */
export const TITLE_LOCK_REASON = 'model-kept-proper-noun';

/** Empty ledger shape. */
function emptyLocks() {
  return {blocks: new Set(), titles: new Set()};
}

/**
 * Read the locks; seed them from the model memory when the ledger is new.
 *
 * Seeding only happens where a full translation memory exists (the local
 * mono-workspace), and it is a one-time migration: the file written here is what
 * CI commits, so a fresh checkout never has to load the big memories to know
 * which blocks are deliberately English.
 */
export function loadLocks({seedFrom = null, warn = () => {}} = {}) {
  if (fs.existsSync(LOCKS_FILE)) {
    const raw = JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf8'));
    // Schema 1 was a plain array of blocks (and a schema-1 object with `blocks`).
    const blocks = Array.isArray(raw) ? raw : raw.blocks || [];
    const titles = Array.isArray(raw) ? [] : raw.titles || [];
    const locks = emptyLocks();
    for (const block of blocks) {
      if (typeof block === 'string' && block.trim() !== '') locks.blocks.add(normalize(block));
    }
    for (const title of titles) {
      const text = typeof title === 'string' ? title : title?.key || title?.original;
      if (typeof text === 'string' && text.trim() !== '') locks.titles.add(normalize(text));
    }
    return locks;
  }
  if (!seedFrom) return emptyLocks();
  const locks = emptyLocks();
  for (const [key, value] of seedFrom.entries()) {
    const separator = key.indexOf('\u0000');
    // `title:<english>` / `description:<english>` keys are not blocks.
    if (separator === -1) continue;
    const english = key.slice(separator + 1);
    if (normalize(value) === normalize(english)) locks.blocks.add(normalize(english));
  }
  if (locks.blocks.size > 0) {
    const file = path.relative(WORK_DIR, LOCKS_FILE);
    warn(`seeded ${locks.blocks.size} keep-English lock(s) into ${file} from the model memory`);
    saveLocks(locks);
  }
  return locks;
}

/**
 * Persist the locks.
 *
 * A `Set` of blocks is still accepted (the seeding path passes one). Blocks are
 * a sorted array of strings; titles are sorted objects carrying the key, the
 * original title and the reason it is English, so a reviewer can tell a proper
 * noun from a failed translation without opening the page.
 */
export function saveLocks(input) {
  const blocks = [...(input?.blocks ?? input ?? [])].filter((block) => typeof block === 'string');
  const titles = [...(input?.titles ?? [])].filter((title) => typeof title === 'string');
  const payload = {
    schema: LOCKS_SCHEMA,
    note:
      'Units the model returned unchanged: technical notation, grammar, identifiers and ' +
      'proper-noun titles. The planner never queues them again; config/force-translate.yml ' +
      'overrides a block lock.',
    blocks: blocks.sort(),
    titles: titles
      .map((title) => ({key: normalize(title), original: title, reason: TITLE_LOCK_REASON}))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
  writeFileAtomic(LOCKS_FILE, `${JSON.stringify(payload, null, 1)}\n`);
}
