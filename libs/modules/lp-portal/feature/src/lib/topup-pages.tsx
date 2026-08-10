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
 * 补资（topup）
 * 菜单标签：补资  路径：/topup
 * 页面键：list / create / detail （无 edit）
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'topupNo', label: '补资单号' },
  { key: 'poolId', label: '目标资金池' },
  { key: 'amount', label: '补资金额' },
  { key: 'currency', label: '币种' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '创建时间' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    topupNo: 'TU-20260810-031',
    poolId: 'POOL-EU-004',
    amount: '300,000.00',
    currency: 'EUR',
    status: <Badge variant="secondary">待处理</Badge>,
    createdAt: '2026-08-10 07:45:00',
  },
  {
    topupNo: 'TU-20260809-118',
    poolId: 'POOL-HK-002',
    amount: '1,000,000.00',
    currency: 'HKD',
    status: <Badge>已完成</Badge>,
    createdAt: '2026-08-09 14:20:33',
  },
  {
    topupNo: 'TU-20260808-076',
    poolId: 'POOL-US-003',
    amount: '200,000.00',
    currency: 'USD',
    status: <Badge variant="destructive">已驳回</Badge>,
    createdAt: '2026-08-08 10:05:12',
  },
];

const detailFields: MockField[] = [
  { key: 'topupNo', label: '补资单号' },
  { key: 'poolId', label: '目标资金池' },
  { key: 'amount', label: '补资金额' },
  { key: 'currency', label: '币种' },
  { key: 'source', label: '资金来源' },
  { key: 'status', label: '状态' },
  { key: 'creator', label: '发起人' },
  { key: 'createdAt', label: '创建时间' },
];

const detailData: Record<string, React.ReactNode> = {
  topupNo: 'TU-20260810-031',
  poolId: 'POOL-EU-004',
  amount: '300,000.00',
  currency: 'EUR',
  source: '银行汇款',
  status: <Badge variant="secondary">待处理</Badge>,
  creator: 'lp-ops',
  createdAt: '2026-08-10 07:45:00',
};

const formFields: MockField[] = [
  { key: 'poolId', label: '目标资金池', type: 'select', options: ['POOL-CN-001', 'POOL-HK-002', 'POOL-US-003', 'POOL-EU-004'] },
  { key: 'amount', label: '补资金额', type: 'number' },
  { key: 'currency', label: '币种', type: 'select', options: ['CNY', 'USD', 'HKD', 'EUR'] },
  { key: 'source', label: '资金来源', type: 'select', options: ['银行汇款', '内部调拨', '其它'] },
  { key: 'remark', label: '备注' },
];

export function TopupListPage() {
  return (
    <MockListPage
      title="补资"
      description="处理资金池补资申请与到账确认"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function TopupDetailPage() {
  return <MockDetailPage title="补资详情" fields={detailFields} data={detailData} />;
}

export function TopupFormPage() {
  return <MockFormPage title="发起补资" fields={formFields} submitLabel="提交" />;
}
