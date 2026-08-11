'use client';

import * as React from 'react';
import {
  Badge,
  MockDetailPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';
/* ------------------------------------------------------------------ *
 * Source Receipt Details (receipt)
 * Menu label: Source Receipt Details  Path: /receipt
 * Page keys: list / detail
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'receiptNo', label: 'Receipt No.' },
  { key: 'payer', label: 'Payer' },
  { key: 'amount', label: 'Receipt Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'bankRef', label: 'Bank Reference No.' },
  { key: 'matched', label: 'Match Status' },
  { key: 'receivedAt', label: 'Received At' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    receiptNo: 'RC-20260810-001',
    payer: 'Sample Merchant A',
    amount: '50,000.00',
    currency: 'CNY',
    bankRef: 'BK-998812',
    matched: <Badge>Matched</Badge>,
    receivedAt: '2026-08-10 08:40:00',
  },
  {
    receiptNo: 'RC-20260809-045',
    payer: 'Sample Merchant B',
    amount: '12,000.00',
    currency: 'USD',
    bankRef: 'BK-771209',
    matched: <Badge variant="secondary">Pending Match</Badge>,
    receivedAt: '2026-08-09 16:25:00',
  },
  {
    receiptNo: 'RC-20260808-120',
    payer: 'Sample Merchant C',
    amount: '88,000.00',
    currency: 'HKD',
    bankRef: 'BK-552301',
    matched: <Badge variant="destructive">Exception</Badge>,
    receivedAt: '2026-08-08 11:05:00',
  },
];

const detailFields: MockField[] = [
  { key: 'receiptNo', label: 'Receipt No.' },
  { key: 'payer', label: 'Payer' },
  { key: 'amount', label: 'Receipt Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'bankRef', label: 'Bank Reference No.' },
  { key: 'matched', label: 'Match Status' },
  { key: 'relatedTx', label: 'Related Record' },
  { key: 'receivedAt', label: 'Received At' },
];

const detailData: Record<string, React.ReactNode> = {
  receiptNo: 'RC-20260810-001',
  payer: 'Sample Merchant A',
  amount: '50,000.00',
  currency: 'CNY',
  bankRef: 'BK-998812',
  matched: <Badge>Matched</Badge>,
  relatedTx: 'TX-20260810-0001',
  receivedAt: '2026-08-10 08:40:00',
};

export function ReceiptListPage() {
  return (
    <MockListPage
      title="Source Receipt Details"
      description="View source-side bank receipt details and their match status with records"
      columns={listColumns}
      rows={listRows}
      actionLabel="Export"
    />
  );
}

export function ReceiptDetailPage() {
  return <MockDetailPage title="Receipt Detail" fields={detailFields} data={detailData} />;
}
