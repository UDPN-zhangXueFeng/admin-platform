'use client';

import * as React from 'react';
import { Badge } from '@myorg/shared/ui';
import {
  MockDetailPage,
  MockFormPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from './mock-components';

/* ------------------------------------------------------------------ *
 * 资金池管理（pool）
 * 菜单标签：资金池管理  路径：/pool
 * 页面键：list / create / edit / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'poolId', label: '资金池编号' },
  { key: 'currency', label: '币种' },
  { key: 'balance', label: '余额' },
  { key: 'waterLevel', label: '当前水位' },
  { key: 'status', label: '状态' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    poolId: 'POOL-CN-001',
    currency: 'CNY',
    balance: '¥ 8,520,000.00',
    waterLevel: '72%',
    status: <Badge>正常</Badge>,
  },
  {
    poolId: 'POOL-HK-002',
    currency: 'HKD',
    balance: 'HK$ 2,310,500.00',
    waterLevel: '38%',
    status: <Badge variant="destructive">水位告警</Badge>,
  },
  {
    poolId: 'POOL-US-003',
    currency: 'USD',
    balance: '$ 1,749,800.00',
    waterLevel: '65%',
    status: <Badge>正常</Badge>,
  },
  {
    poolId: 'POOL-EU-004',
    currency: 'EUR',
    balance: '€ 612,300.00',
    waterLevel: '21%',
    status: <Badge variant="secondary">待补资</Badge>,
  },
];

const detailFields: MockField[] = [
  { key: 'poolId', label: '资金池编号' },
  { key: 'currency', label: '币种' },
  { key: 'balance', label: '余额' },
  { key: 'waterLevel', label: '当前水位' },
  { key: 'lowWater', label: '低水位线' },
  { key: 'highWater', label: '高水位线' },
  { key: 'status', label: '状态' },
  { key: 'updatedAt', label: '更新时间' },
];

const detailData: Record<string, React.ReactNode> = {
  poolId: 'POOL-CN-001',
  currency: 'CNY',
  balance: '¥ 8,520,000.00',
  waterLevel: '72%',
  lowWater: '30%',
  highWater: '90%',
  status: <Badge>正常</Badge>,
  updatedAt: '2026-08-10 09:12:30',
};

const formFields: MockField[] = [
  { key: 'poolId', label: '资金池编号' },
  { key: 'currency', label: '币种', type: 'select', options: ['CNY', 'USD', 'HKD', 'EUR'] },
  { key: 'lowWater', label: '低水位线 (%)', type: 'number' },
  { key: 'highWater', label: '高水位线 (%)', type: 'number' },
  { key: 'owner', label: '归属 LP' },
  { key: 'remark', label: '备注' },
];

export function PoolListPage() {
  return (
    <MockListPage
      title="资金池管理"
      description="管理各币种资金池余额、水位线与状态"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function PoolDetailPage() {
  return (
    <MockDetailPage title="资金池详情" fields={detailFields} data={detailData} />
  );
}

export function PoolFormPage() {
  return <MockFormPage title="资金池编辑" fields={formFields} />;
}
