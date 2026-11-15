import React, {useEffect, useState, type ReactNode} from 'react';
import OriginalFooter from '@theme-original/DocItem/Footer';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * Provenance block above the stock doc footer.
 *
 * 官方英文页只有 `Captured <时间>`；中文页额外有翻译时间、服务提供商和模型。
 * 为了让两种语言读起来是同一块信息，所有字段合并成**一行**：
 *
 *   采集时间 2026年1月1日 10:00 · 翻译时间 … · 服务提供商 … · 模型 …
 *   Captured Jan 1, 2026, 10:00 · Translated … · Provider … · Model …
 *
 * 每个字段仍是一个 `<span>`，整行是同一个 `[data-testid="source-footer-line"]`
 * 容器（`tools/verify/browser-check.mjs` 用它断言四者在同一行）。` · ` 分隔符
 * 单独渲染成 `aria-hidden` 的 span，读屏软件不会念成内容。
 *
 * 缺字段时只省略该字段，绝不渲染 `undefined` / `Invalid Date`。
 * 这是 swizzle，不是替换：原始页脚在下面原样渲染。
 */

type Copy = {
  source: string;
  captured: string;
  translated: string;
  provider: string;
  model: string;
  label: string;
  /** Punctuation between a field label and its value. */
  colon: string;
};

const COPY: Record<'en' | 'zh-Hans', Copy> = {
  en: {
    source: 'Official source',
    captured: 'Captured',
    translated: 'Translated',
    provider: 'Provider',
    model: 'Model',
    label: 'Source information',
    colon: ': ',
  },
  'zh-Hans': {
    source: '官方原文',
    // 与用户 #18 的用词一致：采集时间 / 翻译时间 / 服务提供商 / 模型。
    captured: '采集时间',
    translated: '翻译时间',
    provider: '服务提供商',
    model: '模型',
    label: '来源信息',
    colon: '：',
  },
};

type FrontMatter = Record<string, unknown>;

function textField(value: unknown): string | null {
  // js-yaml turns an unquoted ISO timestamp into a Date; accept it too.
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** An ISO timestamp that `new Date` can actually parse. */
function timestamp(value: string | null): string | null {
  if (!value) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function formatTimestamp(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

/**
 * The formatted time is filled in after mount: the server renders in its own
 * time zone, so formatting during SSR would hydrate to a different string.
 */
function LocalTime({value, locale, testId}: {value: string; locale: string; testId: string}): ReactNode {
  const [label, setLabel] = useState('');
  useEffect(() => {
    setLabel(formatTimestamp(value, locale));
  }, [value, locale]);
  return (
    <time data-testid={testId} dateTime={value} suppressHydrationWarning>
      {label}
    </time>
  );
}

type Field = {key: string; label: string; value: ReactNode};

export default function DocItemFooter(): ReactNode {
  const {metadata} = useDoc();
  const {i18n} = useDocusaurusContext();
  const locale = i18n.currentLocale === 'zh-Hans' ? 'zh-Hans' : 'en';
  const copy = COPY[locale];
  const frontMatter = (metadata.frontMatter || {}) as FrontMatter;

  const source = httpUrl(
    textField(frontMatter.source) ??
      (typeof metadata.source === 'string' && /^https?:\/\//.test(metadata.source) ? metadata.source : null),
  );
  const capturedAt = timestamp(textField(frontMatter.captured_at));
  const translatedAt = timestamp(textField(frontMatter.translated_at));
  const provider = textField(frontMatter.translation_provider);
  const model = textField(frontMatter.translation_model);
  const translated = locale !== 'en';

  // 字段顺序固定：采集 → 翻译 → 提供商 → 模型。英文页没有后三项时
  // 只剩 `Captured …`，与官方英文页的写法一致（标签相同、位置相同）。
  const fields: Field[] = [];
  if (capturedAt) {
    fields.push({
      key: 'captured',
      label: copy.captured,
      value: <LocalTime value={capturedAt} locale={locale} testId="source-footer-captured" />,
    });
  }
  if (translated && translatedAt) {
    fields.push({
      key: 'translated',
      label: copy.translated,
      value: <LocalTime value={translatedAt} locale={locale} testId="source-footer-translated" />,
    });
  }
  if (translated && provider) {
    fields.push({
      key: 'provider',
      label: copy.provider,
      value: <span data-testid="source-footer-provider">{provider}</span>,
    });
  }
  if (translated && model) {
    fields.push({
      key: 'model',
      label: copy.model,
      value: <span data-testid="source-footer-model">{model}</span>,
    });
  }

  const hasContent = source !== null || fields.length > 0;

  return (
    <>
      {hasContent && (
        <aside className="sourceFooter" data-testid="source-footer" aria-label={copy.label}>
          {source && (
            <div className="sourceFooterRow">
              <span className="sourceFooterLabel">{copy.source}</span>
              <span className="sourceFooterColon">{copy.colon}</span>
              <a
                className="sourceFooterLink"
                data-testid="source-footer-source"
                href={source}
                target="_blank"
                rel="noopener noreferrer">
                {source}
              </a>
            </div>
          )}
          {fields.length > 0 && (
            <div
              className="sourceFooterRow sourceFooterMeta"
              data-testid="source-footer-line"
              data-line-count={fields.length}>
              {fields.map((field, index) => (
                <React.Fragment key={field.key}>
                  {index > 0 && (
                    <span className="sourceFooterSep" aria-hidden="true">
                      {' · '}
                    </span>
                  )}
                  <span className="sourceFooterField" data-testid={`source-footer-field-${field.key}`}>
                    <span className="sourceFooterLabel" data-testid={`source-footer-label-${field.key}`}>
                      {field.label}
                    </span>
                    <span className="sourceFooterColon">
                      {copy.colon}
                    </span>
                    <span className="sourceFooterValue">{field.value}</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </aside>
      )}
      <OriginalFooter />
    </>
  );
}
