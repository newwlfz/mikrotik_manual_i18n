import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useThemeConfig, type NavbarLogo} from '@docusaurus/theme-common';
import ThemedImage from '@theme/ThemedImage';
import {assetUrlFromRoot, useAssetBaseUrl} from '@site/src/lib/asset-url';

/**
 * Navbar Logo, swizzled from `@docusaurus/theme-classic`'s `Logo`.
 *
 * The only change: the image sources are resolved against
 * `customFields.assetBaseUrl` (the locale-independent asset root) instead of
 * `useBaseUrl`, which on a zh-Hans page prefixes `/zh-Hans/` and points at the
 * per-locale copy `tools/build/slim.mjs` deletes. The wrapping `<Link>` is a
 * route, so it keeps `useBaseUrl`.
 */
function LogoThemedImage({
  logo,
  alt,
  imageClassName,
  assetBase,
}: {
  logo: NavbarLogo;
  alt: string;
  imageClassName?: string;
  assetBase: string;
}) {
  const sources = {
    light: assetUrlFromRoot(logo.src, assetBase),
    dark: assetUrlFromRoot(logo.srcDark || logo.src, assetBase),
  };
  const themedImage = (
    <ThemedImage
      className={logo.className}
      sources={sources}
      height={logo.height}
      width={logo.width}
      alt={alt}
      style={logo.style}
    />
  );

  // Is this extra div really necessary?
  // introduced in https://github.com/facebook/docusaurus/pull/5666
  return imageClassName ? (
    <div className={imageClassName}>{themedImage}</div>
  ) : (
    themedImage
  );
}

type Props = {
  imageClassName?: string;
  titleClassName?: string;
  className?: string;
};

export default function Logo(props: Props): ReactNode {
  const {
    siteConfig: {title},
  } = useDocusaurusContext();
  const assetBase = useAssetBaseUrl();
  const {
    navbar: {title: navbarTitle, logo},
  } = useThemeConfig();

  const {imageClassName, titleClassName, ...propsRest} = props;
  const logoLink = useBaseUrl(logo?.href || '/');

  // If visible title is shown, fallback alt text should be
  // an empty string to mark the logo as decorative.
  const fallbackAlt = navbarTitle ? '' : title;

  // Use logo alt text if provided (including empty string),
  // and provide a sensible fallback otherwise.
  const alt = logo?.alt ?? fallbackAlt;

  return (
    <Link
      to={logoLink}
      {...propsRest}
      {...(logo?.target && {target: logo.target})}>
      {logo && (
        <LogoThemedImage
          logo={logo}
          alt={alt}
          imageClassName={imageClassName}
          assetBase={assetBase}
        />
      )}
      {navbarTitle != null && <b className={titleClassName}>{navbarTitle}</b>}
    </Link>
  );
}
