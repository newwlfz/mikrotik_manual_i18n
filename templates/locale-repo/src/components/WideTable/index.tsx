import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * Wide tables use the official wrapper and toolbar:
 *
 *   <div class="wideTableInline">
 *     <div class="wideTableToolbar"><button>Open table full width</button></div>
 *     <table>…</table>
 *   </div>
 *
 * The client module (`src/clientModules/wide-table.js`) opens the table in the
 * official modal dialog; the labels travel as data attributes so the dialog can
 * be translated without duplicating strings in the client bundle.
 *
 * 这是本项目自己的组件（不是 theme-classic 的），所以文案放在组件内的
 * `COPY` 表里、按 `i18n.currentLocale` 取，不绕 `code.json`——最短实现，
 * 也避免中文站因为缺翻译键回落到英文。用户 #14 要求中文
 * `全宽查看表格` / `关闭`，英文页保持 `Open table full width` / `Close`。
 */

type Copy = {
  // 工具栏按钮。
  open: string;
  // 对话框标题与关闭按钮。
  title: string;
  close: string;
};

const COPY: Record<'en' | 'zh-Hans', Copy> = {
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
};

export default function WideTable({children}: {children: React.ReactNode}) {
  const {i18n} = useDocusaurusContext();
  const copy = COPY[i18n.currentLocale === 'zh-Hans' ? 'zh-Hans' : 'en'];
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
