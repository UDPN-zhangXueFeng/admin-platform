'use client';

import { MockDetailPage,
MockListPage,
type MockColumn,
type MockField, } from '@myorg/shared/ui'

const columns: MockColumn[] = [
  { key: 'txId', label: 'Transaction No.' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'side', label: 'Direction' },
  { key: 'amount', label: 'Amount' },
  { key: 'lp', label: 'LP' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Transaction Time' },
];

const mockRows = [
  { txId: 'TX20260801001', pair: 'USD/CNY', side: 'Buy', amount: '10,000.00', lp: 'LP-A', status: 'Completed', createdAt: '2026-08-01 09:30:11' },
  { txId: 'TX20260801002', pair: 'EUR/USD', side: 'Sell', amount: '5,000.00', lp: 'LP-B', status: 'Processing', createdAt: '2026-08-02 11:14:42' },
  { txId: 'TX20260801003', pair: 'USD/JPY', side: 'Buy', amount: '1,200,000.00', lp: 'LP-C', status: 'Exception', createdAt: '2026-08-04 15:02:08' },
  { txId: 'TX20260801004', pair: 'GBP/USD', side: 'Sell', amount: '8,500.00', lp: 'LP-A', status: 'Completed', createdAt: '2026-08-06 10:48:55' },
];

const detailFields: MockField[] = [
  { key: 'txId', label: 'Transaction No.' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'side', label: 'Direction' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'lp', label: 'LP' },
  { key: 'rate', label: 'Deal Rate' },
  { key: 'fee', label: 'Fee' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Transaction Time' },
];

const detailData = {
  txId: 'TX20260801001',
  pair: 'USD/CNY',
  side: 'Buy',
  amount: '10,000.00',
  currency: 'USD',
  lp: 'LP-A',
  rate: '7.2856',
  fee: '12.00',
  status: 'Completed',
  createdAt: '2026-08-01 09:30:11',
};

export function TxListPage() {
  return (
    <MockListPage
      title="Transaction Records"
      description="Gateway transaction record query"
      columns={columns}
      rows={mockRows}
    />
  );
}

export function TxDetailPage() {
  return <MockDetailPage title="Transaction Details" fields={detailFields} data={detailData} />;
}
