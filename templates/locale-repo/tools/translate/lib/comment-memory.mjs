/**
 * Translation memory for code-fence comments.
 *
 * Kept apart from the block memory on purpose: a comment is keyed by its own
 * text and language, so editing one line of a script never invalidates the
 * paragraph before it, and re-materialising a page never invalidates a comment
 * that did not change.
 *
 * Key: `<language>\0<normalised english text>` (see `commentKey`).
 * Value: the Chinese comment text, without the leading `#` and indentation.
 */

import fs from 'node:fs';
import path from 'node:path';
import {WORK_DIR, ensureDir} from './paths.mjs';

export const COMMENT_MEMORY = path.join(WORK_DIR, 'comment-memory.json');

export function loadCommentMemory() {
  if (!fs.existsSync(COMMENT_MEMORY)) return new Map();
  const raw = JSON.parse(fs.readFileSync(COMMENT_MEMORY, 'utf8'));
  const entries = raw.entries && typeof raw.entries === 'object' ? raw.entries : raw;
  return new Map(Object.entries(entries));
}

export function saveCommentMemory(memory) {
  ensureDir(path.dirname(COMMENT_MEMORY));
  const entries = Object.fromEntries(
    [...memory.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  fs.writeFileSync(
    COMMENT_MEMORY,
    `${JSON.stringify({schema: 1, entries}, null, 1)}\n`,
  );
}
