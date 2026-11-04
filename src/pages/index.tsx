import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function Home() {
  return (
    <Layout title="RouterOS Manual" description="MikroTik RouterOS manual mirror">
      <main className="container margin-vert--lg">
        <h1>RouterOS Manual</h1>
        <p>Route-spike placeholder for the mirror home page.</p>
        <p>
          <Link to="/docs/7.24/introduction">Open RouterOS 7.24 documentation</Link>
        </p>
      </main>
    </Layout>
  );
}
