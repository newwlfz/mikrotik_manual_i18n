import React from 'react';
import Layout from '@theme/Layout';
import CliCompare from '@site/src/components/CliCompare';

export default function CompareVersionsPage() {
  return (
    <Layout
      title="CLI Reference Version Comparison"
      description="Compare parameters between two RouterOS CLI reference versions.">
      <main className="container margin-vert--lg">
        <div className="theme-doc-markdown markdown">
          <header>
            <h1>CLI Reference Version Comparison</h1>
          </header>
          <p>
            Every RouterOS release brings a new CLI reference: commands and parameters are
            added, renamed, and removed as features evolve. Select two versions below to see
            which parameters were added and which were removed between them.
          </p>
          <CliCompare />
          <h2>How the comparison works</h2>
          <ul>
            <li>
              The data is generated from the versioned CLI reference pages in this repository
              (<code>versioned_docs/version-*/cli-reference</code>), so it reflects the
              published pages, not the RouterOS source itself.
            </li>
            <li>
              <strong>Parameters</strong> are the arguments of a command or menu, including
              read-only arguments. <strong>Flags</strong> are item properties such as{' '}
              <code>disabled</code>, <code>running</code>, and <code>invalid</code>.
            </li>
            <li>
              A command or menu is listed under <em>New commands</em> or{' '}
              <em>Removed commands</em> when the whole page is missing from the other version.
            </li>
            <li>
              Directory pages (for example <code>ip/firewall</code>) list the parameters of
              every entry of that menu, so a removed parameter there may actually have moved
              to a submenu page.
            </li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
