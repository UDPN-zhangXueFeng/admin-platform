'use client';

import { MockDetailPage,
MockFormPage,
MockListPage,
type MockColumn,
type MockField, } from '@myorg/shared/ui'

const columns: MockColumn[] = [
  { key: 'id', label: 'Application No.' },
  { key: 'merchant', label: 'Merchant Name' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'industry', label: 'Industry' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Application Time' },
];

const mockRows = [
  { id: 'OB20260801', merchant: 'Example Payment Co., Ltd.', contact: 'Zhang Wei', industry: 'FinTech', status: 'Approved', createdAt: '2026-08-01 09:12' },
  { id: 'OB20260802', merchant: 'Global Trade Tech', contact: 'Li Na', industry: 'Cross-border Trade', status: 'Under Review', createdAt: '2026-08-03 14:30' },
  { id: 'OB20260803', merchant: 'Galaxy Digital Assets', contact: 'Wang Qiang', industry: 'Digital Assets', status: 'Pending Info', createdAt: '2026-08-05 10:05' },
  { id: 'OB20260804', merchant: 'Blue Ocean E-commerce Services', contact: 'Zhao Min', industry: 'E-commerce', status: 'Rejected', createdAt: '2026-08-07 16:48' },
];

const detailFields: MockField[] = [
  { key: 'id', label: 'Application No.' },
  { key: 'merchant', label: 'Merchant Name' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'email', label: 'Email' },
  { key: 'industry', label: 'Industry' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Application Time' },
];

const detailData = {
  id: 'OB20260801',
  merchant: 'Example Payment Co., Ltd.',
  contact: 'Zhang Wei',
  phone: '138-0000-0001',
  email: 'zhangwei@example.com',
  industry: 'FinTech',
  status: 'Approved',
  createdAt: '2026-08-01 09:12',
};

const formFields: MockField[] = [
  { key: 'merchant', label: 'Merchant Name' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'industry', label: 'Industry', type: 'select', options: ['FinTech', 'Cross-border Trade', 'Digital Assets', 'E-commerce'] },
  { key: 'status', label: 'Status', type: 'select', options: ['Pending Info', 'Under Review', 'Approved', 'Rejected'] },
];

export function OnboardListPage() {
  return (
    <MockListPage
      title="Onboarding Application"
      description="Onboarding applications for merchants connecting to the gateway"
      columns={columns}
      rows={mockRows}
    />
  );
}

export function OnboardDetailPage() {
  return <MockDetailPage title="Onboarding Application Details" fields={detailFields} data={detailData} />;
}

export function OnboardFormPage() {
  return <MockFormPage title="Edit Onboarding Application" fields={formFields} />;
}
