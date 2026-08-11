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
 * Liquidity Pool Management (pool)
 * Menu label: Liquidity Pool Management  Path: /pool
 * Page keys: list / create / edit / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'poolId', label: 'Pool ID' },
  { key: 'currency', label: 'Currency' },
  { key: 'balance', label: 'Balance' },
  { key: 'waterLevel', label: 'Current Water Level' },
  { key: 'status', label: 'Status' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    poolId: 'POOL-CN-001',
    currency: 'CNY',
    balance: '¥ 8,520,000.00',
    waterLevel: '72%',
    status: <Badge>Normal</Badge>,
  },
  {
    poolId: 'POOL-HK-002',
    currency: 'HKD',
    balance: 'HK$ 2,310,500.00',
    waterLevel: '38%',
    status: <Badge variant="destructive">Water Level Alert</Badge>,
  },
  {
    poolId: 'POOL-US-003',
    currency: 'USD',
    balance: '$ 1,749,800.00',
    waterLevel: '65%',
    status: <Badge>Normal</Badge>,
  },
  {
    poolId: 'POOL-EU-004',
    currency: 'EUR',
    balance: '€ 612,300.00',
    waterLevel: '21%',
    status: <Badge variant="secondary">Pending Top-up</Badge>,
  },
];

const detailFields: MockField[] = [
  { key: 'poolId', label: 'Pool ID' },
  { key: 'currency', label: 'Currency' },
  { key: 'balance', label: 'Balance' },
  { key: 'waterLevel', label: 'Current Water Level' },
  { key: 'lowWater', label: 'Low Water Mark' },
  { key: 'highWater', label: 'High Water Mark' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Updated At' },
];

const detailData: Record<string, React.ReactNode> = {
  poolId: 'POOL-CN-001',
  currency: 'CNY',
  balance: '¥ 8,520,000.00',
  waterLevel: '72%',
  lowWater: '30%',
  highWater: '90%',
  status: <Badge>Normal</Badge>,
  updatedAt: '2026-08-10 09:12:30',
};

const formFields: MockField[] = [
  { key: 'poolId', label: 'Pool ID' },
  { key: 'currency', label: 'Currency', type: 'select', options: ['CNY', 'USD', 'HKD', 'EUR'] },
  { key: 'lowWater', label: 'Low Water Mark (%)', type: 'number' },
  { key: 'highWater', label: 'High Water Mark (%)', type: 'number' },
  { key: 'owner', label: 'Owner LP' },
  { key: 'remark', label: 'Remark' },
];

export function PoolListPage() {
  return (
    <MockListPage
      title="Liquidity Pool Management"
      description="Manage balances, water marks, and statuses of liquidity pools by currency"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function PoolDetailPage() {
  return (
    <MockDetailPage title="Liquidity Pool Detail" fields={detailFields} data={detailData} />
  );
}

export function PoolFormPage() {
  return <MockFormPage title="Liquidity Pool Edit" fields={formFields} />;
}
