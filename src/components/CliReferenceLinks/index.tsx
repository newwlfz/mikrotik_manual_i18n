import React from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import linksByDoc from '@site/data/manifests/cli-links.json';

type CliLink = {href: string; command: string};

export default function CliReferenceLinks() {
  const doc = useDoc();
  const links = (linksByDoc as Record<string, CliLink[]>)[doc.metadata.id];
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
