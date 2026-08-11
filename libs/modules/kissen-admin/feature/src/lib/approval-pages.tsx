'use client';

import {
  MockListPage,
  MockDetailPage,
  Badge,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* approval-center — Approval Center                                   */
/* ------------------------------------------------------------------ */

const approvalCenterColumns: MockColumn[] = [
  { key: 'id', label: 'Approval No.' },
  { key: 'type', label: 'Business Type' },
  { key: 'applicant', label: 'Applicant' },
  { key: 'summary', label: 'Summary' },
  { key: 'createdAt', label: 'Submit Time' },
  { key: 'status', label: 'Approval Status' },
];

const approvalCenterRows = [
  { id: 'AV202608001', type: 'Bank Onboarding', applicant: 'Li Si', summary: 'Sample Bank B New Onboarding', createdAt: '2026-08-05 14:20:00', status: <Badge variant="secondary">Pending Approval</Badge> },
  { id: 'AV202608002', type: 'Fund Freeze', applicant: 'Risk Manager', summary: 'LP004 Suspicious Transaction Freeze', createdAt: '2026-08-09 22:05:00', status: <Badge variant="secondary">Pending Approval</Badge> },
  { id: 'AV202608003', type: 'Rate Configuration', applicant: 'Operations Manager', summary: 'USDT/USD Markup Adjustment', createdAt: '2026-08-04 09:30:00', status: <Badge>Approved</Badge> },
  { id: 'AV202608004', type: 'Large Amount Release', applicant: 'Operations Manager', summary: 'TX20260810005 50,000 Release', createdAt: '2026-08-10 08:50:00', status: <Badge variant="destructive">Rejected</Badge> },
  { id: 'AV202608005', type: 'Role Change', applicant: 'System Administrator', summary: 'Risk Team New Member', createdAt: '2026-08-08 11:00:00', status: <Badge>Approved</Badge> },
];

const approvalCenterFields: MockField[] = [
  { key: 'id', label: 'Approval No.' },
  { key: 'type', label: 'Business Type' },
  { key: 'applicant', label: 'Applicant' },
  { key: 'summary', label: 'Summary' },
  { key: 'currentNode', label: 'Current Node' },
  { key: 'approver', label: 'Current Approver' },
  { key: 'createdAt', label: 'Submit Time' },
  { key: 'resolvedAt', label: 'Resolution Time' },
  { key: 'status', label: 'Approval Status' },
];

const approvalCenterData = {
  id: 'AV202608001',
  type: 'Bank Onboarding',
  applicant: 'Li Si',
  summary: 'Sample Bank B New Onboarding',
  currentNode: 'Operations Review',
  approver: 'Operations Supervisor',
  createdAt: '2026-08-05 14:20:00',
  resolvedAt: '—',
  status: <Badge variant="secondary">Pending Approval</Badge>,
};

export function ApprovalCenterListPage() {
  return <MockListPage title="Approval Center" columns={approvalCenterColumns} rows={approvalCenterRows} />;
}

export function ApprovalCenterDetailPage() {
  return <MockDetailPage title="Approval Details" fields={approvalCenterFields} data={approvalCenterData} />;
}
