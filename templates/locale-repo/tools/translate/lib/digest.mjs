/**
 * Hashing helpers for the files and blocks the pipeline tracks.
 *
 * `lib/legacy.mjs#digest` is a different thing: it hashes a *normalised* body
 * and truncates to 16 hex characters, because it only has to decide whether a
 * legacy page was captured from the same English body. The state file needs the
 * opposite: a stable, full-length fingerprint of the bytes on disk, so a
 * refresh can say "this source changed" without re-deriving anything, plus a
 * short per-block fingerprint that survives link-version spelling changes.
 *
 * The block helpers live here (not in `lib/refresh.mjs`) because both
 * `lib/apply.mjs` and `tools/translate/index.mjs` write these fields; putting
 * them in the refresh module would make the import graph cyclic.
 */

import crypto from 'node:crypto';
import {normalize, splitBlockSpans} from './blocks.mjs';

/** Characters of SHA-256 kept per block. 32 bits over one page's ~20 blocks. */
export const BLOCK_HASH_WIDTH = 8;

/** Full SHA-256 of a string, lowercase hex (64 characters). */
export function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text ?? '')).digest('hex');
}

/** Fingerprint of one block; `normalize` makes link/version spelling irrelevant. */
export function blockHash(block) {
  return sha256Hex(normalize(block)).slice(0, BLOCK_HASH_WIDTH);
}

/** Fingerprints of every block of a body, in order. */
export function blockHashes(body) {
  return splitBlockSpans(body).map((span) => blockHash(span.text));
}

/** The state-file representation: fixed-width fingerprints, no separators. */
export function encodeBlockHashes(hashes) {
  return (hashes || []).join('');
}

/** Split the state-file representation back into fingerprints. */
export function decodeBlockHashes(text) {
  const raw = String(text ?? '');
  const out = [];
  for (let index = 0; index + BLOCK_HASH_WIDTH <= raw.length; index += BLOCK_HASH_WIDTH) {
    out.push(raw.slice(index, index + BLOCK_HASH_WIDTH));
  }
  return out;
}
