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
/* lp-info — LP Profile & Initialization                               */
/* ------------------------------------------------------------------ */

const lpInfoColumns: MockColumn[] = [
  { key: 'id', label: 'LP ID' },
  { key: 'name', label: 'LP Name' },
  { key: 'type', label: 'Type' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'status', label: 'Status' },
];

const lpInfoRows = [
  { id: 'LP001', name: 'Sample LP Alpha', type: 'Institution', contact: 'Alice', status: <Badge>Activated</Badge> },
  { id: 'LP002', name: 'Sample LP Beta', type: 'Institution', contact: 'Bob', status: <Badge variant="secondary">Pending Initialization</Badge> },
  { id: 'LP003', name: 'Sample LP Gamma', type: 'Individual', contact: 'Carol', status: <Badge>Activated</Badge> },
  { id: 'LP004', name: 'Sample LP Delta', type: 'Institution', contact: 'Dave', status: <Badge variant="destructive">Frozen</Badge> },
];

const lpInfoFields: MockField[] = [
  { key: 'id', label: 'LP ID' },
  { key: 'name', label: 'LP Name' },
  { key: 'type', label: 'Type' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'settleAccount', label: 'Settlement Account' },
  { key: 'initializedAt', label: 'Initialization Time' },
  { key: 'status', label: 'Status' },
];

const lpInfoData = {
  id: 'LP001',
  name: 'Sample LP Alpha',
  type: 'Institution',
  contact: 'Alice',
  phone: '+1-555-0100',
  settleAccount: '0xAlpha0001…',
  initializedAt: '2026-07-10 11:00:00',
  status: <Badge>Activated</Badge>,
};

const lpInfoFormFields: MockField[] = [
  { key: 'name', label: 'LP Name' },
  { key: 'type', label: 'Type' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'settleAccount', label: 'Settlement Account' },
];

export function LpInfoListPage() {
  return (
    <MockListPage
      title="LP Profile & Initialization"
      description="Manage liquidity provider profiles and account initialization"
      columns={lpInfoColumns}
      rows={lpInfoRows}
    />
  );
}

export function LpInfoDetailPage() {
  return <MockDetailPage title="LP Details" fields={lpInfoFields} data={lpInfoData} />;
}

export function LpInfoFormPage() {
  return <MockFormPage title="LP Profile Edit" fields={lpInfoFormFields} />;
}

/* ------------------------------------------------------------------ */
/* lp-pool — Liquidity Pool Registration                               */
/* ------------------------------------------------------------------ */

