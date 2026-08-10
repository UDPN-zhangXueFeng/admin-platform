'use client';

import {
  MockListPage,
  MockDetailPage,
  type MockColumn,
  type MockField,
} from './mock-components';
import { Badge } from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* tx-list — 交易查询                                                  */
/* ------------------------------------------------------------------ */

const txListColumns: MockColumn[] = [
  { key: 'id', label: '交易号' },
  { key: 'pair', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'bankName', label: '发起银行' },
  { key: 'lpName', label: '承接 LP' },
  { key: 'status', label: '状态' },
];

const txListRows = [
  { id: 'TX20260810001', pair: 'USDT/USD', amount: '10,000', bankName: '示例银行 A', lpName: '示例 LP Alpha', status: <Badge>成功</Badge> },
  { id: 'TX20260810002', pair: 'USDC/USD', amount: '25,000', bankName: '示例银行 C', lpName: '示例 LP Alpha', status: <Badge>成功</Badge> },
  { id: 'TX20260810003', pair: 'USDT/USD', amount: '5,000', bankName: '示例银行 B', lpName: '示例 LP Gamma', status: <Badge variant="secondary">处理中</Badge> },
  { id: 'TX20260810004', pair: 'ETH/USDT', amount: '2.5', bankName: '示例银行 A', lpName: '示例 LP Alpha', status: <Badge variant="destructive">EXCEPTION</Badge> },
  { id: 'TX20260810005', pair: 'USDT/USD', amount: '50,000', bankName: '示例银行 C', lpName: '示例 LP Gamma', status: <Badge>成功</Badge> },
];

const txListFields: MockField[] = [
  { key: 'id', label: '交易号' },
  { key: 'pair', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'bankName', label: '发起银行' },
  { key: 'lpName', label: '承接 LP' },
  { key: 'gatewayId', label: '网关实例' },
  { key: 'createdAt', label: '发起时间' },
  { key: 'settledAt', label: '完成时间' },
  { key: 'status', label: '状态' },
];

const txListData = {
  id: 'TX20260810001',
  pair: 'USDT/USD',
  amount: '10,000',
  bankName: '示例银行 A',
  lpName: '示例 LP Alpha',
  gatewayId: 'GW001',
  createdAt: '2026-08-10 08:30:00',
  settledAt: '2026-08-10 08:30:05',
  status: <Badge>成功</Badge>,
};

export function TxListListPage() {
  return <MockListPage title="交易查询" columns={txListColumns} rows={txListRows} />;
}

export function TxListDetailPage() {
  return <MockDetailPage title="交易详情" fields={txListFields} data={txListData} />;
}

/* ------------------------------------------------------------------ */
/* tx-exception — 异常(EXCEPTION)处理                                  */
/* ------------------------------------------------------------------ */

const txExceptionColumns: MockColumn[] = [
  { key: 'id', label: '交易号' },
  { key: 'pair', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'reason', label: '异常原因' },
  { key: 'handler', label: '处理人' },
  { key: 'status', label: '处理状态' },
];

const txExceptionRows = [
  { id: 'TX20260810004', pair: 'ETH/USDT', amount: '2.5', reason: '链上确认超时', handler: '—', status: <Badge variant="secondary">待处理</Badge> },
  { id: 'TX20260809021', pair: 'USDT/USD', amount: '8,000', reason: 'LP 拒单', handler: '运营管理员', status: <Badge>已处理</Badge> },
  { id: 'TX20260809033', pair: 'BTC/USDT', amount: '0.5', reason: '汇率超限', handler: '—', status: <Badge variant="secondary">待处理</Badge> },
  { id: 'TX20260808012', pair: 'USDC/USD', amount: '15,000', reason: '余额不足', handler: '运营管理员', status: <Badge variant="destructive">已挂起</Badge> },
];

const txExceptionFields: MockField[] = [
  { key: 'id', label: '交易号' },
  { key: 'pair', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'reason', label: '异常原因' },
  { key: 'detail', label: '异常详情' },
  { key: 'occurredAt', label: '发生时间' },
  { key: 'handler', label: '处理人' },
  { key: 'resolvedAt', label: '处理时间' },
  { key: 'status', label: '处理状态' },
];

const txExceptionData = {
  id: 'TX20260810004',
  pair: 'ETH/USDT',
  amount: '2.5',
  reason: '链上确认超时',
  detail: '等待区块确认超过 30 分钟',
  occurredAt: '2026-08-10 08:35:00',
  handler: '—',
  resolvedAt: '—',
  status: <Badge variant="secondary">待处理</Badge>,
};

export function TxExceptionListPage() {
  return <MockListPage title="异常(EXCEPTION)处理" columns={txExceptionColumns} rows={txExceptionRows} />;
}

export function TxExceptionDetailPage() {
  return <MockDetailPage title="异常处理详情" fields={txExceptionFields} data={txExceptionData} />;
}

/* ------------------------------------------------------------------ */
/* tx-reversal — 冲正记录                                              */
/* ------------------------------------------------------------------ */

const txReversalColumns: MockColumn[] = [
  { key: 'id', label: '冲正编号' },
  { key: 'originalTxId', label: '原交易号' },
  { key: 'amount', label: '冲正金额' },
  { key: 'operator', label: '操作人' },
  { key: 'createdAt', label: '冲正时间' },
  { key: 'status', label: '状态' },
];

const txReversalRows = [
  { id: 'RV2026080801', originalTxId: 'TX20260808012', amount: '15,000', operator: '运营管理员', createdAt: '2026-08-08 14:00:00', status: <Badge>成功</Badge> },
  { id: 'RV2026080715', originalTxId: 'TX20260807088', amount: '3,200', operator: '风控管理员', createdAt: '2026-08-07 16:20:00', status: <Badge>成功</Badge> },
  { id: 'RV2026080603', originalTxId: 'TX20260806045', amount: '7,500', operator: '运营管理员', createdAt: '2026-08-06 10:05:00', status: <Badge variant="secondary">处理中</Badge> },
];

export function TxReversalListPage() {
  return <MockListPage title="冲正记录" columns={txReversalColumns} rows={txReversalRows} />;
}
