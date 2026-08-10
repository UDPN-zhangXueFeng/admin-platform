'use client';

import {
  MockDetailPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from './mock-components';

/* ----------------------------- currencypair ----------------------------- */

const cpColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: '货币对' },
  { key: 'base', label: '基础币种' },
  { key: 'quote', label: '报价币种' },
  { key: 'precision', label: '精度' },
  { key: 'status', label: '状态' },
];

const cpRows = [
  { id: 'CP001', pair: 'USD/CNY', base: 'USD', quote: 'CNY', precision: '4', status: '启用' },
  { id: 'CP002', pair: 'EUR/USD', base: 'EUR', quote: 'USD', precision: '5', status: '启用' },
  { id: 'CP003', pair: 'USD/JPY', base: 'USD', quote: 'JPY', precision: '2', status: '停用' },
  { id: 'CP004', pair: 'GBP/USD', base: 'GBP', quote: 'USD', precision: '5', status: '启用' },
];

const cpDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: '货币对' },
  { key: 'base', label: '基础币种' },
  { key: 'quote', label: '报价币种' },
  { key: 'precision', label: '精度' },
  { key: 'minAmount', label: '最小金额' },
  { key: 'maxAmount', label: '最大金额' },
  { key: 'status', label: '状态' },
];

const cpDetailData = {
  id: 'CP001',
  pair: 'USD/CNY',
  base: 'USD',
  quote: 'CNY',
  precision: '4',
  minAmount: '100.00',
  maxAmount: '1,000,000.00',
  status: '启用',
};

export function CurrencypairListPage() {
  return (
    <MockListPage
      title="货币对"
      description="可交易的货币对配置"
      columns={cpColumns}
      rows={cpRows}
    />
  );
}

export function CurrencypairDetailPage() {
  return <MockDetailPage title="货币对详情" fields={cpDetailFields} data={cpDetailData} />;
}

/* -------------------------------- lp ------------------------------------ */

const lpColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'LP 名称' },
  { key: 'code', label: 'LP 编码' },
  { key: 'region', label: '地区' },
  { key: 'pairs', label: '支持货币对' },
  { key: 'status', label: '状态' },
];

const lpRows = [
  { id: 'LP001', name: '环球流动性 A', code: 'LP-A', region: '香港', pairs: 'USD/CNY, EUR/USD', status: '活跃' },
  { id: 'LP002', name: '欧洲做市商 B', code: 'LP-B', region: '伦敦', pairs: 'EUR/USD, GBP/USD', status: '活跃' },
  { id: 'LP003', name: '东京报价商 C', code: 'LP-C', region: '东京', pairs: 'USD/JPY', status: '暂停' },
  { id: 'LP004', name: '新加坡做市商 D', code: 'LP-D', region: '新加坡', pairs: 'USD/SGD', status: '活跃' },
];

const lpDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'LP 名称' },
  { key: 'code', label: 'LP 编码' },
  { key: 'region', label: '地区' },
  { key: 'pairs', label: '支持货币对' },
  { key: 'contact', label: '联系人' },
  { key: 'status', label: '状态' },
  { key: 'joinedAt', label: '接入时间' },
];

const lpDetailData = {
  id: 'LP001',
  name: '环球流动性 A',
  code: 'LP-A',
  region: '香港',
  pairs: 'USD/CNY, EUR/USD',
  contact: '陈大文',
  status: '活跃',
  joinedAt: '2026-06-15 10:00',
};

export function LpListPage() {
  return (
    <MockListPage
      title="LP 列表"
      description="流动性提供商管理"
      columns={lpColumns}
      rows={lpRows}
    />
  );
}

export function LpDetailPage() {
  return <MockDetailPage title="LP 详情" fields={lpDetailFields} data={lpDetailData} />;
}

/* ------------------------------- rate ----------------------------------- */

const rateColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: '货币对' },
  { key: 'bid', label: '买入价' },
  { key: 'ask', label: '卖出价' },
  { key: 'lp', label: '报价 LP' },
  { key: 'updatedAt', label: '更新时间' },
];

const rateRows = [
  { id: 'R001', pair: 'USD/CNY', bid: '7.2850', ask: '7.2862', lp: 'LP-A', updatedAt: '2026-08-09 12:00:01' },
  { id: 'R002', pair: 'EUR/USD', bid: '1.09210', ask: '1.09235', lp: 'LP-B', updatedAt: '2026-08-09 12:00:05' },
  { id: 'R003', pair: 'USD/JPY', bid: '152.34', ask: '152.40', lp: 'LP-C', updatedAt: '2026-08-09 12:00:07' },
  { id: 'R004', pair: 'GBP/USD', bid: '1.27450', ask: '1.27478', lp: 'LP-A', updatedAt: '2026-08-09 12:00:09' },
];

const rateDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'pair', label: '货币对' },
  { key: 'bid', label: '买入价' },
  { key: 'ask', label: '卖出价' },
  { key: 'spread', label: '点差' },
  { key: 'lp', label: '报价 LP' },
  { key: 'updatedAt', label: '更新时间' },
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
      title="汇率"
      description="实时汇率查询"
      columns={rateColumns}
      rows={rateRows}
    />
  );
}

export function RateDetailPage() {
  return <MockDetailPage title="汇率详情" fields={rateDetailFields} data={rateDetailData} />;
}
