import React from 'react';
import {useDoc, useDocsVersion} from '@docusaurus/plugin-content-docs/client';
import linksByVersion from '@site/data/manifests/cli-links.json';

type CliLink = {href: string; command: string};
type VersionLinks = Record<string, Record<string, CliLink[]>>;

export default function CliReferenceLinks() {
  const doc = useDoc();
  const {version} = useDocsVersion();
  const byVersion = linksByVersion as VersionLinks;
  const links = byVersion[version]?.[doc.metadata.id];
  if (!links?.length) return null;
  return (
    <p className="cli-reference-links">
      <span className="cli-reference-links__label">CLI reference:</span>
      {links.map((link) => (
        <a href={link.href} key={`${link.href}-${link.command}`}>
          <code>{link.command}</code>
        </a>
      ))}
    </p>
  );
}
