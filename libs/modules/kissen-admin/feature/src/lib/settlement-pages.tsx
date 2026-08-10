'use client';

import {
  MockListPage,
  MockDetailPage,
  type MockColumn,
  type MockField,
} from './mock-components';
import { Badge } from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* settle-record — 结算流水                                            */
/* ------------------------------------------------------------------ */

const settleRecordColumns: MockColumn[] = [
  { key: 'id', label: '流水号' },
  { key: 'txId', label: '关联交易' },
  { key: 'pair', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'settledAt', label: '结算时间' },
  { key: 'status', label: '状态' },
];

const settleRecordRows = [
  { id: 'SR2026081001', txId: 'TX20260810001', pair: 'USDT/USD', amount: '10,000', settledAt: '2026-08-10 08:30:05', status: <Badge>已结算</Badge> },
  { id: 'SR2026081002', txId: 'TX20260810002', pair: 'USDC/USD', amount: '25,000', settledAt: '2026-08-10 08:31:10', status: <Badge>已结算</Badge> },
  { id: 'SR2026081003', txId: 'TX20260810005', pair: 'USDT/USD', amount: '50,000', settledAt: '2026-08-10 08:45:00', status: <Badge variant="secondary">结算中</Badge> },
  { id: 'SR2026080908', txId: 'TX20260809021', pair: 'USDT/USD', amount: '8,000', settledAt: '2026-08-09 17:00:00', status: <Badge variant="destructive">已撤销</Badge> },
];

const settleRecordFields: MockField[] = [
  { key: 'id', label: '流水号' },
  { key: 'txId', label: '关联交易' },
  { key: 'pair', label: '货币对' },
  { key: 'amount', label: '金额' },
  { key: 'bankName', label: '银行方' },
  { key: 'lpName', label: 'LP 方' },
  { key: 'settledAt', label: '结算时间' },
  { key: 'status', label: '状态' },
];

const settleRecordData = {
  id: 'SR2026081001',
  txId: 'TX20260810001',
  pair: 'USDT/USD',
  amount: '10,000',
  bankName: '示例银行 A',
  lpName: '示例 LP Alpha',
  settledAt: '2026-08-10 08:30:05',
  status: <Badge>已结算</Badge>,
};

export function SettleRecordListPage() {
  return <MockListPage title="结算流水" columns={settleRecordColumns} rows={settleRecordRows} />;
}

export function SettleRecordDetailPage() {
  return <MockDetailPage title="结算流水详情" fields={settleRecordFields} data={settleRecordData} />;
}

/* ------------------------------------------------------------------ */
/* settle-order — 结算单确认                                           */
/* ------------------------------------------------------------------ */

const settleOrderColumns: MockColumn[] = [
  { key: 'id', label: '结算单号' },
  { key: 'period', label: '结算周期' },
  { key: 'counterparty', label: '对手方' },
  { key: 'totalAmount', label: '结算总额' },
  { key: 'status', label: '确认状态' },
];

const settleOrderRows = [
  { id: 'SO20260810-CNA', period: '2026-08-10', counterparty: '示例银行 A', totalAmount: '160,000', status: <Badge>已确认</Badge> },
  { id: 'SO20260810-CNC', period: '2026-08-10', counterparty: '示例银行 C', totalAmount: '75,000', status: <Badge variant="secondary">待确认</Badge> },
  { id: 'SO20260810-LPA', period: '2026-08-10', counterparty: '示例 LP Alpha', totalAmount: '2,050,000', status: <Badge>已确认</Badge> },
  { id: 'SO20260810-LPG', period: '2026-08-10', counterparty: '示例 LP Gamma', totalAmount: '5,000', status: <Badge variant="secondary">待确认</Badge> },
];

const settleOrderFields: MockField[] = [
  { key: 'id', label: '结算单号' },
  { key: 'period', label: '结算周期' },
  { key: 'counterparty', label: '对手方' },
  { key: 'totalAmount', label: '结算总额' },
  { key: 'txCount', label: '交易笔数' },
  { key: 'confirmedBy', label: '确认人' },
  { key: 'confirmedAt', label: '确认时间' },
  { key: 'status', label: '确认状态' },
];

const settleOrderData = {
  id: 'SO20260810-CNA',
  period: '2026-08-10',
  counterparty: '示例银行 A',
  totalAmount: '160,000',
  txCount: '3',
  confirmedBy: '结算管理员',
  confirmedAt: '2026-08-10 18:00:00',
  status: <Badge>已确认</Badge>,
};

export function SettleOrderListPage() {
  return <MockListPage title="结算单确认" columns={settleOrderColumns} rows={settleOrderRows} />;
}

export function SettleOrderDetailPage() {
  return <MockDetailPage title="结算单详情" fields={settleOrderFields} data={settleOrderData} />;
}

