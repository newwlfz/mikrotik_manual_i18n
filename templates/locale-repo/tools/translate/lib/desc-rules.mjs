/**
 * The single definition of "this front-matter description still needs work".
 *
 * `verify` (the gate) and `index.mjs` (`pending`, the plan the gate is compared
 * with) used to answer this question with two different rules: `verify` asked
 * whether the value was blank, byte-identical or read as English prose, while
 * `pending` simply asked whether it contained no CJK character. A model-dense
 * value or an `english-only-blocks.yml` prefix could therefore be reported by
 * one and ignored by the other. Both callers now go through `descriptionVerdict`
 * below; `needsDescriptionTranslation` is the boolean projection used by the
 * planner, so the two counters cannot drift apart again.
 */

import {CJK} from './legacy.mjs';
import {normalize} from './blocks.mjs';
import {languageText} from './prose.mjs';

/** English function words; a description needs a sentence, not a bare label. */
export const ENGLISH =
  /\b(the|this|that|these|those|with|without|for|and|are|is|be|to|of|in|on|by|as|it|can|cannot|may|should|must|will|would|from|your|you|we|our|its)\b/i;
// Case-sensitive counterpart: model names ending in `-IN` are not the English
// word `in`.
const LOWER_FUNCTION =
  /\b(the|this|that|these|those|with|without|for|and|are|is|be|to|of|in|on|by|as|it|can|cannot|may|should|must|will|would|from|your|you|we|our|its)\b/;

/** True when `text` carries no Chinese and still reads as English prose. */
export function readsEnglish(text) {
  const value = String(text ?? '');
  // Labels are translated separately (`prose.mjs`): an English sentence whose
  // link labels are already Chinese is still English prose.
  if (CJK.test(languageText(value))) return false;
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat === '') return false;
  const words = flat.match(/[A-Za-z]{2,}/g) || [];
  return words.length >= 5 && ENGLISH.test(flat);
}

/**
 * A description made almost entirely of model numbers and uppercase acronyms
 * is data, not a sentence: "CRS109-8G-1S-2HnD-IN, RB5009UG+S+IN" stays English
 * on every page. The ratio test is deliberately strict and a single English
 * function word disqualifies it.
 */
export function isModelDenseEnglish(text) {
  const value = String(text ?? '');
  const tokens = value.match(/[A-Za-z0-9][A-Za-z0-9._+\/-]*/g) || [];
  if (tokens.length === 0) return false;
  const modelish = tokens.filter(
    (token) => /\d/.test(token) || /^[A-Z][A-Z0-9._+\/-]*$/.test(token),
  ).length;
  return modelish / tokens.length >= 0.5 && !LOWER_FUNCTION.test(value);
}

/**
 * Decide whether a translated `description` is missing or still English.
 *
 * `verify` used to check only that the key existed, so a description copied
 * byte for byte from the English source passed while the page's metadata was
 * still English. The reason is returned so the caller can split legal English
 * (model numbers, `english-only-blocks.yml` prefixes) into `intentionalEnglish`
 * instead of a miss.
 */
export function descriptionVerdict(source, target, englishOnly = []) {
  const src = String(source ?? '').trim();
  const dst = String(target ?? '').trim();
  if (!src) return {miss: false, reason: 'no-source'};
  const blank = dst === '';
  const identical = !blank && normalize(dst) === normalize(src);
  const english = !blank && !CJK.test(languageText(dst)) && readsEnglish(dst);
  if (!blank && !identical && !english) return {miss: false, reason: 'translated'};
  if (isModelDenseEnglish(dst)) return {miss: false, reason: 'intentional-model'};
  if (englishOnly.some((prefix) => dst.startsWith(prefix))) {
    return {miss: false, reason: 'intentional-prefix'};
  }
  return {miss: true, reason: blank ? 'blank' : identical ? 'identical' : 'english'};
}

/** Boolean projection shared by `verify` and `pending`. */
export function needsDescriptionTranslation(sourceDesc, targetDesc, englishOnly = []) {
  return descriptionVerdict(sourceDesc, targetDesc, englishOnly).miss;
}
