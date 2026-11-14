import React, {type ReactNode} from 'react';
import ConsentGate from '@site/src/components/ConsentGate';

/**
 * Global application wrapper.
 *
 * `ConsentGate` lives here (not in a layout) so the first-visit notice appears
 * on every route, survives client-side navigation, and is rendered exactly once
 * per page load. The rest of the app is untouched.
 */
export default function Root({children}: {children: ReactNode}): ReactNode {
  return (
    <>
      {children}
      <ConsentGate />
    </>
  );
}
