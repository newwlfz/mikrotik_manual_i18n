/**
 * Heading-line policy for the planner.
 *
 * `verify` decides whether a heading still needs work with
 * `headingTranslationVerdict` (config/technical-headings.yml, `must_translate`
 * first, every exemption afterwards). The planner used to ask only
 * `isTranslatableProse`, which rejects *every* single-token heading — including
 * `## Configuration` and `## Overview`. That made the gate report hundreds of
 * untranslated headings while `pending --json` reported zero units.
 *
 * This module exposes the same verdict to the planner so the two sides agree.
 * It deliberately owns no word list: the data file is the single source of
 * truth, and a missing/unreadable config degrades to "no policy" (no forced
 * units) instead of throwing.
 */

import {headingTranslationVerdict} from './verify.mjs';
import {fenceMask} from './blocks.mjs';

/** Match an ATX heading line, allowing up to three leading spaces. */
const HEADING_LINE = /^(\s{0,3}#{1,6})[ \t]+(.+?)\s*$/;

/**
 * Heading text without the marker or an explicit Docusaurus anchor.
 * Returns null when `line` is not a heading line.
 */
export function headingText(line) {
  const match = HEADING_LINE.exec(String(line ?? ''));
  if (!match) return null;
  return match[2].replace(/\s*\{#[^}]*\}\s*$/, '').trim() || null;
}

/**
 * True only when a data rule explicitly forces this heading into the queue.
 *
 * `headingTranslationVerdict` returns `true` for `must_translate`, `false` for
 * an exemption and `null` when the config has no opinion. Only `true` overrides
 * `isTranslatableProse`; `false`/`null` keep the planner's original behaviour,
 * so `NAT`, `MT7621`, `ip/media` and other technical headings stay English.
 * Because the verdict checks `must_translate` before the keep-English ledger
 * and the `english-only-blocks.yml` prefixes, those exemptions cannot rescue a
 * forced title here — exactly as in `verify`.
 */
export function isMustTranslateHeading(line, options = {}) {
  const text = headingText(line);
  if (!text) return false;
  try {
    return headingTranslationVerdict(text, options) === true;
  } catch {
    // A broken config must never crash planning; fall back to no forced units.
    return false;
  }
}

/** Physical lines of `value` with their own terminator, joined losslessly. */
function physicalLines(value) {
  const raw = String(value ?? '');
  const eols = raw.match(/\r\n|\n/g) || [];
  return raw.split(/\r\n|\n/).map((text, index) => ({text, eol: index < eols.length ? eols[index] : ''}));
}

/**
 * Make every must-translate heading in a part its own translation unit.
 *
 * `planParts` keeps a whole `:::note … :::` as **one** part (see
 * `splitBlockSpans`), so a heading inside an admonition is never the part's first
 * line. Inspecting only the first line left `### Notes` / `#### Example` invisible
 * to the planner while `verify.englishHeadings` scans every line of the block and
 * kept reporting them: pending reached zero but the gate still failed. Scanning
 * all lines here gives the two sides the same scope.
 *
 * Only the heading line itself is cut out. The `:::` container, the blank lines
 * and the body stay in the neighbouring parts byte for byte, so the rest of a
 * translated admonition is never re-sent as one unit, and re-joining the parts
 * reproduces the original body exactly. Lines inside a fenced sample are skipped
 * (`fenceMask`), and every ATX level 1-6 is handled by `headingText`'s `#{1,6}`.
 */
export function splitMustTranslateHeadingParts(parts, options = {}) {
  const out = [];
  for (const part of parts) {
    if (part.kind !== 'text' || part.code) {
      out.push(part);
      continue;
    }
    const value = String(part.value ?? '');
    const lines = physicalLines(value);
    const mask = fenceMask(value);
    const cuts = lines.map((line, index) =>
      !mask[index] && isMustTranslateHeading(line.text, options) ? index : -1,
    ).filter((index) => index !== -1);
    if (cuts.length === 0) {
      out.push(part);
      continue;
    }
    const cut = new Set(cuts);
    let buffer = '';
    lines.forEach((line, index) => {
      if (cut.has(index)) {
        if (buffer !== '') out.push({...part, value: buffer});
        // The heading text alone is the unit; its line ending starts the next
        // part so the join stays byte-exact (CRLF included).
        out.push({...part, value: line.text});
        buffer = line.eol;
      } else {
        buffer += line.text + line.eol;
      }
    });
    if (buffer !== '') out.push({...part, value: buffer});
  }
  return out;
}
