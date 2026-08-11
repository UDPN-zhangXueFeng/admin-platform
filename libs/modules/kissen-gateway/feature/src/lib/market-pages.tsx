'use client';

import { MockDetailPage,
MockListPage,
type MockColumn,
type MockField, } from '@myorg/shared/ui'

/* ----------------------------- currencypair ----------------------------- */

const cpColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'base', label: 'Base Currency' },
  { key: 'quote', label: 'Quote Currency' },
  { key: 'precision', label: 'Precision' },
  { key: 'status', label: 'Status' },
];

const cpRows = [
  { id: 'CP001', pair: 'USD/CNY', base: 'USD', quote: 'CNY', precision: '4', status: 'Active' },
  { id: 'CP002', pair: 'EUR/USD', base: 'EUR', quote: 'USD', precision: '5', status: 'Active' },
  { id: 'CP003', pair: 'USD/JPY', base: 'USD', quote: 'JPY', precision: '2', status: 'Disabled' },
  { id: 'CP004', pair: 'GBP/USD', base: 'GBP', quote: 'USD', precision: '5', status: 'Active' },
];

const cpDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'base', label: 'Base Currency' },
  { key: 'quote', label: 'Quote Currency' },
  { key: 'precision', label: 'Precision' },
  { key: 'minAmount', label: 'Min Amount' },
  { key: 'maxAmount', label: 'Max Amount' },
  { key: 'status', label: 'Status' },
];

const cpDetailData = {
  id: 'CP001',
  pair: 'USD/CNY',
  base: 'USD',
  quote: 'CNY',
  precision: '4',
  minAmount: '100.00',
  maxAmount: '1,000,000.00',
  status: 'Active',
};

export function CurrencypairListPage() {
  return (
    <MockListPage
      title="Currency Pair"
      description="Tradable currency pair configuration"
      columns={cpColumns}
      rows={cpRows}
    />
  );
}

export function CurrencypairDetailPage() {
  return <MockDetailPage title="Currency Pair Details" fields={cpDetailFields} data={cpDetailData} />;
}

/* -------------------------------- lp ------------------------------------ */

const lpColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'LP Name' },
  { key: 'code', label: 'LP Code' },
  { key: 'region', label: 'Region' },
  { key: 'pairs', label: 'Supported Pairs' },
  { key: 'status', label: 'Status' },
];

const lpRows = [
  { id: 'LP001', name: 'Global Liquidity A', code: 'LP-A', region: 'Hong Kong', pairs: 'USD/CNY, EUR/USD', status: 'Active' },
  { id: 'LP002', name: 'European Market Maker B', code: 'LP-B', region: 'London', pairs: 'EUR/USD, GBP/USD', status: 'Active' },
  { id: 'LP003', name: 'Tokyo Quote Provider C', code: 'LP-C', region: 'Tokyo', pairs: 'USD/JPY', status: 'Suspended' },
  { id: 'LP004', name: 'Singapore Market Maker D', code: 'LP-D', region: 'Singapore', pairs: 'USD/SGD', status: 'Active' },
];

const lpDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'LP Name' },
  { key: 'code', label: 'LP Code' },
  { key: 'region', label: 'Region' },
  { key: 'pairs', label: 'Supported Pairs' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'status', label: 'Status' },
  { key: 'joinedAt', label: 'Connected At' },
];

const lpDetailData = {
  id: 'LP001',
  name: 'Global Liquidity A',
  code: 'LP-A',
  region: 'Hong Kong',
  pairs: 'USD/CNY, EUR/USD',
  contact: 'Chen Dawen',
  status: 'Active',
  joinedAt: '2026-06-15 10:00',
};

export function LpListPage() {
  return (
    <MockListPage
      title="LP List"
      description="Liquidity provider management"
      columns={lpColumns}
      rows={lpRows}
    />
  );
}

export function LpDetailPage() {
  return <MockDetailPage title="LP Details" fields={lpDetailFields} data={lpDetailData} />;
}

/* ------------------------------- rate ----------------------------------- */

const rateColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'bid', label: 'Bid Price' },
  { key: 'ask', label: 'Ask Price' },
  { key: 'lp', label: 'Quoting LP' },
  { key: 'updatedAt', label: 'Updated At' },
];

const rateRows = [
  { id: 'R001', pair: 'USD/CNY', bid: '7.2850', ask: '7.2862', lp: 'LP-A', updatedAt: '2026-08-09 12:00:01' },
  { id: 'R002', pair: 'EUR/USD', bid: '1.09210', ask: '1.09235', lp: 'LP-B', updatedAt: '2026-08-09 12:00:05' },
  { id: 'R003', pair: 'USD/JPY', bid: '152.34', ask: '152.40', lp: 'LP-C', updatedAt: '2026-08-09 12:00:07' },
  { id: 'R004', pair: 'GBP/USD', bid: '1.27450', ask: '1.27478', lp: 'LP-A', updatedAt: '2026-08-09 12:00:09' },
];

const rateDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'bid', label: 'Bid Price' },
  { key: 'ask', label: 'Ask Price' },
  { key: 'spread', label: 'Spread' },
  { key: 'lp', label: 'Quoting LP' },
  { key: 'updatedAt', label: 'Updated At' },
];

const rateDetailData = {
  id: 'R001',
  pair: 'USD/CNY',
  bid: '7.2850',
  ask: '7.2862',
  spread: '0.0012',
  lp: 'LP-A',
  updatedAt: '2026-08-09 12:00:01',
};

export function RateListPage() {
  return (
    <MockListPage
      title="Exchange Rate"
      description="Real-time exchange rate query"
      columns={rateColumns}
      rows={rateRows}
    />
  );
}

export function RateDetailPage() {
  return <MockDetailPage title="Exchange Rate Details" fields={rateDetailFields} data={rateDetailData} />;
}
