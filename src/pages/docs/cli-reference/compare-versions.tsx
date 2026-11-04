import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

/**
 * Compatibility shim for the official comparison URL.
 *
 * Upstream hosts this page inside the current 7.26 docs. Our phase-1 build has
 * no current docs version, so the literal official URL is served by the pages
 * plugin instead. The data layer is shared with the future versioned page.
 */
export default function CompareVersionsPage() {
  return (
    <Layout
      title="CLI Reference Version Comparison"
      description="Compare parameters between RouterOS CLI reference versions">
      <main className="container margin-vert--lg">
        <h1>CLI Reference Version Comparison</h1>
        <p>
          This is the temporary pages entry for the official route{' '}
          <code>/docs/cli-reference/compare-versions/</code>. The comparison
          component and the 7.24 data model will be mounted here.
        </p>
        <p>
          <Link to="/docs/7.24/introduction">RouterOS 7.24 documentation</Link>
        </p>
      </main>
    </Layout>
  );
}
