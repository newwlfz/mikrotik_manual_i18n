import React from 'react';

type Props = {
  arg?: string;
  typ?: string;
  mandatory?: string | boolean;
  children?: React.ReactNode;
};

export default function ArgTableRow({
  arg,
  typ,
  mandatory,
  children,
}: Props) {
  const required = mandatory === true || mandatory === '1' || mandatory === 'true';
  return (
    <tr>
      <td id={arg}>
        <var style={{color: '#128b67ff'}}>
          <b>{arg}</b>
        </var>
        {required ? (
          <span style={{color: '#cf9f02'}}> ( mandatory )</span>
        ) : null}
      </td>
      <td>
        <em>{typ}</em>
      </td>
      <td>{children}</td>
    </tr>
  );
}
