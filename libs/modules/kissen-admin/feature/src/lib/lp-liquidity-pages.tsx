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
/* lp-info — LP 资料与初始化                                           */
/* ------------------------------------------------------------------ */

const lpInfoColumns: MockColumn[] = [
  { key: 'id', label: 'LP 编号' },
  { key: 'name', label: 'LP 名称' },
  { key: 'type', label: '类型' },
  { key: 'contact', label: '联系人' },
  { key: 'status', label: '状态' },
];

const lpInfoRows = [
  { id: 'LP001', name: '示例 LP Alpha', type: '机构', contact: 'Alice', status: <Badge>已激活</Badge> },
  { id: 'LP002', name: '示例 LP Beta', type: '机构', contact: 'Bob', status: <Badge variant="secondary">待初始化</Badge> },
  { id: 'LP003', name: '示例 LP Gamma', type: '个人', contact: 'Carol', status: <Badge>已激活</Badge> },
  { id: 'LP004', name: '示例 LP Delta', type: '机构', contact: 'Dave', status: <Badge variant="destructive">已冻结</Badge> },
];

const lpInfoFields: MockField[] = [
  { key: 'id', label: 'LP 编号' },
  { key: 'name', label: 'LP 名称' },
  { key: 'type', label: '类型' },
  { key: 'contact', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'settleAccount', label: '结算账户' },
  { key: 'initializedAt', label: '初始化时间' },
  { key: 'status', label: '状态' },
];

const lpInfoData = {
  id: 'LP001',
  name: '示例 LP Alpha',
  type: '机构',
  contact: 'Alice',
  phone: '+1-555-0100',
  settleAccount: '0xAlpha0001…',
  initializedAt: '2026-07-10 11:00:00',
  status: <Badge>已激活</Badge>,
};

const lpInfoFormFields: MockField[] = [
  { key: 'name', label: 'LP 名称' },
  { key: 'type', label: '类型' },
  { key: 'contact', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'settleAccount', label: '结算账户' },
];

export function LpInfoListPage() {
  return (
    <MockListPage
      title="LP 资料与初始化"
      description="管理流动性提供商基础资料与账户初始化"
      columns={lpInfoColumns}
      rows={lpInfoRows}
    />
  );
}

export function LpInfoDetailPage() {
  return <MockDetailPage title="LP 详情" fields={lpInfoFields} data={lpInfoData} />;
}

export function LpInfoFormPage() {
  return <MockFormPage title="LP 资料编辑" fields={lpInfoFormFields} />;
}

/* ------------------------------------------------------------------ */
/* lp-pool — 资金池登记                                                */
/* ------------------------------------------------------------------ */

const lpPoolColumns: MockColumn[] = [
  { key: 'id', label: '池编号' },
  { key: 'lpName', label: '所属 LP' },
  { key: 'currency', label: '币种' },
  { key: 'balance', label: '余额' },
  { key: 'status', label: '状态' },
];

const lpPoolRows = [
  { id: 'POOL001', lpName: '示例 LP Alpha', currency: 'USDT', balance: '1,200,000', status: <Badge>可用</Badge> },
  { id: 'POOL002', lpName: '示例 LP Alpha', currency: 'USDC', balance: '850,000', status: <Badge>可用</Badge> },
  { id: 'POOL003', lpName: '示例 LP Gamma', currency: 'USDT', balance: '420,000', status: <Badge variant="secondary">低水位</Badge> },
  { id: 'POOL004', lpName: '示例 LP Delta', currency: 'USDC', balance: '0', status: <Badge variant="destructive">已冻结</Badge> },
];

const lpPoolFields: MockField[] = [
  { key: 'id', label: '池编号' },
  { key: 'lpName', label: '所属 LP' },
  { key: 'currency', label: '币种' },
  { key: 'balance', label: '余额' },
  { key: 'lowWaterMark', label: '低水位阈值' },
  { key: 'highWaterMark', label: '高水位阈值' },
  { key: 'createdAt', label: '登记时间' },
  { key: 'status', label: '状态' },
];

const lpPoolData = {
  id: 'POOL001',
  lpName: '示例 LP Alpha',
  currency: 'USDT',
  balance: '1,200,000',
  lowWaterMark: '200,000',
  highWaterMark: '2,000,000',
  createdAt: '2026-07-12 09:15:00',
  status: <Badge>可用</Badge>,
};

