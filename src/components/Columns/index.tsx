import React from 'react';

export function Columns({children}: {children: React.ReactNode}) {
  return <div className="columns">{children}</div>;
}

export function Column({children}: {children: React.ReactNode}) {
  return <div className="column">{children}</div>;
}
