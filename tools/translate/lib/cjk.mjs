/**
 * One definition of "Chinese text", for counting and comparing bodies.
 *
 * The pipeline's older test was `/[\u4e00-\u9fff]/`: it covers only the main
 * BMP ideograph block, so it misses CJK Extension A (U+3400-U+4DBF), the
 * compatibility ideographs and every astral ideograph, and it says nothing
 * about punctuation. `apply` now compares how much Chinese a rebuilt page
 * carries against the overlay it would replace, and a count like that has to
 * mean "characters of Chinese text": Han characters plus the punctuation a
 * Chinese sentence actually carries (，。、《》「」【】：；！？（）). The
 * language-neutral marks (… and —) are left out: they say nothing about whether
 * a page is still Chinese.
 *
 * Fullwidth Latin letters and digits (U+FF10-U+FF19, U+FF21-U+FF3A,
 * U+FF41-U+FF5A) are deliberately excluded: they are ASCII text set wide, and a
 * page that gained a fullwidth identifier has not gained Chinese.
 *
 * The ranges are the CJK Symbols and Punctuation block, the CJK Compatibility
 * Forms block, and the punctuation/symbol part of the Halfwidth and Fullwidth
 * Forms block; `\p{Script=Han}` covers the ideographs on every plane.
 *
 * The pattern is global, but it is only ever used through `String.match`, which
 * resets `lastIndex`, so no caller can observe stale matcher state.
 */
const CJK_TEXT =
  /[\u3000-\u303f\ufe30-\ufe4f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]|\p{Script=Han}/gu;

/**
 * Number of CJK characters in `text`.
 *
 * `String.match` with a global pattern matches code points, so a newline or a
 * surrogate pair is never miscounted; a null/undefined input counts as 0, which
 * is what a missing overlay body means.
 */
export function cjkCount(text) {
  const matches = String(text ?? '').match(CJK_TEXT);
  return matches === null ? 0 : matches.length;
}

/**
 * How much of a page's Chinese a rebuild may lose before it counts as a
 * regression: 5%.
 *
 * The count is a coarse proxy for "is this page still Chinese", not proof that
 * the content is unchanged, and a wording update legitimately shrinks a
 * sentence (`已禁用` -> `禁用`, a paragraph rephrased more compactly). So the
 * rule tolerates a small trim and blocks the substantial loss: a page of 100
 * characters may come back as 95, while 94 is a regression. An English rewrite
 * of a Chinese page loses 60-98% and is always caught.
 */
export const CJK_REGRESSION_RATIO = 0.95;

/**
 * Would replacing `oldText` with `newText` lose more than the tolerated share
 * of its Chinese?
 *
 * Returns `{old, new}` when the replacement carries less than
 * `CJK_REGRESSION_RATIO` of the old CJK count, or null when it does not. An
 * absent/empty old text (`old === 0`) never counts as a loss: a new page and an
 * English page both go from 0 to 0 or more. A page that keeps its level, grows,
 * or merely gains punctuation cannot trip it either.
 */
export function cjkRegression(oldText, newText) {
  const oldCount = cjkCount(oldText);
  const newCount = cjkCount(newText);
  if (oldCount === 0) return null;
  return newCount < oldCount * CJK_REGRESSION_RATIO ? {old: oldCount, new: newCount} : null;
}
