import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * UI copy keyed by the locale this deployment renders.
 *
 * The mandatory marker is a component-owned label (not translated Markdown),
 * so it lives here instead of `code.json`: a missing theme key would silently
 * fall back to English on the Chinese site. `en` is the fallback; the marker is
 * `（必填）` in both Chinese locales (台港书面语 uses full-width parentheses).
 */
type Copy = {
  mandatory: string;
};

const COPY = {
  en: {
    mandatory: ' ( mandatory )',
  },
  'zh-Hans': {
    mandatory: '（必填）',
  },
  'zh-Hant': {
    mandatory: '（必填）',
  },
} satisfies Record<string, Copy>;

function copyFor(locale: string | undefined): Copy {
  return (COPY as Record<string, Copy>)[locale ?? 'en'] ?? COPY.en;
}

type Props = {
  arg?: string;
  typ?: string;
  mandatory?: string | boolean;
  children?: React.ReactNode;
};

export default function ArgTableRow({
  arg,
  typ,
  mandatory,
  children,
}: Props) {
  const {i18n} = useDocusaurusContext();
  const copy = copyFor(i18n?.currentLocale);
  const required = mandatory === true || mandatory === '1' || mandatory === 'true';
  return (
    <tr>
      <td id={arg}>
        <var style={{color: '#128b67ff'}}>
          <b>{arg}</b>
        </var>
        {required ? (
          <span style={{color: '#cf9f02'}}>{copy.mandatory}</span>
        ) : null}
      </td>
      <td>
        <em>{typ}</em>
      </td>
      <td>{children}</td>
    </tr>
  );
}
