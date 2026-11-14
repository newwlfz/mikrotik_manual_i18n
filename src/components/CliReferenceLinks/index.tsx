import React from 'react';
import {useDoc, useDocsVersion} from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import linksByVersion from '@site/data/manifests/cli-links.json';

type CliLink = {href: string; command: string};
type VersionLinks = Record<string, Record<string, CliLink[]>>;

export default function CliReferenceLinks() {
  const doc = useDoc();
  const {version} = useDocsVersion();
  const {i18n} = useDocusaurusContext();
  const byVersion = linksByVersion as VersionLinks;
  const links = byVersion[version]?.[doc.metadata.id];
  if (!links?.length) return null;
  // The label sits directly under every doc title, so it follows the page
  // locale. Chinese uses the full-width colon used by the rest of the UI.
  const label = i18n.currentLocale === 'zh-Hans' ? 'CLI 参考：' : 'CLI reference:';
  return (
    <p className="cli-reference-links">
      <span className="cli-reference-links__label">{label}</span>
      {links.map((link) => (
        <a href={link.href} key={`${link.href}-${link.command}`}>
          <code>{link.command}</code>
        </a>
      ))}
    </p>
  );
}
