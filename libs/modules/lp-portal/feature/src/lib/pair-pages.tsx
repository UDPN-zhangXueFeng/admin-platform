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
 * Currency Pair & Liquidity Pool (pair)
 * Menu label: Currency Pair & Liquidity Pool  Path: /pair
 * Page keys: list / detail (no create / edit)
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'pairCode', label: 'Currency Pair' },
  { key: 'fromPool', label: 'Source Liquidity Pool' },
  { key: 'toPool', label: 'Target Liquidity Pool' },
  { key: 'enabled', label: 'Enabled' },
  { key: 'updatedAt', label: 'Updated At' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    pairCode: 'CNY/USD',
    fromPool: 'POOL-CN-001',
    toPool: 'POOL-US-003',
    enabled: <Badge>Enabled</Badge>,
    updatedAt: '2026-08-09 18:00:00',
  },
  {
    pairCode: 'CNY/HKD',
    fromPool: 'POOL-CN-001',
    toPool: 'POOL-HK-002',
    enabled: <Badge>Enabled</Badge>,
    updatedAt: '2026-08-08 11:30:00',
  },
  {
    pairCode: 'USD/EUR',
    fromPool: 'POOL-US-003',
    toPool: 'POOL-EU-004',
    enabled: <Badge variant="secondary">Disabled</Badge>,
    updatedAt: '2026-08-05 09:10:00',
  },
];

const detailFields: MockField[] = [
  { key: 'pairCode', label: 'Currency Pair' },
  { key: 'fromPool', label: 'Source Liquidity Pool' },
  { key: 'toPool', label: 'Target Liquidity Pool' },
  { key: 'enabled', label: 'Enabled' },
  { key: 'minAmount', label: 'Min Amount' },
  { key: 'maxAmount', label: 'Max Amount' },
  { key: 'updatedAt', label: 'Updated At' },
];

const detailData: Record<string, React.ReactNode> = {
  pairCode: 'CNY/USD',
  fromPool: 'POOL-CN-001',
  toPool: 'POOL-US-003',
  enabled: <Badge>Enabled</Badge>,
  minAmount: '100.00',
  maxAmount: '5,000,000.00',
  updatedAt: '2026-08-09 18:00:00',
};

export function PairListPage() {
  return (
    <MockListPage
      title="Currency Pair & Liquidity Pool"
      description="Maintain mappings between currency pairs and source/target liquidity pools"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function PairDetailPage() {
  return <MockDetailPage title="Currency Pair Detail" fields={detailFields} data={detailData} />;
}
