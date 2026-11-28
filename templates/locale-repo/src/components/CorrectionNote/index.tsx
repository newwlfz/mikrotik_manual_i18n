import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * UI copy keyed by the locale this deployment renders.
 *
 * The marker's `aria-label`/`title` is component-owned UI copy (not translated
 * Markdown), so it lives here instead of `code.json`: a missing theme key would
 * silently fall back to English on the Chinese site. `en` is the fallback.
 */
type Copy = {
  correction: string;
};

const COPY = {
  en: {
    correction: 'Official-defect correction',
  },
  'zh-Hans': {
    correction: '官方缺陷勘误',
  },
  'zh-Hant': {
    correction: '官方缺陷勘誤',
  },
} satisfies Record<string, Copy>;

function copyFor(locale: string | undefined): Copy {
  return (COPY as Record<string, Copy>)[locale ?? 'en'] ?? COPY.en;
}

/**
 * Inline marker for an official-defect correction.
 *
 * Short note: the marker owns a tooltip.
 * Long note: use `href` to point at a page-level <CorrectionNote id="...">,
 * so the page stays readable and the marker still has a hover target.
 */
export function CorrectionMark({
  children,
  id,
  href,
  label,
}: {
  children?: React.ReactNode;
  id?: string;
  href?: string;
  label?: string;
}) {
  const {i18n} = useDocusaurusContext();
  const copy = copyFor(i18n?.currentLocale);
  const resolvedLabel = label ?? copy.correction;
  if (href) {
    return (
      <a className="correctionRef" href={href} aria-label={resolvedLabel} title={resolvedLabel}>
        !
      </a>
    );
  }
  const tooltipId = id ? `${id}-tooltip` : undefined;
  return (
    <span className="correctionRef" tabIndex={0} aria-label={resolvedLabel} aria-describedby={tooltipId}>
      <span aria-hidden="true">!</span>
      <span className="correctionTooltip" id={tooltipId} role="tooltip">
        {children}
      </span>
    </span>
  );
}

/**
 * Page-level note for a correction whose text is too long for a tooltip.
 * Pair it with <CorrectionMark href="#the-note-id">.
 */
export default function CorrectionNote({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <aside className="correctionNote" id={id} role="note">
      <span className="correctionNoteMark" aria-hidden="true">
        !
      </span>
      <span className="correctionNoteText">{children}</span>
    </aside>
  );
}
