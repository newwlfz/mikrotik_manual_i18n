import React from 'react';
import {Redirect, useLocation} from '@docusaurus/router';

export default function DocsIndex() {
  // The docs plugin only emits `/docs/<slug>`; there is no doc with `slug: /`
  // any more (its content moved into `introduction`), so this page exists to
  // keep `/docs/` from being a 404.
  //
  // Keep the locale prefix of the current URL instead of writing `/zh-Hans`
  // out by hand: `Redirect` is plain react-router and has no locale handling,
  // so a literal `/docs/introduction` would send zh-Hans visitors to the
  // English tree. `/zh-Hans/docs/` therefore redirects to
  // `/zh-Hans/docs/introduction` and `/docs/` to `/docs/introduction`.
  const {pathname} = useLocation();
  const localePrefix = pathname.replace(/\/docs\/?$/, '');
  return <Redirect to={`${localePrefix}/docs/introduction`} />;
}
