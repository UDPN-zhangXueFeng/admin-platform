'use client';

import * as React from 'react';
import { Badge } from '@myorg/shared/ui';
import {
  MockListPage,
  type MockColumn,
} from './mock-components';

/* ------------------------------------------------------------------ *
 * 汇率（rate）
 * 菜单标签：汇率  路径：/rate
 * 页面键：list （仅列表）
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'pairCode', label: '货币对' },
  { key: 'bid', label: '买入价' },
  { key: 'ask', label: '卖出价' },
  { key: 'mid', label: '中间价' },
  { key: 'source', label: '来源' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'status', label: '状态' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    pairCode: 'CNY/USD',
    bid: '7.1820',
    ask: '7.1860',
    mid: '7.1840',
    source: '路透',
    updatedAt: '2026-08-10 09:00:00',
    status: <Badge>生效中</Badge>,
  },
  {
    pairCode: 'CNY/HKD',
    bid: '0.9185',
    ask: '0.9205',
    mid: '0.9195',
    source: '央行',
    updatedAt: '2026-08-10 09:00:00',
    status: <Badge>生效中</Badge>,
  },
  {
    pairCode: 'USD/EUR',
    bid: '0.9120',
    ask: '0.9140',
    mid: '0.9130',
    source: '路透',
    updatedAt: '2026-08-10 08:55:00',
    status: <Badge variant="secondary">待生效</Badge>,
  },
];

export function RateListPage() {
  return (
    <MockListPage
      title="汇率"
      description="查看各货币对的买入/卖出/中间价及生效状态"
      columns={listColumns}
      rows={listRows}
      actionLabel="刷新"
    />
  );
}
