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
import {productNames} from './keep-english.mjs';

/**
 * Model names are data, not prose. The examples are read from configuration —
 * `config/glossary/<locale>.yml` self-mappings (`kind: model`) plus the
 * `keep_exact` / `model_prefixes` lists in `config/technical-headings.yml` —
 * so a new model is added to the policy once, never as a hardcoded prompt word.
 * The list is capped to keep the request small; it is a reminder, not a filter.
 */
const PRODUCT_EXAMPLE_CAP = 24;

export function productNameRule(locale) {
  const {exact, models, modelPrefixes} = productNames(locale);
  const examples = [...models];
  for (const [lower, canonical] of exact) {
    if (examples.length >= PRODUCT_EXAMPLE_CAP) break;
    void lower;
    if (models.has(canonical)) continue;
    if (modelPrefixes.some((prefix) => canonical.toLowerCase().startsWith(prefix))) {
      examples.push(canonical);
    }
  }
  const unique = [...new Set(examples)].slice(0, PRODUCT_EXAMPLE_CAP);
  const names = unique.length ? unique.join(', ') : 'every RouterOS hardware model in the text';
  return (
    `Model names are identifiers, not words: copy them byte for byte (${names}). ` +
    '型号逐字保留 — never translate a product/model name into the target language, ' +
    'not in a title, heading, link text or sidebar label.'
  );
}

/**
 * The locale's display name, read from `config/locale-profiles/<locale>.md`:
 * `简体中文（中国大陆）`, `繁體中文（臺灣正體）`, `English`. The `zh-Hant`
 * heading carries "臺灣正體", so the small prompts get it automatically.
 */
export function targetLanguage(locale) {
  return profileFor(locale).label;
}

/**
 * One-sentence wording reminder for the short UI prompts.
 *
 * `Client.system()` already carries the full guard and profile; these prompts
 * are also inspected on their own, so they repeat the target explicitly. Only
 * the Chinese locales get Chinese text here — English prompts stay ASCII.
 */
export function uiWordingRule(locale) {
  const script = profileFor(locale).script;
  if (script === 'Hant') {
    return 'Use Taiwan (臺灣正體) wording and characters; 禁止簡體字與大陸用詞，使用臺灣正體用字與在地用語。';
  }
  if (script === 'Hans') {
    return '使用簡體中文與大陸規範用詞，不得出現繁體字或臺灣用語。';
  }
  return '';
}

/**
 * Anchor bytes are identifiers, not words. Every prompt that echoes source text
 * carries this rule: a `{#id}` on a heading and a `#fragment` in a URL must be
 * copied byte for byte. Translating either one silently breaks internal links
 * (`{#port}` -> `{#埠}`, `](#http-methods)` -> `](#http-方法)`).
 */
export const ANCHOR_RULE =
  'Copy every `{#id}` heading anchor and every URL `#fragment` byte for byte: ' +
  'never translate, re-case, drop or invent one.';

/**
 * A link whose visible text is still the target page's English title reads as
 * untranslated even when the target page already carries a translated title.
 * The link text must follow the target page's translated title in that case,
 * keeping the English part of product/command names.
 */
export const LINK_TEXT_RULE =
  'If an inline link\'s visible text equals the target page\'s English title and ' +
  'that target page already has a translated target-language title, use that ' +
  'translated title as the link text, keeping product/command names in English ' +
  '(e.g. `Console inspect` -> `Console inspect 检查`).';

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
    `${unit}\n${productNameRule(locale)} ${ANCHOR_RULE} ${LINK_TEXT_RULE}`
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
    'Keep protocol names and technical proper nouns in English ' +
    '(RouterOS, MikroTik, OSPF, BGP, MPLS, IGMP, EXP, ROSv6/ROSv7, IPv4, VPN, CAPsMAN). ' +
    `${productNameRule(locale)} ` +
    "Translate connectives and ordinary words using this locale's documentation conventions. " +
    `${uiWordingRule(locale)} ` +
    ANCHOR_RULE
  );
}

/** One front-matter description. */
export function descriptionPrompt(locale, description) {
  return (
    `Translate this documentation description into ${targetLanguage(locale)}. ` +
    `Output only the translation: "${description}"\n${productNameRule(locale)} ${ANCHOR_RULE}`
  );
}

/**
 * One front-matter `sidebar_label`.
 *
 * The sidebar is a navigation list, so the label is shorter than a title: the
 * prompt says so, and asks for the noun phrase only. Product, protocol and
 * command names stay English for the same reason the title prompt keeps them -
 * the label has to match what the console and the manual show.
 */
export function sidebarLabelPrompt(locale, label) {
  return (
    `Translate this documentation sidebar label into ${targetLanguage(locale)}. ` +
    `Output only the label: "${label}"\n` +
    'The label is one short navigation entry: no trailing period, no quotes, ' +
    'no parentheses unless the English label has them. Keep protocol and command ' +
    'names in English (RouterOS, MikroTik, OSPF, MACsec, Dot1X, VLAN, CAPsMAN). ' +
    `${productNameRule(locale)} ` +
    `${uiWordingRule(locale)} ` +
    ANCHOR_RULE
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
3. Keep protocol names as written: CAPsMAN, MQTT, RADIUS, OpenVPN, WireGuard, IPsec, BGP, DHCPv6. ${productNameRule(locale)}
4. Keep the source line's trailing punctuation, especially a trailing colon.
5. Do not add numbering, quotation marks, Markdown or explanation.
6. Several lines may be one sentence split by the author: translate each as its own fragment without inventing context the other lines do not provide.
7. Output only ${targetLanguage(locale)} text; keep a line in English if it is a value, a keyword or a command.
8. ${ANCHOR_RULE}`;
}
