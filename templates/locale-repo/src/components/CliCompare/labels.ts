/**
 * Locale-aware labels for the CLI version-compare widget.
 *
 * Source of truth: the `compare_versions` table in `config/cli-labels.yml`.
 * `labels.data.json` in this directory is that table projected onto the exact
 * keys passed to `t()`; no translated string is hand-written in TS/TSX. Each
 * locale repo ships its own JSON (zh-Hans -> Simplified, zh-Hant ->
 * Traditional); the locale-agnostic template ships `{}`, so a fresh locale
 * keeps the English keys until its table is filled.
 *
 * English is the identity mapping: an unknown key renders as the key itself,
 * which is the wording the UI used before this table existed.
 */
import labelsData from './labels.data.json';

const LABELS = labelsData as Record<string, string>;

/**
 * Both Chinese locales use the localized table. `zh`, `zh-Hans`, `zh-Hant`
 * (and underscore variants) match; `en` and every other locale fall back to
 * the English key.
 */
export function isChineseLocale(locale: string): boolean {
  return /^zh(?:[-_]|$)/i.test(locale);
}

/** `zh` keeps the boolean form used by the presentational child components. */
export function compareLabel(english: string, zh: boolean): string {
  return zh ? (LABELS[english] ?? english) : english;
}

/** `条命令` / `條命令` for Chinese; `command` / `commands` for English. */
export function commandUnitLabel(count: number, zh: boolean): string {
  if (!zh) return count === 1 ? 'command' : 'commands';
  return `${compareLabel('command measure word', zh)}${compareLabel('commands', zh)}`;
}
