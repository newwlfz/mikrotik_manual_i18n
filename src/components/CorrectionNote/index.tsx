import React from 'react';

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
  label = 'Official-defect correction',
}: {
  children?: React.ReactNode;
  id?: string;
  href?: string;
  label?: string;
}) {
  if (href) {
    return (
      <a className="correctionRef" href={href} aria-label={label} title={label}>
        !
      </a>
    );
  }
  const tooltipId = id ? `${id}-tooltip` : undefined;
  return (
    <span className="correctionRef" tabIndex={0} aria-label={label} aria-describedby={tooltipId}>
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
