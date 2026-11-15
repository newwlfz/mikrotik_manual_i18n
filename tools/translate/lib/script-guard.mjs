/**
 * The retry/record policy around `lib/script-check.mjs`.
 *
 * A block that comes back in the wrong script is not silently accepted: the
 * pipeline asks once more, quoting the offending forms, and only then keeps the
 * answer — recording a `script_warning` so the batch report (and the CI job
 * summary) names it. The check itself needs no model; this module owns the one
 * extra request and the decision about what to write when the retry is also
 * wrong or structurally unusable.
 *
 * `rewrite(value)` is the caller's chance to restore the structure it owns:
 * fences are copied from the English source, an admonition container is
 * rebuilt, a comment array is re-parsed. It returns the value to write, or
 * `null` when the retry cannot be used — in which case the first translation is
 * kept and the warning is still recorded.
 */

import {checkScript, feedbackFor} from './script-check.mjs';

/**
 * Validate, retry once with feedback, record what is still wrong.
 *
 * Returns `{text, issues, retried}`: `text` is always something the caller can
 * write, `issues` is what is still wrong with it (empty on success) and
 * `retried` says whether a second request was sent.
 */
export async function guardScript({
  client,
  text,
  locale,
  file = null,
  kind = 'block',
  rewrite = null,
  record = null,
}) {
  const issues = checkScript(text, locale).issues;
  if (!issues.length) return {text, issues: [], retried: false};

  const instruction = feedbackFor(locale, issues);
  const raw = await client.chat(
    `${instruction}\n\nRewrite the translation below. Keep its Markdown structure, code, links and ` +
      `anchors unchanged, and output only the corrected translation:\n\n${text}`,
  );

  const candidate = rewrite ? rewrite(raw) : raw;
  if (candidate && String(candidate).trim()) {
    const remaining = checkScript(candidate, locale).issues;
    if (!remaining.length) return {text: candidate, issues: [], retried: true};
    record?.({file, kind, issues: remaining, text: candidate});
    return {text: candidate, issues: remaining, retried: true};
  }

  record?.({file, kind, issues, text});
  return {text, issues, retried: true};
}
