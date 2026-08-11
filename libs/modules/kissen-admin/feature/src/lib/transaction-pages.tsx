'use client';

import {
  MockListPage,
  MockDetailPage,
  Badge,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* tx-list — Transaction Query                                         */
/* ------------------------------------------------------------------ */

const txListColumns: MockColumn[] = [
  { key: 'id', label: 'Transaction No.' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'bankName', label: 'Initiating Bank' },
  { key: 'lpName', label: 'Handling LP' },
  { key: 'status', label: 'Status' },
];

const txListRows = [
  { id: 'TX20260810001', pair: 'USDT/USD', amount: '10,000', bankName: 'Sample Bank A', lpName: 'Sample LP Alpha', status: <Badge>Success</Badge> },
  { id: 'TX20260810002', pair: 'USDC/USD', amount: '25,000', bankName: 'Sample Bank C', lpName: 'Sample LP Alpha', status: <Badge>Success</Badge> },
  { id: 'TX20260810003', pair: 'USDT/USD', amount: '5,000', bankName: 'Sample Bank B', lpName: 'Sample LP Gamma', status: <Badge variant="secondary">Processing</Badge> },
  { id: 'TX20260810004', pair: 'ETH/USDT', amount: '2.5', bankName: 'Sample Bank A', lpName: 'Sample LP Alpha', status: <Badge variant="destructive">EXCEPTION</Badge> },
  { id: 'TX20260810005', pair: 'USDT/USD', amount: '50,000', bankName: 'Sample Bank C', lpName: 'Sample LP Gamma', status: <Badge>Success</Badge> },
];

const txListFields: MockField[] = [
  { key: 'id', label: 'Transaction No.' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'bankName', label: 'Initiating Bank' },
  { key: 'lpName', label: 'Handling LP' },
  { key: 'gatewayId', label: 'Gateway Instance' },
  { key: 'createdAt', label: 'Initiation Time' },
  { key: 'settledAt', label: 'Completion Time' },
  { key: 'status', label: 'Status' },
];

const txListData = {
  id: 'TX20260810001',
  pair: 'USDT/USD',
  amount: '10,000',
  bankName: 'Sample Bank A',
  lpName: 'Sample LP Alpha',
  gatewayId: 'GW001',
  createdAt: '2026-08-10 08:30:00',
  settledAt: '2026-08-10 08:30:05',
  status: <Badge>Success</Badge>,
};

export function TxListListPage() {
  return <MockListPage title="Transaction Query" columns={txListColumns} rows={txListRows} />;
}

export function TxListDetailPage() {
  return <MockDetailPage title="Transaction Details" fields={txListFields} data={txListData} />;
}

/* ------------------------------------------------------------------ */
/* tx-exception — Exception Handling                                   */
/* ------------------------------------------------------------------ */

const txExceptionColumns: MockColumn[] = [
  { key: 'id', label: 'Transaction No.' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'reason', label: 'Exception Reason' },
  { key: 'handler', label: 'Handler' },
  { key: 'status', label: 'Handling Status' },
];

const txExceptionRows = [
  { id: 'TX20260810004', pair: 'ETH/USDT', amount: '2.5', reason: 'On-chain Confirmation Timeout', handler: '—', status: <Badge variant="secondary">Pending</Badge> },
  { id: 'TX20260809021', pair: 'USDT/USD', amount: '8,000', reason: 'LP Rejection', handler: 'Operations Manager', status: <Badge>Resolved</Badge> },
  { id: 'TX20260809033', pair: 'BTC/USDT', amount: '0.5', reason: 'Rate Exceeded', handler: '—', status: <Badge variant="secondary">Pending</Badge> },
  { id: 'TX20260808012', pair: 'USDC/USD', amount: '15,000', reason: 'Insufficient Balance', handler: 'Operations Manager', status: <Badge variant="destructive">Suspended</Badge> },
];

const txExceptionFields: MockField[] = [
  { key: 'id', label: 'Transaction No.' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'reason', label: 'Exception Reason' },
  { key: 'detail', label: 'Exception Details' },
  { key: 'occurredAt', label: 'Occurrence Time' },
  { key: 'handler', label: 'Handler' },
  { key: 'resolvedAt', label: 'Resolution Time' },
  { key: 'status', label: 'Handling Status' },
];

const txExceptionData = {
  id: 'TX20260810004',
  pair: 'ETH/USDT',
  amount: '2.5',
  reason: 'On-chain Confirmation Timeout',
  detail: 'Waiting for block confirmation exceeded 30 minutes',
  occurredAt: '2026-08-10 08:35:00',
  handler: '—',
  resolvedAt: '—',
  status: <Badge variant="secondary">Pending</Badge>,
};

export function TxExceptionListPage() {
  return <MockListPage title="Exception Handling" columns={txExceptionColumns} rows={txExceptionRows} />;
}

export function TxExceptionDetailPage() {
  return <MockDetailPage title="Exception Handling Details" fields={txExceptionFields} data={txExceptionData} />;
}

/* ------------------------------------------------------------------ */
/* tx-reversal — Reversal Records                                      */
/* ------------------------------------------------------------------ */

const txReversalColumns: MockColumn[] = [
  { key: 'id', label: 'Reversal No.' },
  { key: 'originalTxId', label: 'Original Transaction No.' },
  { key: 'amount', label: 'Reversal Amount' },
  { key: 'operator', label: 'Operator' },
  { key: 'createdAt', label: 'Reversal Time' },
  { key: 'status', label: 'Status' },
];

const txReversalRows = [
  { id: 'RV2026080801', originalTxId: 'TX20260808012', amount: '15,000', operator: 'Operations Manager', createdAt: '2026-08-08 14:00:00', status: <Badge>Success</Badge> },
  { id: 'RV2026080715', originalTxId: 'TX20260807088', amount: '3,200', operator: 'Risk Manager', createdAt: '2026-08-07 16:20:00', status: <Badge>Success</Badge> },
  { id: 'RV2026080603', originalTxId: 'TX20260806045', amount: '7,500', operator: 'Operations Manager', createdAt: '2026-08-06 10:05:00', status: <Badge variant="secondary">Processing</Badge> },
];

export function TxReversalListPage() {
  return <MockListPage title="Reversal Records" columns={txReversalColumns} rows={txReversalRows} />;
}
