'use client';

import {
  MockListPage,
  MockDetailPage,
  MockFormPage,
  Badge,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* currency-pair — Currency Pair Enable/Disable & Limits               */
/* ------------------------------------------------------------------ */

const currencyPairColumns: MockColumn[] = [
  { key: 'pair', label: 'Currency Pair' },
  { key: 'base', label: 'Base Currency' },
  { key: 'quote', label: 'Quote Currency' },
  { key: 'minAmount', label: 'Min Amount' },
  { key: 'maxAmount', label: 'Max Amount' },
  { key: 'status', label: 'Status' },
];

const currencyPairRows = [
  { pair: 'USDT/USD', base: 'USDT', quote: 'USD', minAmount: '10', maxAmount: '500,000', status: <Badge>Enabled</Badge> },
  { pair: 'USDC/USD', base: 'USDC', quote: 'USD', minAmount: '10', maxAmount: '500,000', status: <Badge>Enabled</Badge> },
  { pair: 'BTC/USDT', base: 'BTC', quote: 'USDT', minAmount: '0.001', maxAmount: '10', status: <Badge variant="secondary">Paused</Badge> },
  { pair: 'ETH/USDT', base: 'ETH', quote: 'USDT', minAmount: '0.01', maxAmount: '100', status: <Badge>Enabled</Badge> },
];

const currencyPairFields: MockField[] = [
  { key: 'pair', label: 'Currency Pair' },
  { key: 'base', label: 'Base Currency' },
  { key: 'quote', label: 'Quote Currency' },
  { key: 'minAmount', label: 'Min Amount' },
  { key: 'maxAmount', label: 'Max Amount' },
  { key: 'precision', label: 'Precision' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'status', label: 'Status' },
];

const currencyPairData = {
  pair: 'USDT/USD',
  base: 'USDT',
  quote: 'USD',
  minAmount: '10',
  maxAmount: '500,000',
  precision: '2',
  updatedAt: '2026-08-02 10:00:00',
  status: <Badge>Enabled</Badge>,
};

const currencyPairFormFields: MockField[] = [
  { key: 'base', label: 'Base Currency' },
  { key: 'quote', label: 'Quote Currency' },
  { key: 'minAmount', label: 'Min Amount', type: 'number' },
  { key: 'maxAmount', label: 'Max Amount', type: 'number' },
  { key: 'precision', label: 'Precision', type: 'number' },
];

export function CurrencyPairListPage() {
  return <MockListPage title="Currency Pair Enable/Disable & Limits" columns={currencyPairColumns} rows={currencyPairRows} />;
}

export function CurrencyPairDetailPage() {
  return <MockDetailPage title="Currency Pair Details" fields={currencyPairFields} data={currencyPairData} />;
}

export function CurrencyPairFormPage() {
  return <MockFormPage title="Currency Pair Configuration" fields={currencyPairFormFields} />;
}

/* ------------------------------------------------------------------ */
/* rate-config — Exchange Rate & Markup Configuration                  */
/* ------------------------------------------------------------------ */

const rateConfigColumns: MockColumn[] = [
  { key: 'id', label: 'Config ID' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'source', label: 'Rate Source' },
  { key: 'markup', label: 'Markup Rate' },
  { key: 'status', label: 'Status' },
];

const rateConfigRows = [
  { id: 'RC001', pair: 'USDT/USD', source: 'Primary Source A', markup: '0.20%', status: <Badge>Active</Badge> },
  { id: 'RC002', pair: 'USDC/USD', source: 'Primary Source A', markup: '0.20%', status: <Badge>Active</Badge> },
  { id: 'RC003', pair: 'BTC/USDT', source: 'Primary Source B', markup: '0.50%', status: <Badge variant="secondary">Draft</Badge> },
  { id: 'RC004', pair: 'ETH/USDT', source: 'Primary Source B', markup: '0.50%', status: <Badge>Active</Badge> },
];

const rateConfigFields: MockField[] = [
  { key: 'id', label: 'Config ID' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'source', label: 'Rate Source' },
  { key: 'markup', label: 'Markup Rate' },
  { key: 'spreadFloor', label: 'Spread Floor' },
  { key: 'spreadCap', label: 'Spread Cap' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'status', label: 'Status' },
];

const rateConfigData = {
  id: 'RC001',
  pair: 'USDT/USD',
  source: 'Primary Source A',
  markup: '0.20%',
  spreadFloor: '0.05%',
  spreadCap: '0.80%',
  updatedAt: '2026-08-04 09:30:00',
  status: <Badge>Active</Badge>,
};

const rateConfigFormFields: MockField[] = [
  { key: 'pair', label: 'Currency Pair' },
  { key: 'source', label: 'Rate Source' },
  { key: 'markup', label: 'Markup Rate' },
  { key: 'spreadFloor', label: 'Spread Floor' },
  { key: 'spreadCap', label: 'Spread Cap' },
];

export function RateConfigListPage() {
  return <MockListPage title="Exchange Rate & Markup Configuration" columns={rateConfigColumns} rows={rateConfigRows} />;
}

export function RateConfigDetailPage() {
  return <MockDetailPage title="Rate Configuration Details" fields={rateConfigFields} data={rateConfigData} />;
}

export function RateConfigFormPage() {
  return <MockFormPage title="Rate Configuration Edit" fields={rateConfigFormFields} />;
}

/* ------------------------------------------------------------------ */
/* rate-push-log — Rate Push Logs                                      */
/* ------------------------------------------------------------------ */

const ratePushLogColumns: MockColumn[] = [
  { key: 'id', label: 'Push ID' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'rate', label: 'Pushed Rate' },
  { key: 'channel', label: 'Push Channel' },
  { key: 'pushedAt', label: 'Push Time' },
  { key: 'status', label: 'Status' },
];

const ratePushLogRows = [
  { id: 'RP2026080901', pair: 'USDT/USD', rate: '1.0002', channel: 'Gateway CN', pushedAt: '2026-08-09 08:00:00', status: <Badge>Success</Badge> },
  { id: 'RP2026080902', pair: 'USDC/USD', rate: '1.0001', channel: 'Gateway HK', pushedAt: '2026-08-09 08:00:00', status: <Badge>Success</Badge> },
  { id: 'RP2026080903', pair: 'BTC/USDT', rate: '58,200.00', channel: 'Gateway CN', pushedAt: '2026-08-09 08:01:00', status: <Badge variant="secondary">Partial Success</Badge> },
  { id: 'RP2026080904', pair: 'ETH/USDT', rate: '2,650.50', channel: 'Gateway US', pushedAt: '2026-08-09 08:01:00', status: <Badge variant="destructive">Failed</Badge> },
];

export function RatePushLogListPage() {
  return <MockListPage title="Rate Push Logs" columns={ratePushLogColumns} rows={ratePushLogRows} />;
}
