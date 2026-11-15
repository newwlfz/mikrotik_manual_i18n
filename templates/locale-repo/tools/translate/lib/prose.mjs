/**
 * What counts as the *language* of a Markdown block.
 *
 * Link labels are translated by `rewriteLinks` on every rebuild, independently
 * of the prose around them: an English paragraph that points at a page whose
 * Chinese title is known gets a Chinese label (`[Storage](…)` → `[存储](…)`)
 * while the sentence itself stays English. Every "is this already Chinese?"
 * test used to look at the whole block, so those labels made the paragraph look
 * translated. The warning in `storage/ramdisk` stayed English in all three
 * trees for exactly that reason: its two prose paragraphs carried `[存储]` and
 * `[软件包]`, the block tested as Chinese, the queue never sent it and `verify`
 * never counted it.
 *
 * `languageText` removes link labels (not URLs) before the CJK test, so the
 * decision is made on the words that the translator is responsible for:
 *
 *   - `Ramdisks need the (see [存储](…)). …` → still English → translate;
 *   - `如需用作块设备的 RAM，请使用 [Ramdisk](…)。` → still Chinese → keep.
 *
 * Only inline links are masked. An image's alt text is prose too, and a plain
 * Chinese link label with no sentence around it is not prose at all, which the
 * callers' word-count check already rejects.
 */

const LINK = /!?\[([^\]]*)\]\([^)]*\)/g;

/** Markdown with link/image labels removed, keeping every other word. */
export function languageText(text) {
  return String(text ?? '').replace(LINK, (whole, label) => {
    // An image (`![alt](…)`) keeps its alt text: it is the picture's caption and
    // is translated like prose. Only a link's clickable label is masked.
    return whole.startsWith('!') ? `![${label}]()` : '[]()';
  });
}
