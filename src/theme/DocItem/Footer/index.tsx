import React, {type ReactNode} from 'react';
import OriginalFooter from '@theme-original/DocItem/Footer';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import SourceFooter from '@site/src/components/SourceFooter';

/**
 * Docs swizzle: the provenance block lives in the shared `SourceFooter` so the
 * docs, versioned-docs and hardware docs instances all render `source` plus
 * `captured_at`. This is a swizzle, not a replacement: the original previous/
 * next and feedback footer is rendered unchanged below it.
 */
export default function DocItemFooter(): ReactNode {
  const {metadata} = useDoc();
  const fallbackSource =
    typeof metadata.source === 'string' && /^https?:\/\//.test(metadata.source)
      ? metadata.source
      : null;
  return (
    <>
      <SourceFooter frontMatter={metadata.frontMatter} fallbackSource={fallbackSource} />
      <OriginalFooter />
    </>
  );
}
