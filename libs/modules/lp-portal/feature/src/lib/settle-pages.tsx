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
 * Settlement (settle)
 * Menu label: Settlement  Path: /settle
 * Page keys: list / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'settleNo', label: 'Settlement No.' },
  { key: 'period', label: 'Settlement Period' },
  { key: 'pairCode', label: 'Currency Pair' },
  { key: 'netAmount', label: 'Net Amount' },
  { key: 'status', label: 'Status' },
  { key: 'settledAt', label: 'Settled At' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    settleNo: 'ST-202608-001',
    period: '2026-08-01 ~ 2026-08-07',
    pairCode: 'CNY/USD',
    netAmount: '¥ 1,250,000.00',
    status: <Badge>Settled</Badge>,
    settledAt: '2026-08-08 02:00:00',
  },
  {
    settleNo: 'ST-202608-002',
    period: '2026-08-01 ~ 2026-08-07',
    pairCode: 'CNY/HKD',
    netAmount: 'HK$ 480,000.00',
    status: <Badge variant="secondary">Reconciling</Badge>,
    settledAt: '-',
  },
  {
    settleNo: 'ST-202607-019',
    period: '2026-07-25 ~ 2026-07-31',
    pairCode: 'USD/EUR',
    netAmount: '€ 95,000.00',
    status: <Badge variant="destructive">Exception</Badge>,
    settledAt: '-',
  },
];

const detailFields: MockField[] = [
  { key: 'settleNo', label: 'Settlement No.' },
  { key: 'period', label: 'Settlement Period' },
  { key: 'pairCode', label: 'Currency Pair' },
  { key: 'grossAmount', label: 'Gross Amount' },
  { key: 'fee', label: 'Fee' },
  { key: 'netAmount', label: 'Net Amount' },
  { key: 'status', label: 'Status' },
  { key: 'settledAt', label: 'Settled At' },
];

const detailData: Record<string, React.ReactNode> = {
  settleNo: 'ST-202608-001',
  period: '2026-08-01 ~ 2026-08-07',
  pairCode: 'CNY/USD',
  grossAmount: '¥ 1,260,000.00',
  fee: '¥ 10,000.00',
  netAmount: '¥ 1,250,000.00',
  status: <Badge>Settled</Badge>,
  settledAt: '2026-08-08 02:00:00',
};

export function SettleListPage() {
  return (
    <MockListPage
      title="Settlement"
      description="View LP liquidity pool settlement statements and reconciliation statuses by period"
      columns={listColumns}
      rows={listRows}
      actionLabel="Export"
    />
  );
}

export function SettleDetailPage() {
  return <MockDetailPage title="Settlement Detail" fields={detailFields} data={detailData} />;
}