const lpPoolFormFields: MockField[] = [
  { key: 'lpName', label: '所属 LP' },
  { key: 'currency', label: '币种' },
  { key: 'lowWaterMark', label: '低水位阈值', type: 'number' },
  { key: 'highWaterMark', label: '高水位阈值', type: 'number' },
];

export function LpPoolListPage() {
  return <MockListPage title="资金池登记" columns={lpPoolColumns} rows={lpPoolRows} />;
}

export function LpPoolDetailPage() {
  return <MockDetailPage title="资金池详情" fields={lpPoolFields} data={lpPoolData} />;
}

export function LpPoolFormPage() {
  return <MockFormPage title="资金池登记" fields={lpPoolFormFields} />;
}

/* ------------------------------------------------------------------ */
/* lp-preauth — 预授权管理                                             */
/* ------------------------------------------------------------------ */

const lpPreauthColumns: MockColumn[] = [
  { key: 'id', label: '授权编号' },
  { key: 'lpName', label: '所属 LP' },
  { key: 'scope', label: '授权范围' },
  { key: 'expireAt', label: '到期时间' },
  { key: 'status', label: '状态' },
];

const lpPreauthRows = [
  { id: 'PA001', lpName: '示例 LP Alpha', scope: 'USDT/USD 划转', expireAt: '2026-12-31', status: <Badge>生效中</Badge> },
  { id: 'PA002', lpName: '示例 LP Alpha', scope: 'USDC/USD 划转', expireAt: '2026-12-31', status: <Badge>生效中</Badge> },
  { id: 'PA003', lpName: '示例 LP Gamma', scope: '全币种划转', expireAt: '2026-09-30', status: <Badge variant="secondary">即将到期</Badge> },
  { id: 'PA004', lpName: '示例 LP Beta', scope: 'USDT/USD 划转', expireAt: '2026-06-30', status: <Badge variant="destructive">已过期</Badge> },
];

const lpPreauthFields: MockField[] = [
  { key: 'id', label: '授权编号' },
  { key: 'lpName', label: '所属 LP' },
  { key: 'scope', label: '授权范围' },
  { key: 'grantedBy', label: '授权人' },
  { key: 'grantedAt', label: '授权时间' },
  { key: 'expireAt', label: '到期时间' },
  { key: 'status', label: '状态' },
];

const lpPreauthData = {
  id: 'PA001',
  lpName: '示例 LP Alpha',
  scope: 'USDT/USD 划转',
  grantedBy: '运营管理员',
  grantedAt: '2026-07-15 10:00:00',
  expireAt: '2026-12-31',
  status: <Badge>生效中</Badge>,
};

const lpPreauthFormFields: MockField[] = [
  { key: 'lpName', label: '所属 LP' },
  { key: 'scope', label: '授权范围' },
  { key: 'expireAt', label: '到期时间', type: 'date' },
];

export function LpPreauthListPage() {
  return <MockListPage title="预授权管理" columns={lpPreauthColumns} rows={lpPreauthRows} />;
}

export function LpPreauthDetailPage() {
  return <MockDetailPage title="预授权详情" fields={lpPreauthFields} data={lpPreauthData} />;
}

export function LpPreauthFormPage() {
  return <MockFormPage title="预授权编辑" fields={lpPreauthFormFields} />;
}

/* ------------------------------------------------------------------ */
/* lp-currency-pair — 参与货币对清单                                   */
/* ------------------------------------------------------------------ */

const lpCurrencyPairColumns: MockColumn[] = [
  { key: 'lpName', label: '所属 LP' },
  { key: 'pair', label: '货币对' },
  { key: 'direction', label: '方向' },
  { key: 'status', label: '状态' },
];

const lpCurrencyPairRows = [
  { lpName: '示例 LP Alpha', pair: 'USDT/USD', direction: '双向', status: <Badge>参与</Badge> },
  { lpName: '示例 LP Alpha', pair: 'USDC/USD', direction: '双向', status: <Badge>参与</Badge> },
  { lpName: '示例 LP Gamma', pair: 'USDT/USD', direction: '仅买入', status: <Badge>参与</Badge> },
  { lpName: '示例 LP Delta', pair: 'BTC/USDT', direction: '双向', status: <Badge variant="secondary">暂停</Badge> },
];

const lpCurrencyPairFields: MockField[] = [
  { key: 'lpName', label: '所属 LP' },
  { key: 'pair', label: '货币对' },
  { key: 'direction', label: '方向' },
  { key: 'minAmount', label: '最小金额' },
  { key: 'maxAmount', label: '最大金额' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'status', label: '状态' },
];

