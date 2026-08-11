'use client';

import * as React from 'react';
import {
  Badge,
  MockDetailPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';
/* ------------------------------------------------------------------ *
 * Transaction Records (tx-flow)
 * Menu label: Transaction Records  Path: /tx-flow
 * Page keys: list / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'txNo', label: 'Record No.' },
  { key: 'pairCode', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'direction', label: 'Direction' },
  { key: 'poolId', label: 'Liquidity Pool' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Time' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    txNo: 'TX-20260810-0001',
    pairCode: 'CNY/USD',
    amount: '100,000.00',
    direction: 'Buy',
    poolId: 'POOL-CN-001',
    status: <Badge>Success</Badge>,
    createdAt: '2026-08-10 09:15:22',
  },
  {
    txNo: 'TX-20260810-0002',
    pairCode: 'CNY/HKD',
    amount: '50,000.00',
    direction: 'Sell',
    poolId: 'POOL-HK-002',
    status: <Badge variant="secondary">Processing</Badge>,
    createdAt: '2026-08-10 09:20:01',
  },
  {
    txNo: 'TX-20260809-0178',
    pairCode: 'USD/EUR',
    amount: '20,000.00',
    direction: 'Buy',
    poolId: 'POOL-US-003',
    status: <Badge variant="destructive">Failed</Badge>,
    createdAt: '2026-08-09 17:42:10',
  },
];

const detailFields: MockField[] = [
  { key: 'txNo', label: 'Record No.' },
  { key: 'pairCode', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'direction', label: 'Direction' },
  { key: 'poolId', label: 'Liquidity Pool' },
  { key: 'rate', label: 'Executed Rate' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Time' },
];

const detailData: Record<string, React.ReactNode> = {
  txNo: 'TX-20260810-0001',
  pairCode: 'CNY/USD',
  amount: '100,000.00',
  direction: 'Buy',
  poolId: 'POOL-CN-001',
  rate: '7.1840',
  status: <Badge>Success</Badge>,
  createdAt: '2026-08-10 09:15:22',
};

export function TxFlowListPage() {
  return (
    <MockListPage
      title="Transaction Records"
      description="Query transaction records related to LP liquidity pools"
      columns={listColumns}
      rows={listRows}
      actionLabel="Export"
    />
  );
}

export function TxFlowDetailPage() {
  return <MockDetailPage title="Transaction Record Detail" fields={detailFields} data={detailData} />;
}
