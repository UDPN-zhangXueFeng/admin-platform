'use client';

import * as React from 'react';
import { Badge } from '@myorg/shared/ui';
import {
  MockDetailPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from './mock-components';

/* ------------------------------------------------------------------ *
 * 货币对与资金池（pair）
 * 菜单标签：货币对与资金池  路径：/pair
 * 页面键：list / detail （无 create / edit）
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'pairCode', label: '货币对' },
  { key: 'fromPool', label: '源资金池' },
  { key: 'toPool', label: '目标资金池' },
  { key: 'enabled', label: '是否启用' },
  { key: 'updatedAt', label: '更新时间' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    pairCode: 'CNY/USD',
    fromPool: 'POOL-CN-001',
    toPool: 'POOL-US-003',
    enabled: <Badge>启用</Badge>,
    updatedAt: '2026-08-09 18:00:00',
  },
  {
    pairCode: 'CNY/HKD',
    fromPool: 'POOL-CN-001',
    toPool: 'POOL-HK-002',
    enabled: <Badge>启用</Badge>,
    updatedAt: '2026-08-08 11:30:00',
  },
  {
    pairCode: 'USD/EUR',
    fromPool: 'POOL-US-003',
    toPool: 'POOL-EU-004',
    enabled: <Badge variant="secondary">停用</Badge>,
    updatedAt: '2026-08-05 09:10:00',
  },
];

const detailFields: MockField[] = [
  { key: 'pairCode', label: '货币对' },
  { key: 'fromPool', label: '源资金池' },
  { key: 'toPool', label: '目标资金池' },
  { key: 'enabled', label: '是否启用' },
  { key: 'minAmount', label: '最小金额' },
  { key: 'maxAmount', label: '最大金额' },
  { key: 'updatedAt', label: '更新时间' },
];

const detailData: Record<string, React.ReactNode> = {
  pairCode: 'CNY/USD',
  fromPool: 'POOL-CN-001',
  toPool: 'POOL-US-003',
  enabled: <Badge>启用</Badge>,
  minAmount: '100.00',
  maxAmount: '5,000,000.00',
  updatedAt: '2026-08-09 18:00:00',
};

export function PairListPage() {
  return (
    <MockListPage
      title="货币对与资金池"
      description="维护货币对与源/目标资金池的映射关系"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function PairDetailPage() {
  return <MockDetailPage title="货币对详情" fields={detailFields} data={detailData} />;
}
