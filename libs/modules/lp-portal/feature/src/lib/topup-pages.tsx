'use client';

import * as React from 'react';
import {
  Badge,
  MockDetailPage,
  MockFormPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';
/* ------------------------------------------------------------------ *
 * Top-up (topup)
 * Menu label: Top-up  Path: /topup
 * Page keys: list / create / detail (no edit)
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'topupNo', label: 'Top-up No.' },
  { key: 'poolId', label: 'Target Liquidity Pool' },
  { key: 'amount', label: 'Top-up Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created At' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    topupNo: 'TU-20260810-031',
    poolId: 'POOL-EU-004',
    amount: '300,000.00',
    currency: 'EUR',
    status: <Badge variant="secondary">Pending</Badge>,
    createdAt: '2026-08-10 07:45:00',
  },
  {
    topupNo: 'TU-20260809-118',
    poolId: 'POOL-HK-002',
    amount: '1,000,000.00',
    currency: 'HKD',
    status: <Badge>Completed</Badge>,
    createdAt: '2026-08-09 14:20:33',
  },
  {
    topupNo: 'TU-20260808-076',
    poolId: 'POOL-US-003',
    amount: '200,000.00',
    currency: 'USD',
    status: <Badge variant="destructive">Rejected</Badge>,
    createdAt: '2026-08-08 10:05:12',
  },
];

const detailFields: MockField[] = [
  { key: 'topupNo', label: 'Top-up No.' },
  { key: 'poolId', label: 'Target Liquidity Pool' },
  { key: 'amount', label: 'Top-up Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'source', label: 'Fund Source' },
  { key: 'status', label: 'Status' },
  { key: 'creator', label: 'Initiator' },
  { key: 'createdAt', label: 'Created At' },
];

const detailData: Record<string, React.ReactNode> = {
  topupNo: 'TU-20260810-031',
  poolId: 'POOL-EU-004',
  amount: '300,000.00',
  currency: 'EUR',
  source: 'Bank Transfer',
  status: <Badge variant="secondary">Pending</Badge>,
  creator: 'lp-ops',
  createdAt: '2026-08-10 07:45:00',
};

const formFields: MockField[] = [
  { key: 'poolId', label: 'Target Liquidity Pool', type: 'select', options: ['POOL-CN-001', 'POOL-HK-002', 'POOL-US-003', 'POOL-EU-004'] },
  { key: 'amount', label: 'Top-up Amount', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'select', options: ['CNY', 'USD', 'HKD', 'EUR'] },
  { key: 'source', label: 'Fund Source', type: 'select', options: ['Bank Transfer', 'Internal Transfer', 'Other'] },
  { key: 'remark', label: 'Remark' },
];

export function TopupListPage() {
  return (
    <MockListPage
      title="Top-up"
      description="Process liquidity pool top-up requests and arrival confirmations"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function TopupDetailPage() {
  return <MockDetailPage title="Top-up Detail" fields={detailFields} data={detailData} />;
}

export function TopupFormPage() {
  return <MockFormPage title="Initiate Top-up" fields={formFields} submitLabel="Submit" />;
}
