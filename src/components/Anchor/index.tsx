import React from 'react';
import useBrokenLinks from '@docusaurus/useBrokenLinks';

/**
 * Invisible fragment target used by the official RouterOS pages.
 *
 * The official MDX carries `<Anchor id="shutdown" />` wherever a page links to
 * itself (`[SHUTDOWN](#shutdown)`). Docusaurus has no such component in its
 * default MDX set — the name happens to resolve to the theme's link component,
 * which then fails while rendering — so the mirror provides the real thing: an
 * empty span that only carries the id.
 *
 * Docusaurus 3.10.2 SSR fix
 * -------------------------
 * Some captured official pages (e.g. `hardware/iot-products/tg-lr-setup-guide.md`)
 * bring their own module-scope helper verbatim from the source site:
 *
 *     export const Anchor = ({id}) => {
 *       useBrokenLinks().collectAnchor(id);
 *       return;
 *     };
 *
 * The source site makes `useBrokenLinks` a global, so the bare call resolves
 * there. In this Docusaurus build the hook is only available as the
 * `@docusaurus/useBrokenLinks` module export (verified in 3.10.2:
 * `node_modules/@docusaurus/core/lib/client/exports/useBrokenLinks.js`), and a
 * bare identifier is undefined on both the server and the client. That helper
 * also shadows the MDXComponents-registered `Anchor` below, so a build of such
 * a page dies with `ReferenceError: useBrokenLinks is not defined`.
 *
 * We cannot edit captured content in this lane, so we publish the official
 * hook on `globalThis`. The module-scope helper then resolves the bare
 * identifier during SSR and hydration, and its `collectAnchor(id)` registration
 * feeds Docusaurus' broken-anchor check exactly as the source site intended.
 * Theme components import the hook directly and are unaffected; the duplicate
 * is a no-op because we never overwrite an existing global.
 */
type GlobalWithBrokenLinks = typeof globalThis & {
  useBrokenLinks?: typeof useBrokenLinks;
};

const globalScope = globalThis as GlobalWithBrokenLinks;
if (typeof globalScope.useBrokenLinks !== 'function') {
  globalScope.useBrokenLinks = useBrokenLinks;
}

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
