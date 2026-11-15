import React from 'react';

type Props = {
  c1?: string;
  c2?: string;
  c3?: string;
  children?: React.ReactNode;
};

export default function ArgTable({
  c1 = 'Argument',
  c2 = 'Type',
  c3 = 'Description',
  children,
}: Props) {
  return (
    <table className="styled_table">
      <thead>
        <tr>
          <th width="20%">{c1}</th>
          <th>{c2}</th>
          <th>{c3}</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
