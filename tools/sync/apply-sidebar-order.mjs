#!/usr/bin/env node
/**
 * No-op, kept only so `npm run sidebar:order` does not break on an old checkout.
 *
 * Sidebar order now has exactly one source: the official crawl manifest
 * (`data/manifests/docs-<v>-sidebar.json`) consumed by build-sidebars.mjs. The
 * old `specialFirst` walk floated `cli-reference/compare-versions` to the top of
 * *every* level, which disagreed with the archived official sidebars (where the
 * link sits last). That manifest and its walk have been removed; this script
 * deliberately leaves `sidebars.ts` untouched.
 *
 * The `sidebar:order` entry in package.json (root and locale template) can be
 * deleted together with this script.
 */
console.log('sidebar order is derived from the crawl manifest; apply-sidebar-order is a no-op');