/* ------------------------------------------------------------------ */
/* split-transfer — 分成划转                                           */
/* ------------------------------------------------------------------ */

const splitTransferColumns: MockColumn[] = [
  { key: 'id', label: '划转编号' },
  { key: 'txId', label: '关联交易' },
  { key: 'payee', label: '收款方' },
  { key: 'amount', label: '分成金额' },
  { key: 'transferedAt', label: '划转时间' },
  { key: 'status', label: '状态' },
];

const splitTransferRows = [
  { id: 'ST2026081001', txId: 'TX20260810001', payee: '示例 LP Alpha', amount: '20', transferedAt: '2026-08-10 08:30:10', status: <Badge>已划转</Badge> },
  { id: 'ST2026081002', txId: 'TX20260810002', payee: '示例 LP Alpha', amount: '50', transferedAt: '2026-08-10 08:31:15', status: <Badge>已划转</Badge> },
  { id: 'ST2026081003', txId: 'TX20260810005', payee: '示例 LP Gamma', amount: '100', transferedAt: '2026-08-10 08:45:05', status: <Badge variant="secondary">划转中</Badge> },
  { id: 'ST2026080908', txId: 'TX20260809021', payee: '示例 LP Gamma', amount: '16', transferedAt: '2026-08-09 17:00:05', status: <Badge variant="destructive">已冻结</Badge> },
];

const splitTransferFields: MockField[] = [
  { key: 'id', label: '划转编号' },
  { key: 'txId', label: '关联交易' },
  { key: 'payee', label: '收款方' },
  { key: 'amount', label: '分成金额' },
  { key: 'splitRate', label: '分成比例' },
  { key: 'txHash', label: '链上哈希' },
  { key: 'transferedAt', label: '划转时间' },
  { key: 'status', label: '状态' },
];

const splitTransferData = {
  id: 'ST2026081001',
  txId: 'TX20260810001',
  payee: '示例 LP Alpha',
  amount: '20',
  splitRate: '0.20%',
  txHash: '0xspl…001',
  transferedAt: '2026-08-10 08:30:10',
  status: <Badge>已划转</Badge>,
};

export function SplitTransferListPage() {
  return <MockListPage title="分成划转" columns={splitTransferColumns} rows={splitTransferRows} />;
}

export function SplitTransferDetailPage() {
  return <MockDetailPage title="分成划转详情" fields={splitTransferFields} data={splitTransferData} />;
}

/* ------------------------------------------------------------------ */
/* reconcile — 日终对账与差异复核                                      */
/* ------------------------------------------------------------------ */

const reconcileColumns: MockColumn[] = [
  { key: 'id', label: '对账批次' },
  { key: 'date', label: '对账日期' },
  { key: 'counterparty', label: '对手方' },
  { key: 'diffCount', label: '差异数' },
  { key: 'reviewer', label: '复核人' },
  { key: 'status', label: '状态' },
];

const reconcileRows = [
  { id: 'RC20260810-CNA', date: '2026-08-10', counterparty: '示例银行 A', diffCount: '0', reviewer: '复核员', status: <Badge>已复核</Badge> },
  { id: 'RC20260810-CNC', date: '2026-08-10', counterparty: '示例银行 C', diffCount: '2', reviewer: '—', status: <Badge variant="secondary">待复核</Badge> },
  { id: 'RC20260810-LPA', date: '2026-08-10', counterparty: '示例 LP Alpha', diffCount: '0', reviewer: '复核员', status: <Badge>已复核</Badge> },
  { id: 'RC20260809-CNB', date: '2026-08-09', counterparty: '示例银行 B', diffCount: '1', reviewer: '复核员', status: <Badge variant="destructive">存在差异</Badge> },
];

const reconcileFields: MockField[] = [
  { key: 'id', label: '对账批次' },
  { key: 'date', label: '对账日期' },
  { key: 'counterparty', label: '对手方' },
  { key: 'totalTx', label: '总笔数' },
  { key: 'matched', label: '已匹配' },
  { key: 'diffCount', label: '差异数' },
  { key: 'reviewer', label: '复核人' },
  { key: 'reviewedAt', label: '复核时间' },
  { key: 'status', label: '状态' },
];

const reconcileData = {
  id: 'RC20260810-CNA',
  date: '2026-08-10',
  counterparty: '示例银行 A',
  totalTx: '3',
  matched: '3',
  diffCount: '0',
  reviewer: '复核员',
  reviewedAt: '2026-08-10 19:00:00',
  status: <Badge>已复核</Badge>,
};

export function ReconcileListPage() {
  return <MockListPage title="日终对账与差异复核" columns={reconcileColumns} rows={reconcileRows} />;
}

export function ReconcileDetailPage() {
  return <MockDetailPage title="对账详情" fields={reconcileFields} data={reconcileData} />;
}
