import React from 'react';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt?: string;
};

export default function Img({src, alt = '', ...rest}: Props) {
  return <img src={src} alt={alt} loading="lazy" {...rest} />;
}
