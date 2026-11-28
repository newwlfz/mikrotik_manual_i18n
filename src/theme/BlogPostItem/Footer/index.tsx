import React, {type ReactNode} from 'react';
import OriginalFooter from '@theme-original/BlogPostItem/Footer';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import SourceFooter from '@site/src/components/SourceFooter';

/**
 * Blog-post swizzle. Both the `blog` and the `changelog` content roots are
 * blog-plugin instances, so their post pages use `BlogPostItem/Footer`, not
 * `DocItem/Footer`. Mounting the shared block here is what makes those two
 * roots show `source` and `captured_at` like the docs do.
 *
 * The stock footer is always rendered unchanged; the provenance block is only
 * added on a post's detail page (list pages render one `BlogPostItem` per post
 * and would otherwise repeat the block several times).
 */
export default function BlogPostItemFooter(): ReactNode {
  const {metadata, isBlogPostPage} = useBlogPost();
  return (
    <>
      {isBlogPostPage && <SourceFooter frontMatter={metadata.frontMatter} />}
      <OriginalFooter />
    </>
  );
}
