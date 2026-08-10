'use client';

import {
  MockDetailPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from './mock-components';

const columns: MockColumn[] = [
  { key: 'txId', label: '交易号' },
  { key: 'pair', label: '货币对' },
  { key: 'side', label: '方向' },
  { key: 'amount', label: '金额' },
  { key: 'lp', label: 'LP' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '交易时间' },
];

const mockRows = [
  { txId: 'TX20260801001', pair: 'USD/CNY', side: '买入', amount: '10,000.00', lp: 'LP-A', status: '已完成', createdAt: '2026-08-01 09:30:11' },
  { txId: 'TX20260801002', pair: 'EUR/USD', side: '卖出', amount: '5,000.00', lp: 'LP-B', status: '处理中', createdAt: '2026-08-02 11:14:42' },
  { txId: 'TX20260801003', pair: 'USD/JPY', side: '买入', amount: '1,200,000.00', lp: 'LP-C', status: '异常', createdAt: '2026-08-04 15:02:08' },
  { txId: 'TX20260801004', pair: 'GBP/USD', side: '卖出', amount: '8,500.00', lp: 'LP-A', status: '已完成', createdAt: '2026-08-06 10:48:55' },
];

const detailFields: MockField[] = [
  { key: 'txId', label: '交易号' },
  { key: 'pair', label: '货币对' },
  { key: 'side', label: '方向' },
  { key: 'amount', label: '金额' },
  { key: 'currency', label: '币种' },
  { key: 'lp', label: 'LP' },
  { key: 'rate', label: '成交汇率' },
  { key: 'fee', label: '手续费' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '交易时间' },
];

const detailData = {
  txId: 'TX20260801001',
  pair: 'USD/CNY',
  side: '买入',
  amount: '10,000.00',
  currency: 'USD',
  lp: 'LP-A',
  rate: '7.2856',
  fee: '12.00',
  status: '已完成',
  createdAt: '2026-08-01 09:30:11',
};

export function TxListPage() {
  return (
    <MockListPage
      title="交易记录"
      description="网关交易流水查询"
      columns={columns}
      rows={mockRows}
    />
  );
}

export function TxDetailPage() {
  return <MockDetailPage title="交易详情" fields={detailFields} data={detailData} />;
}
