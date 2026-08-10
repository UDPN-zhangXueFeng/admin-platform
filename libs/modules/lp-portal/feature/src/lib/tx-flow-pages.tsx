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
 * 交易流水（tx-flow）
 * 菜单标签：交易流水  路径：/tx-flow
 * 页面键：list / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'txNo', label: '流水号' },
  { key: 'pairCode', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'direction', label: '方向' },
  { key: 'poolId', label: '资金池' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '时间' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    txNo: 'TX-20260810-0001',
    pairCode: 'CNY/USD',
    amount: '100,000.00',
    direction: '买入',
    poolId: 'POOL-CN-001',
    status: <Badge>成功</Badge>,
    createdAt: '2026-08-10 09:15:22',
  },
  {
    txNo: 'TX-20260810-0002',
    pairCode: 'CNY/HKD',
    amount: '50,000.00',
    direction: '卖出',
    poolId: 'POOL-HK-002',
    status: <Badge variant="secondary">处理中</Badge>,
    createdAt: '2026-08-10 09:20:01',
  },
  {
    txNo: 'TX-20260809-0178',
    pairCode: 'USD/EUR',
    amount: '20,000.00',
    direction: '买入',
    poolId: 'POOL-US-003',
    status: <Badge variant="destructive">失败</Badge>,
    createdAt: '2026-08-09 17:42:10',
  },
];

const detailFields: MockField[] = [
  { key: 'txNo', label: '流水号' },
  { key: 'pairCode', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'direction', label: '方向' },
  { key: 'poolId', label: '资金池' },
  { key: 'rate', label: '成交汇率' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '时间' },
];

const detailData: Record<string, React.ReactNode> = {
  txNo: 'TX-20260810-0001',
  pairCode: 'CNY/USD',
  amount: '100,000.00',
  direction: '买入',
  poolId: 'POOL-CN-001',
  rate: '7.1840',
  status: <Badge>成功</Badge>,
  createdAt: '2026-08-10 09:15:22',
};

export function TxFlowListPage() {
  return (
    <MockListPage
      title="交易流水"
      description="查询 LP 资金池相关的交易流水记录"
      columns={listColumns}
      rows={listRows}
      actionLabel="导出"
    />
  );
}

export function TxFlowDetailPage() {
  return <MockDetailPage title="交易流水详情" fields={detailFields} data={detailData} />;
}
