/**
 * Sidebar label derivation.
 *
 * Docusaurus gives `frontMatter.sidebar_label` priority over the translated
 * sidebar catalogue, so a Chinese overlay that copies the English label makes
 * the mirror show English. The English label is usually the short form of the
 * title (`Manual Network Setup` vs `Manual Network Setup (No Default
 * Configuration)`), so derive the short Chinese label from the title when the
 * English label really is a prefix of the English title.
 */

const CJK = /[\u4e00-\u9fff]/;
const TRAILING_PAREN = /[（(][^）)]*[）)]\s*$/u;

export function shortLabel(englishLabel, englishTitle, zhTitle) {
  if (!zhTitle || !englishLabel) return null;
  if (englishTitle && !englishTitle.startsWith(englishLabel)) return null;
  const stripped = zhTitle.replace(TRAILING_PAREN, '').trim();
  return stripped && stripped !== zhTitle ? stripped : null;
}

/** Explicit translation first, then the derived short form, then the title. */
export function sidebarLabelZh({englishLabel, englishTitle, zhTitle, zhLabel}) {
  if (zhLabel && CJK.test(zhLabel)) return zhLabel;
  if (!zhTitle) return null;
  return shortLabel(englishLabel, englishTitle, zhTitle) || zhTitle;
}
