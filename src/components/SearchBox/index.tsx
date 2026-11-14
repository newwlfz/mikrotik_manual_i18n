import React, {useEffect, useRef, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useAssetBaseUrl} from '@site/src/lib/asset-url';

type SubResult = {
  title: string;
  url: string;
};

type ResultData = {
  url: string;
  excerpt: string;
  meta?: {title?: string};
  sub_results?: SubResult[];
};

const PAGE_SIZE = 10;
const INITIAL_MAIN = 7;
const INITIAL_CLI = 3;
// The input stays instant (controlled), only the query is delayed so a burst of
// keystrokes issues one search instead of one per letter.
const SEARCH_DEBOUNCE_MS = 250;

function isCli(url: string) {
  return url.includes('/cli-reference/');
}

function displayTitle(result: ResultData) {
  return result.meta?.title ?? result.url;
}

function subResults(result: ResultData) {
  return (result.sub_results ?? [])
    .filter((sub) => sub.url !== result.url)
    .map((sub) => ({...sub, title: sub.title.replace(/\u200b/g, '').trim()}))
    .filter((sub) => sub.title)
    .slice(0, 3);
}

export default function SearchBox() {
  // Pagefind is built once at the site root and shared by every locale, so the
  // index is a static asset: it uses the locale-independent asset root, not the
  // localized `siteConfig.baseUrl` (`/…/zh-Hans/`).
  const baseUrl = useAssetBaseUrl();
  // The CLI section heading follows the UI locale. `locale` used to be a local
  // constant here; it was dropped with the baseUrl rewrite while the heading
  // still read it, so rendering a CLI result threw `locale is not defined`.
  const {i18n} = useDocusaurusContext();
  const locale = i18n?.currentLocale;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [results, setResults] = useState<ResultData[]>([]);
  const [visible, setVisible] = useState({main: INITIAL_MAIN, cli: INITIAL_CLI});
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const pagefindRef = useRef<any>(null);
  const seq = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function ensurePagefind() {
    if (pagefindRef.current) return pagefindRef.current;
    try {
      // Pagefind is generated only after a production build.
      const mod = await import(/* webpackIgnore: true */ `${baseUrl}pagefind/pagefind.js`);
      await mod.init();
      pagefindRef.current = mod;
      return mod;
    } catch (error) {
      console.warn('pagefind search unavailable:', error);
      setUnavailable(true);
      return null;
    }
  }

  async function runSearch(value: string) {
    const current = ++seq.current;
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const pagefind = await ensurePagefind();
    if (!pagefind || current !== seq.current) return;
    setLoading(true);
    try {
      const found = await pagefind.search(value);
      const rows = await Promise.all(
        found.results.map((item: {data: () => Promise<ResultData>}) => item.data()),
      );
      if (current !== seq.current) return;
      const q = value.trim().toLowerCase();
      rows.sort((a: ResultData, b: ResultData) => {
        const exactA = displayTitle(a).toLowerCase() === q ? 1 : 0;
        const exactB = displayTitle(b).toLowerCase() === q ? 1 : 0;
        return exactB - exactA;
      });
      setResults(rows);
      setVisible({main: INITIAL_MAIN, cli: INITIAL_CLI});
      setActive(0);
    } finally {
      if (current === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      // Drop a pending debounce when the navbar item unmounts.
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  function onChange(value: string) {
    setQuery(value);
    setOpen(true);
    // Invalidate whatever is in flight right away: a late result for an older
    // term must never land on top of a newer query.
    seq.current += 1;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!value.trim()) {
      // Empty input clears immediately and never issues a query.
      setResults([]);
      setLoading(false);
      setActive(0);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  const mainResults = results.filter((result) => !isCli(result.url));
  const cliResults = results.filter((result) => isCli(result.url));
  const shownMain = mainResults.slice(0, visible.main);
  const shownCli = cliResults.slice(0, visible.cli);
  const shown = [...shownMain, ...shownCli];
  const hasMore = shown.length < results.length;
  const firstUrl = shown[0]?.url;

  function more() {
    setVisible((current) => ({
      main: current.main + PAGE_SIZE,
      cli: current.cli + PAGE_SIZE,
    }));
  }

  function renderResult(result: ResultData, index: number) {
    const subs = subResults(result);
    return (
      <li className="site-search__result" key={result.url}>
        <a
          className="site-search__result-link"
          href={result.url}
          onMouseEnter={() => setActive(index)}>
          <span className="site-search__result-title">{displayTitle(result)}</span>
          <span
            className="site-search__result-excerpt"
            dangerouslySetInnerHTML={{__html: result.excerpt}}
          />
        </a>
        {subs.length ? (
          <ul className="site-search__subresults">
            {subs.map((sub) => (
              <li key={sub.url + sub.title}>
                <a className="site-search__subresult-link" href={sub.url}>
                  {sub.title}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="site-search" ref={rootRef}>
      <input
        className="site-search__input"
        type="search"
        placeholder="Search"
        aria-label="Search"
        value={query}
        onFocus={() => {
          setOpen(true);
          if (unavailable) setUnavailable(false);
          void ensurePagefind();
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && firstUrl) window.location.href = firstUrl;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((value) => Math.min(value + 1, shown.length - 1));
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((value) => Math.max(value - 1, 0));
          }
        }}
      />
      {open && query.trim() ? (
        <div className="site-search__panel" role="listbox">
          <div className="site-search__status">
            {unavailable
              ? 'Search index is unavailable in this build.'
              : loading
                ? `Searching for “${query.trim()}”…`
                : results.length === 0
                  ? `No results for “${query.trim()}”`
                  : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </div>
          <ul className="site-search__results">
            {shownMain.map((result, index) => renderResult(result, index))}
            {shownCli.length ? (
              <>
                <li className="site-search__section">
                  {locale === 'zh-Hans' ? 'CLI 参考' : 'CLI reference'}
                </li>
                {shownCli.map((result, index) =>
                  renderResult(result, shownMain.length + index),
                )}
              </>
            ) : null}
          </ul>
          {hasMore ? (
            <button type="button" className="site-search__more" onClick={more}>
              Show more results
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
