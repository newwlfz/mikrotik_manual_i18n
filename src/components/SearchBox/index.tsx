import React, {useEffect, useRef, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

type Result = {
  data: {
    url: string;
    excerpt: string;
    meta?: {title?: string};
  };
};

export default function SearchBox() {
  const {siteConfig} = useDocusaurusContext();
  const baseUrl = siteConfig.baseUrl;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const pagefindRef = useRef<any>(null);
  const seq = useRef(0);

  async function ensurePagefind() {
    if (pagefindRef.current) return pagefindRef.current;
    try {
      // Pagefind is generated only after a production build.
      const mod = await import(/* webpackIgnore: true */ `${baseUrl}pagefind/pagefind.js`);
      await mod.init();
      await mod.options({ranking: {termSaturation: 0}});
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
      return;
    }
    const pagefind = await ensurePagefind();
    if (!pagefind || current !== seq.current) return;
    setLoading(true);
    try {
      const found = await pagefind.search(value);
      const rows: Result[] = [];
      for (const item of found.results.slice(0, 20)) {
        rows.push({data: await item.data()});
      }
      if (current === seq.current) setResults(rows);
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
    };
  }, []);

  function onChange(value: string) {
    setQuery(value);
    setOpen(true);
    window.clearTimeout((onChange as any).timer);
    (onChange as any).timer = window.setTimeout(() => void runSearch(value), 200);
  }

  const firstUrl = results[0]?.data.url;

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
          void ensurePagefind();
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && firstUrl) window.location.href = firstUrl;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((value) => Math.min(value + 1, results.length - 1));
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((value) => Math.max(value - 1, 0));
          }
        }}
        disabled={unavailable}
        title={unavailable ? 'Search index is only available in production builds' : undefined}
      />
      {open && query.trim() ? (
        <div className="site-search__panel" role="listbox">
          <div className="site-search__status">
            {loading
              ? `Searching for “${query.trim()}”…`
              : results.length === 0
                ? `No results for “${query.trim()}”`
                : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </div>
          <ul className="site-search__results">
            {results.map((result, index) => (
              <li className="site-search__result" key={result.data.url}>
                <a
                  className="site-search__result-link"
                  href={result.data.url}
                  onMouseEnter={() => setActive(index)}>
                  <span className="site-search__result-title">
                    {result.data.meta?.title ?? result.data.url}
                  </span>
                  <span
                    className="site-search__result-excerpt"
                    dangerouslySetInnerHTML={{__html: result.data.excerpt}}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
