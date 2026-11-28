import React, {useEffect, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

const STORAGE_KEY = 'content-wide';

/**
 * UI copy keyed by the locale this deployment renders.
 *
 * A project component (not theme-classic), so the labels stay here instead of
 * `code.json`: a missing theme key would silently fall back to English on the
 * Chinese site. `en` is the fallback, so the English build keeps its wording.
 */
type Copy = {
  widen: string;
  narrow: string;
  widenTitle: string;
  narrowTitle: string;
};

const COPY = {
  en: {
    widen: 'Widen',
    narrow: 'Narrow',
    widenTitle: 'Widen content width',
    narrowTitle: 'Restore default content width',
  },
  'zh-Hans': {
    widen: '加宽',
    narrow: '收窄',
    widenTitle: '加宽内容区域',
    narrowTitle: '恢复默认内容宽度',
  },
  'zh-Hant': {
    widen: '加寬',
    narrow: '收窄',
    widenTitle: '加寬內容區域',
    narrowTitle: '恢復預設內容寬度',
  },
} satisfies Record<string, Copy>;

function copyFor(locale: string | undefined): Copy {
  return (COPY as Record<string, Copy>)[locale ?? 'en'] ?? COPY.en;
}

export default function WidthToggle() {
  const {i18n} = useDocusaurusContext();
  const copy = copyFor(i18n?.currentLocale);
  const [wide, setWide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    setWide(stored);
    document.documentElement.classList.toggle('content-wide', stored);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !wide;
    setWide(next);
    document.documentElement.classList.toggle('content-wide', next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <button
      type="button"
      className="navbar__item navbar__link"
      style={{cursor: 'pointer', background: 'none', border: 'none', font: 'inherit'}}
      onClick={toggle}
      aria-pressed={wide}
      title={wide ? copy.narrowTitle : copy.widenTitle}
      disabled={!mounted}>
      {wide ? copy.narrow : copy.widen}
    </button>
  );
}
