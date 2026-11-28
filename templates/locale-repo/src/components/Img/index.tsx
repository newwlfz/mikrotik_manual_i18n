import React from 'react';
import {assetUrl, useAssetBaseUrl} from '@site/src/lib/asset-url';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt?: string;
};

/**
 * 站内绝对路径（单个 `/` 开头）必须拼资源根，否则子路径部署（GitHub Pages
 * 的 `/mikrotik_manual_i18n/`）会把 `/img/x.webp` 解析到域名根而 404。
 *
 * 拼的是 `customFields.assetBaseUrl`（不带 locale），不是 `useBaseUrl`：后者
 * 在 zh-Hans 页面给出 `/mikrotik_manual_i18n/zh-Hans/img/...`，而
 * `tools/build/slim.mjs` 删掉了每个语种目录下的图片副本，于是客户端新建的
 * `<img>` 404。HTML 里的那份已被 slim 改回根路径，所以只有站内跳转才暴露。
 * 外链（`http(s)://`、`mailto:`、`data:`）、协议相对 `//host/...` 和相对路径
 * 原样通过；已经带资源根的路径不会重复拼接。
 */
export default function Img({src, alt = '', ...rest}: Props) {
  const base = useAssetBaseUrl();
  return <img src={assetUrl(src, base)} alt={alt} loading="lazy" {...rest} />;
}
