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
 * Pre-authorization Management (preauth)
 * Menu label: Pre-authorization Management  Path: /preauth
 * Page keys: list / create / edit / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'preauthNo', label: 'Pre-authorization No.' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'expireAt', label: 'Expiry Time' },
  { key: 'status', label: 'Status' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    preauthNo: 'PA-20260810-001',
    merchant: 'Sample Merchant A',
    amount: '50,000.00',
    currency: 'CNY',
    expireAt: '2026-08-15 23:59:59',
    status: <Badge>Authorized</Badge>,
  },
  {
    preauthNo: 'PA-20260809-014',
    merchant: 'Sample Merchant B',
    amount: '1,200.00',
    currency: 'USD',
    expireAt: '2026-08-12 23:59:59',
    status: <Badge variant="secondary">Pending Review</Badge>,
  },
  {
    preauthNo: 'PA-20260808-207',
    merchant: 'Sample Merchant C',
    amount: '88,000.00',
    currency: 'HKD',
    expireAt: '2026-08-10 12:00:00',
    status: <Badge variant="destructive">Expired</Badge>,
  },
];

const detailFields: MockField[] = [
  { key: 'preauthNo', label: 'Pre-authorization No.' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'poolId', label: 'Deducted Liquidity Pool' },
  { key: 'expireAt', label: 'Expiry Time' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created At' },
];

const detailData: Record<string, React.ReactNode> = {
  preauthNo: 'PA-20260810-001',
  merchant: 'Sample Merchant A',
  amount: '50,000.00',
  currency: 'CNY',
  poolId: 'POOL-CN-001',
  expireAt: '2026-08-15 23:59:59',
  status: <Badge>Authorized</Badge>,
  createdAt: '2026-08-10 08:30:11',
};

const formFields: MockField[] = [
  { key: 'merchant', label: 'Merchant' },
  { key: 'poolId', label: 'Deducted Liquidity Pool', type: 'select', options: ['POOL-CN-001', 'POOL-HK-002', 'POOL-US-003'] },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'select', options: ['CNY', 'USD', 'HKD', 'EUR'] },
  { key: 'expireAt', label: 'Expiry Time', type: 'date' },
  { key: 'remark', label: 'Remark' },
];

export function PreauthListPage() {
  return (
    <MockListPage
      title="Pre-authorization Management"
      description="Manage merchant pre-authorization limits, validity periods, and statuses"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function PreauthDetailPage() {
  return (
    <MockDetailPage title="Pre-authorization Detail" fields={detailFields} data={detailData} />
  );
}

export function PreauthFormPage() {
  return <MockFormPage title="Pre-authorization Edit" fields={formFields} />;
}
