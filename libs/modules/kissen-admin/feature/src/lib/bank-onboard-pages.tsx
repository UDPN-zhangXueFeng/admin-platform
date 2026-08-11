'use client';

import {
  MockListPage,
  MockDetailPage,
  MockFormPage,
  Badge,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* bank-info — Bank Profile & Configuration                            */
/* ------------------------------------------------------------------ */

const bankInfoColumns: MockColumn[] = [
  { key: 'id', label: 'Bank ID' },
  { key: 'name', label: 'Bank Name' },
  { key: 'code', label: 'Clearing Code' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'status', label: 'Status' },
];

const bankInfoRows = [
  { id: 'BK001', name: 'Sample Bank A', code: 'CLRBK001', contact: 'Zhang San', status: <Badge>Enabled</Badge> },
  { id: 'BK002', name: 'Sample Bank B', code: 'CLRBK002', contact: 'Li Si', status: <Badge variant="secondary">Pending Review</Badge> },
  { id: 'BK003', name: 'Sample Bank C', code: 'CLRBK003', contact: 'Wang Wu', status: <Badge>Enabled</Badge> },
  { id: 'BK004', name: 'Sample Bank D', code: 'CLRBK004', contact: 'Zhao Liu', status: <Badge variant="destructive">Disabled</Badge> },
];

const bankInfoFields: MockField[] = [
  { key: 'id', label: 'Bank ID' },
  { key: 'name', label: 'Bank Name' },
  { key: 'code', label: 'Clearing Code' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'status', label: 'Status' },
  { key: 'settleAccount', label: 'Settlement Account' },
  { key: 'createdAt', label: 'Onboarding Time' },
];

const bankInfoData = {
  id: 'BK001',
  name: 'Sample Bank A',
  code: 'CLRBK001',
  contact: 'Zhang San',
  phone: '138-0000-0001',
  status: <Badge>Enabled</Badge>,
  settleAccount: '6228 4800 0000 0001',
  createdAt: '2026-07-01 09:00:00',
};

const bankInfoFormFields: MockField[] = [
  { key: 'name', label: 'Bank Name' },
  { key: 'code', label: 'Clearing Code' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'settleAccount', label: 'Settlement Account' },
];

export function BankInfoListPage() {
  return (
    <MockListPage
      title="Bank Profile & Configuration"
      description="Manage basic profiles and clearing configuration of onboarded banks"
      columns={bankInfoColumns}
      rows={bankInfoRows}
    />
  );
}

export function BankInfoDetailPage() {
  return <MockDetailPage title="Bank Details" fields={bankInfoFields} data={bankInfoData} />;
}

export function BankInfoFormPage() {
  return <MockFormPage title="Bank Profile Edit" fields={bankInfoFormFields} />;
}

/* ------------------------------------------------------------------ */
/* bank-approval — Onboarding Review & Enablement                      */
/* ------------------------------------------------------------------ */

const bankApprovalColumns: MockColumn[] = [
  { key: 'id', label: 'Application No.' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'type', label: 'Application Type' },
  { key: 'applicant', label: 'Applicant' },
  { key: 'status', label: 'Review Status' },
];

const bankApprovalRows = [
  { id: 'AP202608001', bankName: 'Sample Bank B', type: 'New Onboarding', applicant: 'Li Si', status: <Badge variant="secondary">Pending Review</Badge> },
  { id: 'AP202608002', bankName: 'Sample Bank A', type: 'Information Update', applicant: 'Zhang San', status: <Badge>Approved</Badge> },
  { id: 'AP202608003', bankName: 'Sample Bank C', type: 'Enablement Change', applicant: 'Wang Wu', status: <Badge variant="secondary">Pending Review</Badge> },
  { id: 'AP202608004', bankName: 'Sample Bank D', type: 'Disable Request', applicant: 'Zhao Liu', status: <Badge variant="destructive">Rejected</Badge> },
];

const bankApprovalFields: MockField[] = [
  { key: 'id', label: 'Application No.' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'type', label: 'Application Type' },
  { key: 'applicant', label: 'Applicant' },
  { key: 'applyTime', label: 'Application Time' },
  { key: 'reviewer', label: 'Reviewer' },
  { key: 'reviewTime', label: 'Review Time' },
  { key: 'status', label: 'Review Status' },
];

const bankApprovalData = {
  id: 'AP202608001',
  bankName: 'Sample Bank B',
  type: 'New Onboarding',
  applicant: 'Li Si',
  applyTime: '2026-08-05 14:20:00',
  reviewer: '—',
  reviewTime: '—',
  status: <Badge variant="secondary">Pending Review</Badge>,
};

export function BankApprovalListPage() {
  return <MockListPage title="Onboarding Review & Enablement" columns={bankApprovalColumns} rows={bankApprovalRows} />;
}

export function BankApprovalDetailPage() {
  return <MockDetailPage title="Review Details" fields={bankApprovalFields} data={bankApprovalData} />;
}

/* ------------------------------------------------------------------ */
/* gateway-register — Gateway Instance Registration                    */
/* ------------------------------------------------------------------ */

const gatewayRegisterColumns: MockColumn[] = [
  { key: 'id', label: 'Instance ID' },
  { key: 'name', label: 'Instance Name' },
  { key: 'region', label: 'Region' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'status', label: 'Status' },
];

const gatewayRegisterRows = [
  { id: 'GW001', name: 'gateway-prod-cn', region: 'East China 1', endpoint: 'https://gw-cn.example.com', status: <Badge>Running</Badge> },
  { id: 'GW002', name: 'gateway-prod-hk', region: 'Hong Kong', endpoint: 'https://gw-hk.example.com', status: <Badge>Running</Badge> },
  { id: 'GW003', name: 'gateway-sg', region: 'Singapore', endpoint: 'https://gw-sg.example.com', status: <Badge variant="secondary">Pending Enable</Badge> },
  { id: 'GW004', name: 'gateway-us', region: 'US West', endpoint: 'https://gw-us.example.com', status: <Badge variant="destructive">Disabled</Badge> },
];

const gatewayRegisterFields: MockField[] = [
  { key: 'id', label: 'Instance ID' },
  { key: 'name', label: 'Instance Name' },
  { key: 'region', label: 'Region' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'version', label: 'Gateway Version' },
  { key: 'bindBank', label: 'Bound Bank' },
  { key: 'createdAt', label: 'Registration Time' },
  { key: 'status', label: 'Status' },
];

const gatewayRegisterData = {
  id: 'GW001',
  name: 'gateway-prod-cn',
  region: 'East China 1',
  endpoint: 'https://gw-cn.example.com',
  version: '2.4.1',
  bindBank: 'Sample Bank A',
  createdAt: '2026-06-15 10:30:00',
  status: <Badge>Running</Badge>,
};

const gatewayRegisterFormFields: MockField[] = [
  { key: 'name', label: 'Instance Name' },
  { key: 'region', label: 'Region' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'version', label: 'Gateway Version' },
  { key: 'bindBank', label: 'Bound Bank' },
];

export function GatewayRegisterListPage() {
  return <MockListPage title="Gateway Instance Registration" columns={gatewayRegisterColumns} rows={gatewayRegisterRows} />;
}

export function GatewayRegisterDetailPage() {
  return <MockDetailPage title="Instance Details" fields={gatewayRegisterFields} data={gatewayRegisterData} />;
}

export function GatewayRegisterFormPage() {
  return <MockFormPage title="Gateway Instance Registration" fields={gatewayRegisterFormFields} />;
}
