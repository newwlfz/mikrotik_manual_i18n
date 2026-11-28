import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DocCardList from '@theme/DocCardList';
import ArgTable from '@site/src/components/ArgTable';
import ArgTableRow from '@site/src/components/ArgTableRow';
import WideTable from '@site/src/components/WideTable';
import CorrectionNote, {CorrectionMark} from '@site/src/components/CorrectionNote';
import Img from '@site/src/components/Img';
import Anchor from '@site/src/components/Anchor';
import CliCompare from '@site/src/components/CliCompare';
import CliReferenceLinks from '@site/src/components/CliReferenceLinks';
import {Column, Columns} from '@site/src/components/Columns';

export default {
  ...MDXComponents,
  ArgTable,
  ArgTableRow,
  WideTable,
  CorrectionNote,
  CorrectionMark,
  Img,
  Anchor,
  CliCompare,
  CliReferenceLinks,
  Columns,
  Column,
  Tabs,
  TabItem,
  DocCardList,
};