const lpCurrencyPairData = {
  lpName: '示例 LP Alpha',
  pair: 'USDT/USD',
  direction: '双向',
  minAmount: '100',
  maxAmount: '500,000',
  updatedAt: '2026-08-01 16:00:00',
  status: <Badge>参与</Badge>,
};

export function LpCurrencyPairListPage() {
  return <MockListPage title="参与货币对清单" columns={lpCurrencyPairColumns} rows={lpCurrencyPairRows} />;
}

export function LpCurrencyPairDetailPage() {
  return <MockDetailPage title="货币对参与详情" fields={lpCurrencyPairFields} data={lpCurrencyPairData} />;
}

/* ------------------------------------------------------------------ */
/* lp-topup — 补资流水                                                 */
/* ------------------------------------------------------------------ */

const lpTopupColumns: MockColumn[] = [
  { key: 'id', label: '流水号' },
  { key: 'lpName', label: '所属 LP' },
  { key: 'currency', label: '币种' },
  { key: 'amount', label: '补资金额' },
  { key: 'txHash', label: '链上哈希' },
  { key: 'status', label: '状态' },
];

const lpTopupRows = [
  { id: 'TU202608001', lpName: '示例 LP Alpha', currency: 'USDT', amount: '500,000', txHash: '0xabc…123', status: <Badge>已到账</Badge> },
  { id: 'TU202608002', lpName: '示例 LP Gamma', currency: 'USDT', amount: '200,000', txHash: '0xdef…456', status: <Badge variant="secondary">确认中</Badge> },
  { id: 'TU202608003', lpName: '示例 LP Alpha', currency: 'USDC', amount: '300,000', txHash: '0xghi…789', status: <Badge>已到账</Badge> },
  { id: 'TU202608004', lpName: '示例 LP Beta', currency: 'USDT', amount: '100,000', txHash: '0xjkl…0ab', status: <Badge variant="destructive">失败</Badge> },
];

const lpTopupFields: MockField[] = [
  { key: 'id', label: '流水号' },
  { key: 'lpName', label: '所属 LP' },
  { key: 'poolId', label: '资金池' },
  { key: 'currency', label: '币种' },
  { key: 'amount', label: '补资金额' },
  { key: 'txHash', label: '链上哈希' },
  { key: 'confirmAt', label: '到账时间' },
  { key: 'status', label: '状态' },
];

const lpTopupData = {
  id: 'TU202608001',
  lpName: '示例 LP Alpha',
  poolId: 'POOL001',
  currency: 'USDT',
  amount: '500,000',
  txHash: '0xabc…123',
  confirmAt: '2026-08-03 12:45:00',
  status: <Badge>已到账</Badge>,
};

export function LpTopupListPage() {
  return <MockListPage title="补资流水" columns={lpTopupColumns} rows={lpTopupRows} />;
}

export function LpTopupDetailPage() {
  return <MockDetailPage title="补资流水详情" fields={lpTopupFields} data={lpTopupData} />;
}

/* ------------------------------------------------------------------ */
/* lp-water-level — 水位监控                                           */
/* ------------------------------------------------------------------ */

const lpWaterLevelColumns: MockColumn[] = [
  { key: 'poolId', label: '池编号' },
  { key: 'lpName', label: '所属 LP' },
  { key: 'currency', label: '币种' },
  { key: 'balance', label: '当前余额' },
  { key: 'lowWaterMark', label: '低水位' },
  { key: 'alert', label: '告警' },
];

const lpWaterLevelRows = [
  { poolId: 'POOL001', lpName: '示例 LP Alpha', currency: 'USDT', balance: '1,200,000', lowWaterMark: '200,000', alert: <Badge variant="secondary">正常</Badge> },
  { poolId: 'POOL002', lpName: '示例 LP Alpha', currency: 'USDC', balance: '850,000', lowWaterMark: '200,000', alert: <Badge variant="secondary">正常</Badge> },
  { poolId: 'POOL003', lpName: '示例 LP Gamma', currency: 'USDT', balance: '180,000', lowWaterMark: '200,000', alert: <Badge variant="destructive">低于阈值</Badge> },
  { poolId: 'POOL004', lpName: '示例 LP Delta', currency: 'USDC', balance: '0', lowWaterMark: '100,000', alert: <Badge variant="destructive">已耗尽</Badge> },
];

export function LpWaterLevelListPage() {
  return <MockListPage title="水位监控" columns={lpWaterLevelColumns} rows={lpWaterLevelRows} />;
}
