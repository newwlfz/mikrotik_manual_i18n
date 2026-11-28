import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * Locale-aware fallbacks for the three column headings.
 *
 * Most localized pages pass `c1`/`c2`/`c3` explicitly, but the defaults are
 * component-owned UI copy: leaving them hard-coded in English would leak
 * English into any page that omits a prop (and into new locale repos). `en` is
 * the fallback, so the English build keeps its original wording.
 */
type Copy = {
  argument: string;
  type: string;
  description: string;
};

const COPY = {
  en: {
    argument: 'Argument',
    type: 'Type',
    description: 'Description',
  },
  'zh-Hans': {
    argument: '参数',
    type: '类型',
    description: '描述',
  },
  'zh-Hant': {
    argument: '引數',
    type: '型別',
    description: '描述',
  },
} satisfies Record<string, Copy>;

function copyFor(locale: string | undefined): Copy {
  return (COPY as Record<string, Copy>)[locale ?? 'en'] ?? COPY.en;
}

type Props = {
  c1?: string;
  c2?: string;
  c3?: string;
  children?: React.ReactNode;
};

export default function ArgTable({c1, c2, c3, children}: Props) {
  const {i18n} = useDocusaurusContext();
  const fallback = copyFor(i18n?.currentLocale);
  return (
    <table className="styled_table">
      <thead>
        <tr>
          <th width="20%">{c1 ?? fallback.argument}</th>
          <th>{c2 ?? fallback.type}</th>
          <th>{c3 ?? fallback.description}</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
