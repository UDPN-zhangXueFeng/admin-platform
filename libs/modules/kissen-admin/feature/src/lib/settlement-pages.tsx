'use client';

import {
  MockListPage,
  MockDetailPage,
  Badge,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* settle-record — Settlement Records                                  */
/* ------------------------------------------------------------------ */

const settleRecordColumns: MockColumn[] = [
  { key: 'id', label: 'Record ID' },
  { key: 'txId', label: 'Related Transaction' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'settledAt', label: 'Settlement Time' },
  { key: 'status', label: 'Status' },
];

const settleRecordRows = [
  { id: 'SR2026081001', txId: 'TX20260810001', pair: 'USDT/USD', amount: '10,000', settledAt: '2026-08-10 08:30:05', status: <Badge>Settled</Badge> },
  { id: 'SR2026081002', txId: 'TX20260810002', pair: 'USDC/USD', amount: '25,000', settledAt: '2026-08-10 08:31:10', status: <Badge>Settled</Badge> },
  { id: 'SR2026081003', txId: 'TX20260810005', pair: 'USDT/USD', amount: '50,000', settledAt: '2026-08-10 08:45:00', status: <Badge variant="secondary">Settling</Badge> },
  { id: 'SR2026080908', txId: 'TX20260809021', pair: 'USDT/USD', amount: '8,000', settledAt: '2026-08-09 17:00:00', status: <Badge variant="destructive">Revoked</Badge> },
];

const settleRecordFields: MockField[] = [
  { key: 'id', label: 'Record ID' },
  { key: 'txId', label: 'Related Transaction' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'amount', label: 'Amount' },
  { key: 'bankName', label: 'Bank Side' },
  { key: 'lpName', label: 'LP Side' },
  { key: 'settledAt', label: 'Settlement Time' },
  { key: 'status', label: 'Status' },
];

const settleRecordData = {
  id: 'SR2026081001',
  txId: 'TX20260810001',
  pair: 'USDT/USD',
  amount: '10,000',
  bankName: 'Sample Bank A',
  lpName: 'Sample LP Alpha',
  settledAt: '2026-08-10 08:30:05',
  status: <Badge>Settled</Badge>,
};

export function SettleRecordListPage() {
  return <MockListPage title="Settlement Records" columns={settleRecordColumns} rows={settleRecordRows} />;
}

export function SettleRecordDetailPage() {
  return <MockDetailPage title="Settlement Record Details" fields={settleRecordFields} data={settleRecordData} />;
}

/* ------------------------------------------------------------------ */
/* settle-order — Settlement Order Confirmation                        */
/* ------------------------------------------------------------------ */

const settleOrderColumns: MockColumn[] = [
  { key: 'id', label: 'Settlement Order No.' },
  { key: 'period', label: 'Settlement Period' },
  { key: 'counterparty', label: 'Counterparty' },
  { key: 'totalAmount', label: 'Total Settlement Amount' },
  { key: 'status', label: 'Confirmation Status' },
];

const settleOrderRows = [
  { id: 'SO20260810-CNA', period: '2026-08-10', counterparty: 'Sample Bank A', totalAmount: '160,000', status: <Badge>Confirmed</Badge> },
  { id: 'SO20260810-CNC', period: '2026-08-10', counterparty: 'Sample Bank C', totalAmount: '75,000', status: <Badge variant="secondary">Pending Confirmation</Badge> },
  { id: 'SO20260810-LPA', period: '2026-08-10', counterparty: 'Sample LP Alpha', totalAmount: '2,050,000', status: <Badge>Confirmed</Badge> },
  { id: 'SO20260810-LPG', period: '2026-08-10', counterparty: 'Sample LP Gamma', totalAmount: '5,000', status: <Badge variant="secondary">Pending Confirmation</Badge> },
];

const settleOrderFields: MockField[] = [
  { key: 'id', label: 'Settlement Order No.' },
  { key: 'period', label: 'Settlement Period' },
  { key: 'counterparty', label: 'Counterparty' },
  { key: 'totalAmount', label: 'Total Settlement Amount' },
  { key: 'txCount', label: 'Transaction Count' },
  { key: 'confirmedBy', label: 'Confirmed By' },
  { key: 'confirmedAt', label: 'Confirmation Time' },
  { key: 'status', label: 'Confirmation Status' },
];

const settleOrderData = {
  id: 'SO20260810-CNA',
  period: '2026-08-10',
  counterparty: 'Sample Bank A',
  totalAmount: '160,000',
  txCount: '3',
  confirmedBy: 'Settlement Manager',
  confirmedAt: '2026-08-10 18:00:00',
  status: <Badge>Confirmed</Badge>,
};

export function SettleOrderListPage() {
  return <MockListPage title="Settlement Order Confirmation" columns={settleOrderColumns} rows={settleOrderRows} />;
}

export function SettleOrderDetailPage() {
  return <MockDetailPage title="Settlement Order Details" fields={settleOrderFields} data={settleOrderData} />;
}

/* ------------------------------------------------------------------ */
/* split-transfer — Split Transfer                                     */
/* ------------------------------------------------------------------ */

const splitTransferColumns: MockColumn[] = [
  { key: 'id', label: 'Transfer ID' },
  { key: 'txId', label: 'Related Transaction' },
  { key: 'payee', label: 'Payee' },
  { key: 'amount', label: 'Split Amount' },
  { key: 'transferedAt', label: 'Transfer Time' },
  { key: 'status', label: 'Status' },
];

const splitTransferRows = [
  { id: 'ST2026081001', txId: 'TX20260810001', payee: 'Sample LP Alpha', amount: '20', transferedAt: '2026-08-10 08:30:10', status: <Badge>Transferred</Badge> },
  { id: 'ST2026081002', txId: 'TX20260810002', payee: 'Sample LP Alpha', amount: '50', transferedAt: '2026-08-10 08:31:15', status: <Badge>Transferred</Badge> },
  { id: 'ST2026081003', txId: 'TX20260810005', payee: 'Sample LP Gamma', amount: '100', transferedAt: '2026-08-10 08:45:05', status: <Badge variant="secondary">Transferring</Badge> },
  { id: 'ST2026080908', txId: 'TX20260809021', payee: 'Sample LP Gamma', amount: '16', transferedAt: '2026-08-09 17:00:05', status: <Badge variant="destructive">Frozen</Badge> },
];

const splitTransferFields: MockField[] = [
  { key: 'id', label: 'Transfer ID' },
  { key: 'txId', label: 'Related Transaction' },
  { key: 'payee', label: 'Payee' },
  { key: 'amount', label: 'Split Amount' },
  { key: 'splitRate', label: 'Split Rate' },
  { key: 'txHash', label: 'On-chain Hash' },
  { key: 'transferedAt', label: 'Transfer Time' },
  { key: 'status', label: 'Status' },
];

const splitTransferData = {
  id: 'ST2026081001',
  txId: 'TX20260810001',
  payee: 'Sample LP Alpha',
  amount: '20',
  splitRate: '0.20%',
  txHash: '0xspl…001',
  transferedAt: '2026-08-10 08:30:10',
  status: <Badge>Transferred</Badge>,
};

export function SplitTransferListPage() {
  return <MockListPage title="Split Transfer" columns={splitTransferColumns} rows={splitTransferRows} />;
}

export function SplitTransferDetailPage() {
  return <MockDetailPage title="Split Transfer Details" fields={splitTransferFields} data={splitTransferData} />;
}

/* ------------------------------------------------------------------ */
/* reconcile — End-of-Day Reconciliation & Discrepancy Review          */
/* ------------------------------------------------------------------ */

const reconcileColumns: MockColumn[] = [
  { key: 'id', label: 'Reconciliation Batch' },
  { key: 'date', label: 'Reconciliation Date' },
  { key: 'counterparty', label: 'Counterparty' },
  { key: 'diffCount', label: 'Discrepancy Count' },
  { key: 'reviewer', label: 'Reviewer' },
  { key: 'status', label: 'Status' },
];

const reconcileRows = [
  { id: 'RC20260810-CNA', date: '2026-08-10', counterparty: 'Sample Bank A', diffCount: '0', reviewer: 'Reviewer', status: <Badge>Reviewed</Badge> },
  { id: 'RC20260810-CNC', date: '2026-08-10', counterparty: 'Sample Bank C', diffCount: '2', reviewer: '—', status: <Badge variant="secondary">Pending Review</Badge> },
  { id: 'RC20260810-LPA', date: '2026-08-10', counterparty: 'Sample LP Alpha', diffCount: '0', reviewer: 'Reviewer', status: <Badge>Reviewed</Badge> },
  { id: 'RC20260809-CNB', date: '2026-08-09', counterparty: 'Sample Bank B', diffCount: '1', reviewer: 'Reviewer', status: <Badge variant="destructive">Has Discrepancy</Badge> },
];

const reconcileFields: MockField[] = [
  { key: 'id', label: 'Reconciliation Batch' },
  { key: 'date', label: 'Reconciliation Date' },
  { key: 'counterparty', label: 'Counterparty' },
  { key: 'totalTx', label: 'Total Count' },
  { key: 'matched', label: 'Matched' },
  { key: 'diffCount', label: 'Discrepancy Count' },
  { key: 'reviewer', label: 'Reviewer' },
  { key: 'reviewedAt', label: 'Review Time' },
  { key: 'status', label: 'Status' },
];

const reconcileData = {
  id: 'RC20260810-CNA',
  date: '2026-08-10',
  counterparty: 'Sample Bank A',
  totalTx: '3',
  matched: '3',
  diffCount: '0',
  reviewer: 'Reviewer',
  reviewedAt: '2026-08-10 19:00:00',
  status: <Badge>Reviewed</Badge>,
};

export function ReconcileListPage() {
  return <MockListPage title="End-of-Day Reconciliation & Discrepancy Review" columns={reconcileColumns} rows={reconcileRows} />;
}

export function ReconcileDetailPage() {
  return <MockDetailPage title="Reconciliation Details" fields={reconcileFields} data={reconcileData} />;
}
