'use client';

import * as React from 'react';
import { Badge, MockListPage, type MockColumn } from '@myorg/shared/ui';
/* ------------------------------------------------------------------ *
 * Exchange Rate (rate)
 * Menu label: Exchange Rate  Path: /rate
 * Page keys: list (list only)
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'pairCode', label: 'Currency Pair' },
  { key: 'bid', label: 'Bid Price' },
  { key: 'ask', label: 'Ask Price' },
  { key: 'mid', label: 'Mid Price' },
  { key: 'source', label: 'Source' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'status', label: 'Status' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    pairCode: 'CNY/USD',
    bid: '7.1820',
    ask: '7.1860',
    mid: '7.1840',
    source: 'Reuters',
    updatedAt: '2026-08-10 09:00:00',
    status: <Badge>Active</Badge>,
  },
  {
    pairCode: 'CNY/HKD',
    bid: '0.9185',
    ask: '0.9205',
    mid: '0.9195',
    source: 'Central Bank',
    updatedAt: '2026-08-10 09:00:00',
    status: <Badge>Active</Badge>,
  },
  {
    pairCode: 'USD/EUR',
    bid: '0.9120',
    ask: '0.9140',
    mid: '0.9130',
    source: 'Reuters',
    updatedAt: '2026-08-10 08:55:00',
    status: <Badge variant="secondary">Pending</Badge>,
  },
];

export function RateListPage() {
  return (
    <MockListPage
      title="Exchange Rate"
      description="View bid/ask/mid prices and effective statuses for each currency pair"
      columns={listColumns}
      rows={listRows}
      actionLabel="Refresh"
    />
  );
}
