'use client';

import {
  MockListPage,
  MockDetailPage,
  MockFormPage,
  type MockColumn,
  type MockField,
} from './mock-components';
import { Badge } from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* currency-pair — 货币对启停与限额                                    */
/* ------------------------------------------------------------------ */

const currencyPairColumns: MockColumn[] = [
  { key: 'pair', label: '货币对' },
  { key: 'base', label: '基础币种' },
  { key: 'quote', label: '报价币种' },
  { key: 'minAmount', label: '最小金额' },
  { key: 'maxAmount', label: '最大金额' },
  { key: 'status', label: '状态' },
];

const currencyPairRows = [
  { pair: 'USDT/USD', base: 'USDT', quote: 'USD', minAmount: '10', maxAmount: '500,000', status: <Badge>启用</Badge> },
  { pair: 'USDC/USD', base: 'USDC', quote: 'USD', minAmount: '10', maxAmount: '500,000', status: <Badge>启用</Badge> },
  { pair: 'BTC/USDT', base: 'BTC', quote: 'USDT', minAmount: '0.001', maxAmount: '10', status: <Badge variant="secondary">暂停</Badge> },
  { pair: 'ETH/USDT', base: 'ETH', quote: 'USDT', minAmount: '0.01', maxAmount: '100', status: <Badge>启用</Badge> },
];

const currencyPairFields: MockField[] = [
  { key: 'pair', label: '货币对' },
  { key: 'base', label: '基础币种' },
  { key: 'quote', label: '报价币种' },
  { key: 'minAmount', label: '最小金额' },
  { key: 'maxAmount', label: '最大金额' },
  { key: 'precision', label: '精度' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'status', label: '状态' },
];

const currencyPairData = {
  pair: 'USDT/USD',
  base: 'USDT',
  quote: 'USD',
  minAmount: '10',
  maxAmount: '500,000',
  precision: '2',
  updatedAt: '2026-08-02 10:00:00',
  status: <Badge>启用</Badge>,
};

const currencyPairFormFields: MockField[] = [
  { key: 'base', label: '基础币种' },
  { key: 'quote', label: '报价币种' },
  { key: 'minAmount', label: '最小金额', type: 'number' },
  { key: 'maxAmount', label: '最大金额', type: 'number' },
  { key: 'precision', label: '精度', type: 'number' },
];

export function CurrencyPairListPage() {
  return <MockListPage title="货币对启停与限额" columns={currencyPairColumns} rows={currencyPairRows} />;
}

export function CurrencyPairDetailPage() {
  return <MockDetailPage title="货币对详情" fields={currencyPairFields} data={currencyPairData} />;
}

export function CurrencyPairFormPage() {
  return <MockFormPage title="货币对配置" fields={currencyPairFormFields} />;
}

/* ------------------------------------------------------------------ */
/* rate-config — 汇率与加价率配置                                      */
/* ------------------------------------------------------------------ */

const rateConfigColumns: MockColumn[] = [
  { key: 'id', label: '配置编号' },
  { key: 'pair', label: '货币对' },
  { key: 'source', label: '汇率源' },
  { key: 'markup', label: '加价率' },
  { key: 'status', label: '状态' },
];

const rateConfigRows = [
  { id: 'RC001', pair: 'USDT/USD', source: '主流源 A', markup: '0.20%', status: <Badge>生效中</Badge> },
  { id: 'RC002', pair: 'USDC/USD', source: '主流源 A', markup: '0.20%', status: <Badge>生效中</Badge> },
  { id: 'RC003', pair: 'BTC/USDT', source: '主流源 B', markup: '0.50%', status: <Badge variant="secondary">草稿</Badge> },
  { id: 'RC004', pair: 'ETH/USDT', source: '主流源 B', markup: '0.50%', status: <Badge>生效中</Badge> },
];

const rateConfigFields: MockField[] = [
  { key: 'id', label: '配置编号' },
  { key: 'pair', label: '货币对' },
  { key: 'source', label: '汇率源' },
  { key: 'markup', label: '加价率' },
  { key: 'spreadFloor', label: '点差下限' },
  { key: 'spreadCap', label: '点差上限' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'status', label: '状态' },
];

const rateConfigData = {
  id: 'RC001',
  pair: 'USDT/USD',
  source: '主流源 A',
  markup: '0.20%',
  spreadFloor: '0.05%',
  spreadCap: '0.80%',
  updatedAt: '2026-08-04 09:30:00',
  status: <Badge>生效中</Badge>,
};

const rateConfigFormFields: MockField[] = [
  { key: 'pair', label: '货币对' },
  { key: 'source', label: '汇率源' },
  { key: 'markup', label: '加价率' },
  { key: 'spreadFloor', label: '点差下限' },
  { key: 'spreadCap', label: '点差上限' },
];

export function RateConfigListPage() {
  return <MockListPage title="汇率与加价率配置" columns={rateConfigColumns} rows={rateConfigRows} />;
}

export function RateConfigDetailPage() {
  return <MockDetailPage title="汇率配置详情" fields={rateConfigFields} data={rateConfigData} />;
}

export function RateConfigFormPage() {
  return <MockFormPage title="汇率配置编辑" fields={rateConfigFormFields} />;
}

/* ------------------------------------------------------------------ */
/* rate-push-log — 汇率推送记录                                        */
/* ------------------------------------------------------------------ */

const ratePushLogColumns: MockColumn[] = [
  { key: 'id', label: '推送编号' },
  { key: 'pair', label: '货币对' },
  { key: 'rate', label: '推送汇率' },
  { key: 'channel', label: '推送渠道' },
  { key: 'pushedAt', label: '推送时间' },
  { key: 'status', label: '状态' },
];

const ratePushLogRows = [
  { id: 'RP2026080901', pair: 'USDT/USD', rate: '1.0002', channel: 'Gateway CN', pushedAt: '2026-08-09 08:00:00', status: <Badge>成功</Badge> },
  { id: 'RP2026080902', pair: 'USDC/USD', rate: '1.0001', channel: 'Gateway HK', pushedAt: '2026-08-09 08:00:00', status: <Badge>成功</Badge> },
  { id: 'RP2026080903', pair: 'BTC/USDT', rate: '58,200.00', channel: 'Gateway CN', pushedAt: '2026-08-09 08:01:00', status: <Badge variant="secondary">部分成功</Badge> },
  { id: 'RP2026080904', pair: 'ETH/USDT', rate: '2,650.50', channel: 'Gateway US', pushedAt: '2026-08-09 08:01:00', status: <Badge variant="destructive">失败</Badge> },
];

export function RatePushLogListPage() {
  return <MockListPage title="汇率推送记录" columns={ratePushLogColumns} rows={ratePushLogRows} />;
}
