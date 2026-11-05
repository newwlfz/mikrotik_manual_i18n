import React from 'react';
import {Redirect} from '@docusaurus/router';

export default function Home() {
  // The docs plugin serves the current version at /docs. Never hard-code a
  // version number here: current follows the versioned content workflow.
  return <Redirect to="/docs/introduction" />;
}