const lpPoolColumns: MockColumn[] = [
  { key: 'id', label: 'Pool ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'currency', label: 'Currency' },
  { key: 'balance', label: 'Balance' },
  { key: 'status', label: 'Status' },
];

const lpPoolRows = [
  { id: 'POOL001', lpName: 'Sample LP Alpha', currency: 'USDT', balance: '1,200,000', status: <Badge>Available</Badge> },
  { id: 'POOL002', lpName: 'Sample LP Alpha', currency: 'USDC', balance: '850,000', status: <Badge>Available</Badge> },
  { id: 'POOL003', lpName: 'Sample LP Gamma', currency: 'USDT', balance: '420,000', status: <Badge variant="secondary">Low Water Level</Badge> },
  { id: 'POOL004', lpName: 'Sample LP Delta', currency: 'USDC', balance: '0', status: <Badge variant="destructive">Frozen</Badge> },
];

const lpPoolFields: MockField[] = [
  { key: 'id', label: 'Pool ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'currency', label: 'Currency' },
  { key: 'balance', label: 'Balance' },
  { key: 'lowWaterMark', label: 'Low Water Mark' },
  { key: 'highWaterMark', label: 'High Water Mark' },
  { key: 'createdAt', label: 'Registration Time' },
  { key: 'status', label: 'Status' },
];

const lpPoolData = {
  id: 'POOL001',
  lpName: 'Sample LP Alpha',
  currency: 'USDT',
  balance: '1,200,000',
  lowWaterMark: '200,000',
  highWaterMark: '2,000,000',
  createdAt: '2026-07-12 09:15:00',
  status: <Badge>Available</Badge>,
};

const lpPoolFormFields: MockField[] = [
  { key: 'lpName', label: 'Owning LP' },
  { key: 'currency', label: 'Currency' },
  { key: 'lowWaterMark', label: 'Low Water Mark', type: 'number' },
  { key: 'highWaterMark', label: 'High Water Mark', type: 'number' },
];

export function LpPoolListPage() {
  return <MockListPage title="Liquidity Pool Registration" columns={lpPoolColumns} rows={lpPoolRows} />;
}

export function LpPoolDetailPage() {
  return <MockDetailPage title="Liquidity Pool Details" fields={lpPoolFields} data={lpPoolData} />;
}

export function LpPoolFormPage() {
  return <MockFormPage title="Liquidity Pool Registration" fields={lpPoolFormFields} />;
}

/* ------------------------------------------------------------------ */
/* lp-preauth — Pre-authorization Management                           */
/* ------------------------------------------------------------------ */

const lpPreauthColumns: MockColumn[] = [
  { key: 'id', label: 'Authorization ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'scope', label: 'Authorization Scope' },
  { key: 'expireAt', label: 'Expiry Time' },
  { key: 'status', label: 'Status' },
];

const lpPreauthRows = [
  { id: 'PA001', lpName: 'Sample LP Alpha', scope: 'USDT/USD Transfer', expireAt: '2026-12-31', status: <Badge>Active</Badge> },
  { id: 'PA002', lpName: 'Sample LP Alpha', scope: 'USDC/USD Transfer', expireAt: '2026-12-31', status: <Badge>Active</Badge> },
  { id: 'PA003', lpName: 'Sample LP Gamma', scope: 'All-Currency Transfer', expireAt: '2026-09-30', status: <Badge variant="secondary">Expiring Soon</Badge> },
  { id: 'PA004', lpName: 'Sample LP Beta', scope: 'USDT/USD Transfer', expireAt: '2026-06-30', status: <Badge variant="destructive">Expired</Badge> },
];

const lpPreauthFields: MockField[] = [
  { key: 'id', label: 'Authorization ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'scope', label: 'Authorization Scope' },
  { key: 'grantedBy', label: 'Authorized By' },
  { key: 'grantedAt', label: 'Authorization Time' },
  { key: 'expireAt', label: 'Expiry Time' },
  { key: 'status', label: 'Status' },
];

const lpPreauthData = {
  id: 'PA001',
  lpName: 'Sample LP Alpha',
  scope: 'USDT/USD Transfer',
  grantedBy: 'Operations Manager',
  grantedAt: '2026-07-15 10:00:00',
  expireAt: '2026-12-31',
  status: <Badge>Active</Badge>,
};

const lpPreauthFormFields: MockField[] = [
  { key: 'lpName', label: 'Owning LP' },
  { key: 'scope', label: 'Authorization Scope' },
  { key: 'expireAt', label: 'Expiry Time', type: 'date' },
];

export function LpPreauthListPage() {
  return <MockListPage title="Pre-authorization Management" columns={lpPreauthColumns} rows={lpPreauthRows} />;
}

export function LpPreauthDetailPage() {
  return <MockDetailPage title="Pre-authorization Details" fields={lpPreauthFields} data={lpPreauthData} />;
}

export function LpPreauthFormPage() {
  return <MockFormPage title="Pre-authorization Edit" fields={lpPreauthFormFields} />;
}

/* ------------------------------------------------------------------ */
/* lp-currency-pair — Participating Currency Pairs                     */
/* ------------------------------------------------------------------ */

const lpCurrencyPairColumns: MockColumn[] = [
  { key: 'lpName', label: 'Owning LP' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'direction', label: 'Direction' },
  { key: 'status', label: 'Status' },
];

const lpCurrencyPairRows = [
  { lpName: 'Sample LP Alpha', pair: 'USDT/USD', direction: 'Bidirectional', status: <Badge>Participating</Badge> },
  { lpName: 'Sample LP Alpha', pair: 'USDC/USD', direction: 'Bidirectional', status: <Badge>Participating</Badge> },
  { lpName: 'Sample LP Gamma', pair: 'USDT/USD', direction: 'Buy Only', status: <Badge>Participating</Badge> },
  { lpName: 'Sample LP Delta', pair: 'BTC/USDT', direction: 'Bidirectional', status: <Badge variant="secondary">Paused</Badge> },
];

const lpCurrencyPairFields: MockField[] = [
  { key: 'lpName', label: 'Owning LP' },
  { key: 'pair', label: 'Currency Pair' },
  { key: 'direction', label: 'Direction' },
  { key: 'minAmount', label: 'Min Amount' },
  { key: 'maxAmount', label: 'Max Amount' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'status', label: 'Status' },
];

const lpCurrencyPairData = {
  lpName: 'Sample LP Alpha',
  pair: 'USDT/USD',
  direction: 'Bidirectional',
  minAmount: '100',
  maxAmount: '500,000',
  updatedAt: '2026-08-01 16:00:00',
  status: <Badge>Participating</Badge>,
};

export function LpCurrencyPairListPage() {
  return <MockListPage title="Participating Currency Pairs" columns={lpCurrencyPairColumns} rows={lpCurrencyPairRows} />;
}

export function LpCurrencyPairDetailPage() {
  return <MockDetailPage title="Currency Pair Participation Details" fields={lpCurrencyPairFields} data={lpCurrencyPairData} />;
}

/* ------------------------------------------------------------------ */
/* lp-topup — Top-up Records                                           */
/* ------------------------------------------------------------------ */

const lpTopupColumns: MockColumn[] = [
  { key: 'id', label: 'Record ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'currency', label: 'Currency' },
  { key: 'amount', label: 'Top-up Amount' },
  { key: 'txHash', label: 'On-chain Hash' },
  { key: 'status', label: 'Status' },
];

const lpTopupRows = [
  { id: 'TU202608001', lpName: 'Sample LP Alpha', currency: 'USDT', amount: '500,000', txHash: '0xabc…123', status: <Badge>Received</Badge> },
  { id: 'TU202608002', lpName: 'Sample LP Gamma', currency: 'USDT', amount: '200,000', txHash: '0xdef…456', status: <Badge variant="secondary">Confirming</Badge> },
  { id: 'TU202608003', lpName: 'Sample LP Alpha', currency: 'USDC', amount: '300,000', txHash: '0xghi…789', status: <Badge>Received</Badge> },
  { id: 'TU202608004', lpName: 'Sample LP Beta', currency: 'USDT', amount: '100,000', txHash: '0xjkl…0ab', status: <Badge variant="destructive">Failed</Badge> },
];

const lpTopupFields: MockField[] = [
  { key: 'id', label: 'Record ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'poolId', label: 'Liquidity Pool' },
  { key: 'currency', label: 'Currency' },
  { key: 'amount', label: 'Top-up Amount' },
  { key: 'txHash', label: 'On-chain Hash' },
  { key: 'confirmAt', label: 'Receipt Time' },
  { key: 'status', label: 'Status' },
];

const lpTopupData = {
  id: 'TU202608001',
  lpName: 'Sample LP Alpha',
  poolId: 'POOL001',
  currency: 'USDT',
  amount: '500,000',
  txHash: '0xabc…123',
  confirmAt: '2026-08-03 12:45:00',
  status: <Badge>Received</Badge>,
};

export function LpTopupListPage() {
  return <MockListPage title="Top-up Records" columns={lpTopupColumns} rows={lpTopupRows} />;
}

export function LpTopupDetailPage() {
  return <MockDetailPage title="Top-up Record Details" fields={lpTopupFields} data={lpTopupData} />;
}

/* ------------------------------------------------------------------ */
/* lp-water-level — Water Level Monitor                                */
/* ------------------------------------------------------------------ */

const lpWaterLevelColumns: MockColumn[] = [
  { key: 'poolId', label: 'Pool ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'currency', label: 'Currency' },
  { key: 'balance', label: 'Current Balance' },
  { key: 'lowWaterMark', label: 'Low Water Level' },
  { key: 'alert', label: 'Alert' },
];

const lpWaterLevelRows = [
  { poolId: 'POOL001', lpName: 'Sample LP Alpha', currency: 'USDT', balance: '1,200,000', lowWaterMark: '200,000', alert: <Badge variant="secondary">Normal</Badge> },
  { poolId: 'POOL002', lpName: 'Sample LP Alpha', currency: 'USDC', balance: '850,000', lowWaterMark: '200,000', alert: <Badge variant="secondary">Normal</Badge> },
  { poolId: 'POOL003', lpName: 'Sample LP Gamma', currency: 'USDT', balance: '180,000', lowWaterMark: '200,000', alert: <Badge variant="destructive">Below Threshold</Badge> },
  { poolId: 'POOL004', lpName: 'Sample LP Delta', currency: 'USDC', balance: '0', lowWaterMark: '100,000', alert: <Badge variant="destructive">Depleted</Badge> },
];

export function LpWaterLevelListPage() {
  return <MockListPage title="Water Level Monitor" columns={lpWaterLevelColumns} rows={lpWaterLevelRows} />;
}
