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
 * 源端收款明细（receipt）
 * 菜单标签：源端收款明细  路径：/receipt
 * 页面键：list / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'receiptNo', label: '收款编号' },
  { key: 'payer', label: '付款方' },
  { key: 'amount', label: '收款金额' },
  { key: 'currency', label: '币种' },
  { key: 'bankRef', label: '银行流水号' },
  { key: 'matched', label: '匹配状态' },
  { key: 'receivedAt', label: '到账时间' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    receiptNo: 'RC-20260810-001',
    payer: '示例商户 A',
    amount: '50,000.00',
    currency: 'CNY',
    bankRef: 'BK-998812',
    matched: <Badge>已匹配</Badge>,
    receivedAt: '2026-08-10 08:40:00',
  },
  {
    receiptNo: 'RC-20260809-045',
    payer: '示例商户 B',
    amount: '12,000.00',
    currency: 'USD',
    bankRef: 'BK-771209',
    matched: <Badge variant="secondary">待匹配</Badge>,
    receivedAt: '2026-08-09 16:25:00',
  },
  {
    receiptNo: 'RC-20260808-120',
    payer: '示例商户 C',
    amount: '88,000.00',
    currency: 'HKD',
    bankRef: 'BK-552301',
    matched: <Badge variant="destructive">异常</Badge>,
    receivedAt: '2026-08-08 11:05:00',
  },
];

const detailFields: MockField[] = [
  { key: 'receiptNo', label: '收款编号' },
  { key: 'payer', label: '付款方' },
  { key: 'amount', label: '收款金额' },
  { key: 'currency', label: '币种' },
  { key: 'bankRef', label: '银行流水号' },
  { key: 'matched', label: '匹配状态' },
  { key: 'relatedTx', label: '关联流水' },
  { key: 'receivedAt', label: '到账时间' },
];

const detailData: Record<string, React.ReactNode> = {
  receiptNo: 'RC-20260810-001',
  payer: '示例商户 A',
  amount: '50,000.00',
  currency: 'CNY',
  bankRef: 'BK-998812',
  matched: <Badge>已匹配</Badge>,
  relatedTx: 'TX-20260810-0001',
  receivedAt: '2026-08-10 08:40:00',
};

export function ReceiptListPage() {
  return (
    <MockListPage
      title="源端收款明细"
      description="查看源端银行收款明细及其与流水的匹配状态"
      columns={listColumns}
      rows={listRows}
      actionLabel="导出"
    />
  );
}

export function ReceiptDetailPage() {
  return <MockDetailPage title="收款明细详情" fields={detailFields} data={detailData} />;
}
