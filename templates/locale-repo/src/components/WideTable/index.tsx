import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * Wide tables use the official wrapper and toolbar:
 *
 *   <div class="wideTableInline">
 *     <div class="wideTableToolbar"><button>…</button></div>
 *     <table>…</table>
 *   </div>
 *
 * The client module (`src/clientModules/wide-table.js`) opens the table in the
 * official modal dialog; the labels travel as data attributes so the dialog can
 * be translated without duplicating strings in the client bundle.
 *
 * 这是本项目自己的组件（不是 theme-classic 的），所以文案放在组件内的
 * `COPY` 表里、按 `i18n.currentLocale` 取，en 为兜底；繁中采用台港书面语：
 * `全寬檢視表格` / `表格檢視` / `關閉`。
 */

type Copy = {
  // 工具栏按钮。
  open: string;
  // 对话框标题与关闭按钮。
  title: string;
  close: string;
};

const COPY = {
  en: {
    open: 'Open table full width',
    title: 'Table View',
    close: 'Close',
  },
  'zh-Hans': {
    open: '全宽查看表格',
    title: '表格视图',
    close: '关闭',
  },
  'zh-Hant': {
    open: '全寬檢視表格',
    title: '表格檢視',
    close: '關閉',
  },
} satisfies Record<string, Copy>;

function copyFor(locale: string | undefined): Copy {
  return (COPY as Record<string, Copy>)[locale ?? 'en'] ?? COPY.en;
}

export default function WideTable({children}: {children: React.ReactNode}) {
  const {i18n} = useDocusaurusContext();
  const copy = copyFor(i18n?.currentLocale);
  return (
    <div className="wideTableInline" data-modal-title={copy.title} data-modal-close={copy.close}>
      <div className="wideTableToolbar">
        <button type="button" aria-label={copy.open} title={copy.open}>
          {copy.open}
        </button>
      </div>
      {children}
    </div>
  );
}
