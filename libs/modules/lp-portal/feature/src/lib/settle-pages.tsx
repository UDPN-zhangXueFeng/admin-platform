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
 * 结算（settle）
 * 菜单标签：结算  路径：/settle
 * 页面键：list / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'settleNo', label: '结算单号' },
  { key: 'period', label: '结算周期' },
  { key: 'pairCode', label: '货币对' },
  { key: 'netAmount', label: '净额' },
  { key: 'status', label: '状态' },
  { key: 'settledAt', label: '结算时间' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    settleNo: 'ST-202608-001',
    period: '2026-08-01 ~ 2026-08-07',
    pairCode: 'CNY/USD',
    netAmount: '¥ 1,250,000.00',
    status: <Badge>已结算</Badge>,
    settledAt: '2026-08-08 02:00:00',
  },
  {
    settleNo: 'ST-202608-002',
    period: '2026-08-01 ~ 2026-08-07',
    pairCode: 'CNY/HKD',
    netAmount: 'HK$ 480,000.00',
    status: <Badge variant="secondary">对账中</Badge>,
    settledAt: '-',
  },
  {
    settleNo: 'ST-202607-019',
    period: '2026-07-25 ~ 2026-07-31',
    pairCode: 'USD/EUR',
    netAmount: '€ 95,000.00',
    status: <Badge variant="destructive">异常</Badge>,
    settledAt: '-',
  },
];

const detailFields: MockField[] = [
  { key: 'settleNo', label: '结算单号' },
  { key: 'period', label: '结算周期' },
  { key: 'pairCode', label: '货币对' },
  { key: 'grossAmount', label: '总额' },
  { key: 'fee', label: '手续费' },
  { key: 'netAmount', label: '净额' },
  { key: 'status', label: '状态' },
  { key: 'settledAt', label: '结算时间' },
];

const detailData: Record<string, React.ReactNode> = {
  settleNo: 'ST-202608-001',
  period: '2026-08-01 ~ 2026-08-07',
  pairCode: 'CNY/USD',
  grossAmount: '¥ 1,260,000.00',
  fee: '¥ 10,000.00',
  netAmount: '¥ 1,250,000.00',
  status: <Badge>已结算</Badge>,
  settledAt: '2026-08-08 02:00:00',
};

export function SettleListPage() {
  return (
    <MockListPage
      title="结算"
      description="按周期查看 LP 资金池结算单与对账状态"
      columns={listColumns}
      rows={listRows}
      actionLabel="导出"
    />
  );
}

export function SettleDetailPage() {
  return <MockDetailPage title="结算详情" fields={detailFields} data={detailData} />;
}
