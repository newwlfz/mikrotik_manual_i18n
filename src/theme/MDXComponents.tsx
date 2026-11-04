import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DocCardList from '@theme/DocCardList';
import ArgTable from '@site/src/components/ArgTable';
import ArgTableRow from '@site/src/components/ArgTableRow';
import WideTable from '@site/src/components/WideTable';
import Img from '@site/src/components/Img';
import {Column, Columns} from '@site/src/components/Columns';

export default {
  ...MDXComponents,
  ArgTable,
  ArgTableRow,
  WideTable,
  Img,
  Columns,
  Column,
  Tabs,
  TabItem,
  DocCardList,
};
