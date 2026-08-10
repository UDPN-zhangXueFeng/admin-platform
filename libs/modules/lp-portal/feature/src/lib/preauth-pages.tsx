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
 * 预授权管理（preauth）
 * 菜单标签：预授权管理  路径：/preauth
 * 页面键：list / create / edit / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'preauthNo', label: '预授权编号' },
  { key: 'merchant', label: '商户' },
  { key: 'amount', label: '金额' },
  { key: 'currency', label: '币种' },
  { key: 'expireAt', label: '到期时间' },
  { key: 'status', label: '状态' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    preauthNo: 'PA-20260810-001',
    merchant: '示例商户 A',
    amount: '50,000.00',
    currency: 'CNY',
    expireAt: '2026-08-15 23:59:59',
    status: <Badge>已授权</Badge>,
  },
  {
    preauthNo: 'PA-20260809-014',
    merchant: '示例商户 B',
    amount: '1,200.00',
    currency: 'USD',
    expireAt: '2026-08-12 23:59:59',
    status: <Badge variant="secondary">待审核</Badge>,
  },
  {
    preauthNo: 'PA-20260808-207',
    merchant: '示例商户 C',
    amount: '88,000.00',
    currency: 'HKD',
    expireAt: '2026-08-10 12:00:00',
    status: <Badge variant="destructive">已过期</Badge>,
  },
];

const detailFields: MockField[] = [
  { key: 'preauthNo', label: '预授权编号' },
  { key: 'merchant', label: '商户' },
  { key: 'amount', label: '金额' },
  { key: 'currency', label: '币种' },
  { key: 'poolId', label: '扣减资金池' },
  { key: 'expireAt', label: '到期时间' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '创建时间' },
];

const detailData: Record<string, React.ReactNode> = {
  preauthNo: 'PA-20260810-001',
  merchant: '示例商户 A',
  amount: '50,000.00',
  currency: 'CNY',
  poolId: 'POOL-CN-001',
  expireAt: '2026-08-15 23:59:59',
  status: <Badge>已授权</Badge>,
  createdAt: '2026-08-10 08:30:11',
};

const formFields: MockField[] = [
  { key: 'merchant', label: '商户' },
  { key: 'poolId', label: '扣减资金池', type: 'select', options: ['POOL-CN-001', 'POOL-HK-002', 'POOL-US-003'] },
  { key: 'amount', label: '金额', type: 'number' },
  { key: 'currency', label: '币种', type: 'select', options: ['CNY', 'USD', 'HKD', 'EUR'] },
  { key: 'expireAt', label: '到期时间', type: 'date' },
  { key: 'remark', label: '备注' },
];

export function PreauthListPage() {
  return (
    <MockListPage
      title="预授权管理"
      description="管理商户预授权额度、有效期与状态"
      columns={listColumns}
      rows={listRows}
    />
  );
}

export function PreauthDetailPage() {
  return (
    <MockDetailPage title="预授权详情" fields={detailFields} data={detailData} />
  );
}

export function PreauthFormPage() {
  return <MockFormPage title="预授权编辑" fields={formFields} />;
}
