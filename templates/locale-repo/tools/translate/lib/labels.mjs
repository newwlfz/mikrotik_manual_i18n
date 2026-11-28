/**
 * Sidebar label derivation and planning.
 *
 * Docusaurus gives `frontMatter.sidebar_label` priority over the translated
 * sidebar catalogue, so a Chinese overlay that copies the English label makes
 * the mirror show English. The English label is usually the short form of the
 * title (`Manual Network Setup` vs `Manual Network Setup (No Default
 * Configuration)`), so derive the short Chinese label from the title when the
 * English label really is a prefix of the English title.
 *
 * `sidebar_label` is also a *translation unit* of its own (see
 * `tools/translate/index.mjs`): `needsSidebarLabelTranslation` decides which
 * labels are queued, and the answer is the same one `npm run translate:ui`
 * gives for a navbar entry, because both call `lib/ui-copy.mjs`.
 */

import {looksUntranslated} from './ui-copy.mjs';

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

/**
 * A `cli-reference/` page is a command: its label *is* the command name.
 *
 * The CLI Reference tree carries one page per RouterOS command, and the sidebar
 * shows the command (`/ip address add`). A translated command name cannot be
 * typed into the console and does not match the English manual, so those labels
 * are policy, never a pending translation — the same reasoning that makes
 * `lib/ui-copy.mjs` drop a lower-case token with no space.
 */
export function isCliReferencePage(rel) {
  return /^cli-reference\//.test(String(rel || ''));
}

/**
 * True when an overlay's `sidebar_label` still needs a translation.
 *
 * `rel` is the page path inside its section (`cli-reference/ip/address.md`), so
 * the CLI Reference exclusion follows the tree, not a list of names.
 * `whitelist` comes from `buildWhitelist(locale)`.
 */
export function needsSidebarLabelTranslation(englishLabel, {rel = '', whitelist = null} = {}) {
  const label = String(englishLabel ?? '').trim();
  if (!label) return false;
  if (isCliReferencePage(rel)) return false;
  return looksUntranslated(label, {whitelist});
}
