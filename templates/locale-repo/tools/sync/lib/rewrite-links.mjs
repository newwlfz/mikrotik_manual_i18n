const OFFICIAL = 'https://manual.mikrotik.com';

/**
 * Rewrite documentation links from one route prefix to another.
 *
 * `from` and `to` are site-absolute route prefixes such as `/docs/7.25/` or
 * `/docs/`. Absolute official URLs are rewritten with the same rule so that a
 * versioned snapshot keeps pointing at the matching official version.
 *
 * Only Markdown link destinations, HTML href attributes and the frontmatter
 * `source:` value are touched; prose and code examples are left alone.
 */
export function rewriteDocsLinks(text, from, to, {source = false} = {}) {
  if (from === to) return text;
  const fromAbsolute = `${OFFICIAL}${from}`;
  const toAbsolute = `${OFFICIAL}${to}`;

  const localGuard = (url) => {
    // Current -> versioned must not double-prefix already versioned links.
    if (from === '/docs/' && /^\/docs\/7\.\d+(?:\/|$)/.test(url)) return false;
    return url.startsWith(from);
  };
  const absoluteGuard = (url) => {
    if (fromAbsolute === `${OFFICIAL}/docs/` && /^https:\/\/manual\.mikrotik\.com\/docs\/7\.\d+(?:\/|$)/.test(url)) {
      return false;
    }
    return url.startsWith(fromAbsolute);
  };

  let next = text.replace(/\]\((\/docs\/[^)\s]*)\)/g, (whole, url) => {
    if (!localGuard(url)) return whole;
    return `](${to}${url.slice(from.length)})`;
  });
  next = next.replace(/\]\((https:\/\/manual\.mikrotik\.com\/docs\/[^)\s]*)\)/g, (whole, url) => {
    if (!absoluteGuard(url)) return whole;
    return `](${toAbsolute}${url.slice(fromAbsolute.length)})`;
  });
  next = next.replace(/href="(\/docs\/[^"]*)"/g, (whole, url) => {
    if (!localGuard(url)) return whole;
    return `href="${to}${url.slice(from.length)}"`;
  });
  next = next.replace(
    /href="(https:\/\/manual\.mikrotik\.com\/docs\/[^"]*)"/g,
    (whole, url) => {
      if (!absoluteGuard(url)) return whole;
      return `href="${toAbsolute}${url.slice(fromAbsolute.length)}"`;
    },
  );
  if (source) {
    next = next.replace(/^source:\s*(\S+)$/m, (whole, url) => {
      if (!absoluteGuard(url)) return whole;
      return `source: ${toAbsolute}${url.slice(fromAbsolute.length)}`;
    });
  }
  return next;
}

export function rewriteDocsTree(files, from, to) {
  let changed = 0;
  for (const file of files) {
    const source = file.read();
    const next = rewriteDocsLinks(source, from, to);
    if (next !== source) {
      file.write(next);
      changed++;
    }
  }
  return changed;
}
