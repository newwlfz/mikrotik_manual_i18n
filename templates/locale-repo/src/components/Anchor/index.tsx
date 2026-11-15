import React from 'react';

/**
 * Invisible fragment target used by the official RouterOS pages.
 *
 * The official MDX carries `<Anchor id="shutdown" />` wherever a page links to
 * itself (`[SHUTDOWN](#shutdown)`). Docusaurus has no such component in its
 * default MDX set — the name happens to resolve to the theme's link component,
 * which then fails while rendering — so the mirror provides the real thing: an
 * empty span that only carries the id.
 */
export default function Anchor({
  id,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span id={id} {...rest}>
      {children}
    </span>
  );
}
