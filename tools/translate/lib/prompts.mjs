/**
 * The small prompts the pipeline sends outside the block contract.
 *
 * They used to name "Simplified Chinese" in their text, independently of each
 * other, so a new locale would have been translated correctly by the block
 * prompt and wrongly by the title/description/comment prompts. They all read
 * the locale profile now (`lib/locale-profile.mjs`): the target language comes
 * from the profile label, and the wording hints come from the profile's
 * `preferred terms`, which `Client.system()` always appends.
 *
 * The call sites keep passing `client.chat(prompt)`; the per-locale style and
 * terminology are in the system prompt, not duplicated here.
 */

import {profileFor} from './locale-profile.mjs';

/** The locale's display name (`简体中文（中国大陆）`, `繁體中文（臺灣正體）`, `English`). */
export function targetLanguage(locale) {
  return profileFor(locale).label;
}

/**
 * Retry of one paragraph that came back unusable.
 *
 * The block prompt already carries the rules; this one adds what the first
 * answer got wrong: output the translation and do not repeat the English.
 */
export function paragraphRetryPrompt(locale, unit) {
  return (
    `Translate this documentation paragraph into ${targetLanguage(locale)}. ` +
    'Output only the translation, with no explanation, no notes, and without repeating the English: ' +
    unit
  );
}

/**
 * One page title.
 *
 * Product and protocol names stay English; connectives and ordinary words are
 * translated following the locale profile (`and` → `和`, `Proxy` → `代理` for
 * Simplified Chinese, `與` for Traditional Chinese, …).
 */
export function titlePrompt(locale, title) {
  return (
    `Translate this page title into ${targetLanguage(locale)}. Output only the title: "${title}"\n` +
    'Keep product names, protocol names and technical proper nouns in English ' +
    '(RouterOS, MikroTik, OSPF, BGP, MPLS, IGMP, EXP, ROSv6/ROSv7, IPv4, VPN, CAPsMAN). ' +
    "Translate connectives and ordinary words using this locale's documentation conventions."
  );
}

/** One front-matter description. */
export function descriptionPrompt(locale, description) {
  return (
    `Translate this documentation description into ${targetLanguage(locale)}. ` +
    `Output only the translation: "${description}"`
  );
}

/**
 * The rules for the code-comment batch.
 *
 * Appended to the system prompt, after the generic contract and the profile, so
 * the comment path gets the same locale wording as every other request. The
 * JSON envelope stays because the caller matches answers by index.
 */
export function commentRules(locale) {
  return `Comments inside code examples.

The input is a JSON array of comment lines, in page order. Return ONLY a JSON array of the same length, with the translation of each line at the same index.

Rules, in order of importance:
1. One output string per input string. Never merge two lines or split one line.
2. Never translate identifiers: RouterOS commands and menu paths, parameter and property names, enum values, IP and MAC addresses, version numbers, file names, URLs, e-mail addresses, and quoted strings that are values rather than prose.
3. Keep product and protocol names as written: RouterOS, MikroTik, CAPsMAN, MQTT, RADIUS, OpenVPN, WireGuard, IPsec, BGP, DHCPv6.
4. Keep the source line's trailing punctuation, especially a trailing colon.
5. Do not add numbering, quotation marks, Markdown or explanation.
6. Several lines may be one sentence split by the author: translate each as its own fragment without inventing context the other lines do not provide.
7. Output only ${targetLanguage(locale)} text; keep a line in English if it is a value, a keyword or a command.`;
}
