import React, {type ReactNode} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useAlternatePageUtils} from '@docusaurus/theme-common/internal';
import {translate} from '@docusaurus/Translate';
import {mergeSearchStrings, useHistorySelector} from '@docusaurus/theme-common';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';
import IconLanguage from '@theme/Icon/Language';
import type {Props as DropdownNavbarItemProps} from '@theme/NavbarItem/DropdownNavbarItem';
import type {LinkLikeNavbarItemProps} from '@theme/NavbarItem';
import styles from './styles.module.css';

/**
 * Navbar 语言下拉，swizzle 自 `@docusaurus/theme-classic` 3.10.1 的
 * `NavbarItem/LocaleDropdownNavbarItem`。
 *
 * 与原始实现的唯一差别：每个语言项的 `onClick` 先把目标 locale 记成**用户
 * 显式选择**，然后照常让 `<a>` 导航（不 `preventDefault`、不改 href/target/
 * lang 属性）。三个读者共享这个键：
 *   - `src/clientModules/locale-detect.js`（不再自动跳回中文）；
 *   - `docusaurus.config.ts` 的 `<head>` 首屏脚本（同上）；
 *   - `src/pages/index.tsx`（站点根 `/` 按它选择 `docs/introduction/`）。
 *
 * 为什么不用 client module 监听点击：移动端这个组件返回的是 `<li>`，外面再包
 * 一层 `<div>` 会生成 `<ul><div><li>` 的非法结构并破坏 `.menu__list > li`
 * 样式；而直接改这个组件能把 onClick 挂在真正的语言项上，语义与上游一致。
 * 代价是复制了一份上游实现，升级 Docusaurus 时需要对照上游重新同步。
 *
 * 原始实现（只读参考）：
 * node_modules/@docusaurus/theme-classic/lib/theme/NavbarItem/LocaleDropdownNavbarItem/index.js
 */

const LOCALE_COOKIE = 'docusaurus_locale';
const LOCALE_COOKIE_MAX_AGE = 31536000;

/**
 * Persist the explicit choice. `Path=/` per the site contract: the cookie is
 * read by the head script on every route (including the baseUrl root) and the
 * choice must survive a deployment under a project sub-path.
 *
 * This is called from `onClick`, i.e. before the browser starts the navigation,
 * so the destination request already carries the cookie. Middle-click /
 * Ctrl-click still record the choice; navigation stays the browser's business.
 */
function rememberLocale(locale: string): void {
  if (!locale) return;
  try {
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // Cookies can be disabled; localStorage below still carries the choice.
  }
  try {
    window.localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    // Private mode may deny localStorage; the cookie is enough.
  }
}

function useLocaleDropdownUtils() {
  const {
    siteConfig,
    i18n: {localeConfigs},
  } = useDocusaurusContext();
  const alternatePageUtils = useAlternatePageUtils();
  const search = useHistorySelector((history) => history.location.search);
  const hash = useHistorySelector((history) => history.location.hash);

  const getLocaleConfig = (locale: string) => {
    const localeConfig = localeConfigs[locale];
    if (!localeConfig) {
      throw new Error(`Docusaurus bug, no locale config found for locale=${locale}`);
    }
    return localeConfig;
  };

  const getBaseURLForLocale = (locale: string) => {
    const localeConfig = getLocaleConfig(locale);
    const isSameDomain = localeConfig.url === siteConfig.url;
    if (isSameDomain) {
      // Shorter paths if localized sites are hosted on the same domain.
      return `pathname://${alternatePageUtils.createUrl({
        locale,
        fullyQualified: false,
      })}`;
    }
    return alternatePageUtils.createUrl({locale, fullyQualified: true});
  };

  return {
    getURL: (locale: string, options: {queryString?: string}) => {
      // Two query strings: the current one and the one configured on the item.
      const finalSearch = mergeSearchStrings([search, options.queryString], 'append');
      return `${getBaseURLForLocale(locale)}${finalSearch}${hash}`;
    },
    getLabel: (locale: string) => getLocaleConfig(locale).label,
    getLang: (locale: string) => getLocaleConfig(locale).htmlLang,
  };
}

type Props = DropdownNavbarItemProps & {
  readonly mobile?: boolean;
  readonly dropdownItemsBefore: LinkLikeNavbarItemProps[];
  readonly dropdownItemsAfter: LinkLikeNavbarItemProps[];
  readonly queryString?: string;
};

export default function LocaleDropdownNavbarItem({
  mobile,
  dropdownItemsBefore,
  dropdownItemsAfter,
  queryString,
  ...props
}: Props): ReactNode {
  const utils = useLocaleDropdownUtils();
  const {
    i18n: {currentLocale, locales},
  } = useDocusaurusContext();

  const localeItems = locales.map((locale) => {
    return {
      label: utils.getLabel(locale),
      lang: utils.getLang(locale),
      to: utils.getURL(locale, {queryString}),
      target: '_self',
      autoAddBaseUrl: false,
      // The only addition to the upstream implementation.
      onClick: () => rememberLocale(locale),
      className:
        locale === currentLocale
          ? mobile
            ? 'menu__link--active'
            : 'dropdown__link--active'
          : '',
    };
  });
  const items = [...dropdownItemsBefore, ...localeItems, ...dropdownItemsAfter];

  const dropdownLabel = mobile
    ? translate({
        message: 'Languages',
        id: 'theme.navbar.mobileLanguageDropdown.label',
        description: 'The label for the mobile language switcher dropdown',
      })
    : utils.getLabel(currentLocale);

  return (
    <DropdownNavbarItem
      {...props}
      mobile={mobile}
      label={
        <>
          <IconLanguage className={styles.iconLanguage} />
          {dropdownLabel}
        </>
      }
      items={items}
    />
  );
}
