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
/* freeze — Emergency Freeze / Unfreeze                                */
/* ------------------------------------------------------------------ */

const freezeColumns: MockColumn[] = [
  { key: 'id', label: 'Freeze ID' },
  { key: 'target', label: 'Frozen Target' },
  { key: 'type', label: 'Type' },
  { key: 'reason', label: 'Reason' },
  { key: 'operator', label: 'Operator' },
  { key: 'status', label: 'Status' },
];

const freezeRows = [
  { id: 'FZ001', target: 'LP004 (Sample LP Delta)', type: 'Liquidity Pool', reason: 'Suspicious Transaction', operator: 'Risk Manager', status: <Badge variant="destructive">Frozen</Badge> },
  { id: 'FZ002', target: 'BK004 (Sample Bank D)', type: 'Account', reason: 'Compliance Investigation', operator: 'Risk Manager', status: <Badge variant="destructive">Frozen</Badge> },
  { id: 'FZ003', target: 'TX20260810004', type: 'Single Transaction', reason: 'On-chain Anomaly', operator: 'Risk Manager', status: <Badge variant="destructive">Frozen</Badge> },
  { id: 'FZ004', target: 'LP003 (Sample LP Gamma)', type: 'Liquidity Pool', reason: 'Temporary Risk Control', operator: 'Risk Manager', status: <Badge>Unfrozen</Badge> },
];

const freezeFields: MockField[] = [
  { key: 'id', label: 'Freeze ID' },
  { key: 'target', label: 'Frozen Target' },
  { key: 'type', label: 'Type' },
  { key: 'reason', label: 'Reason' },
  { key: 'detail', label: 'Detail' },
  { key: 'operator', label: 'Operator' },
  { key: 'frozenAt', label: 'Freeze Time' },
  { key: 'unfrozenAt', label: 'Unfreeze Time' },
  { key: 'status', label: 'Status' },
];

const freezeData = {
  id: 'FZ001',
  target: 'LP004 (Sample LP Delta)',
  type: 'Liquidity Pool',
  reason: 'Suspicious Transaction',
  detail: 'Detected high-frequency small-amount anomalous transfers',
  operator: 'Risk Manager',
  frozenAt: '2026-08-09 22:00:00',
  unfrozenAt: '—',
  status: <Badge variant="destructive">Frozen</Badge>,
};

export function FreezeListPage() {
  return <MockListPage title="Emergency Freeze / Unfreeze" columns={freezeColumns} rows={freezeRows} />;
}

export function FreezeDetailPage() {
  return <MockDetailPage title="Freeze Details" fields={freezeFields} data={freezeData} />;
}

/* ------------------------------------------------------------------ */
/* monitor-rule — Monitor Rules                                        */
/* ------------------------------------------------------------------ */

const monitorRuleColumns: MockColumn[] = [
  { key: 'id', label: 'Rule ID' },
  { key: 'name', label: 'Rule Name' },
  { key: 'metric', label: 'Monitor Metric' },
  { key: 'threshold', label: 'Threshold' },
  { key: 'level', label: 'Alert Level' },
  { key: 'status', label: 'Status' },
];

const monitorRuleRows = [
  { id: 'MR001', name: 'Single Large Amount Alert', metric: 'Transaction Amount', threshold: '> 100,000', level: <Badge variant="destructive">High</Badge>, status: <Badge>Active</Badge> },
  { id: 'MR002', name: 'LP Low Water Level', metric: 'Pool Balance', threshold: '< Low Water Mark', level: <Badge variant="secondary">Medium</Badge>, status: <Badge>Active</Badge> },
  { id: 'MR003', name: 'High-Frequency Transaction', metric: 'Same-IP Frequency', threshold: '> 50/min', level: <Badge variant="secondary">Medium</Badge>, status: <Badge>Active</Badge> },
  { id: 'MR004', name: 'Rate Deviation', metric: 'Rate Deviation', threshold: '> 2%', level: <Badge variant="destructive">High</Badge>, status: <Badge variant="secondary">Disabled</Badge> },
];

const monitorRuleFields: MockField[] = [
  { key: 'id', label: 'Rule ID' },
  { key: 'name', label: 'Rule Name' },
  { key: 'metric', label: 'Monitor Metric' },
  { key: 'threshold', label: 'Threshold' },
  { key: 'window', label: 'Statistics Window' },
  { key: 'action', label: 'Trigger Action' },
  { key: 'level', label: 'Alert Level' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'status', label: 'Status' },
];

const monitorRuleData = {
  id: 'MR001',
  name: 'Single Large Amount Alert',
  metric: 'Transaction Amount',
  threshold: '> 100,000',
  window: 'Per Transaction',
  action: 'Manual Review',
  level: <Badge variant="destructive">High</Badge>,
  updatedAt: '2026-08-01 10:00:00',
  status: <Badge>Active</Badge>,
};

const monitorRuleFormFields: MockField[] = [
  { key: 'name', label: 'Rule Name' },
  { key: 'metric', label: 'Monitor Metric' },
  { key: 'threshold', label: 'Threshold' },
  { key: 'window', label: 'Statistics Window' },
  { key: 'action', label: 'Trigger Action' },
];

export function MonitorRuleListPage() {
  return <MockListPage title="Monitor Rules" columns={monitorRuleColumns} rows={monitorRuleRows} />;
}

export function MonitorRuleDetailPage() {
  return <MockDetailPage title="Monitor Rule Details" fields={monitorRuleFields} data={monitorRuleData} />;
}

export function MonitorRuleFormPage() {
  return <MockFormPage title="Monitor Rule Edit" fields={monitorRuleFormFields} />;
}

/* ------------------------------------------------------------------ */
/* monitor-hit — Hit Records                                           */
/* ------------------------------------------------------------------ */

const monitorHitColumns: MockColumn[] = [
  { key: 'id', label: 'Hit ID' },
  { key: 'ruleId', label: 'Rule' },
  { key: 'target', label: 'Hit Target' },
  { key: 'level', label: 'Alert Level' },
  { key: 'hitAt', label: 'Hit Time' },
  { key: 'status', label: 'Handling Status' },
];

const monitorHitRows = [
  { id: 'MH001', ruleId: 'MR001 Single Large Amount Alert', target: 'TX20260810005', level: <Badge variant="destructive">High</Badge>, hitAt: '2026-08-10 08:45:00', status: <Badge variant="secondary">Pending Handling</Badge> },
  { id: 'MH002', ruleId: 'MR002 LP Low Water Level', target: 'POOL003', level: <Badge variant="secondary">Medium</Badge>, hitAt: '2026-08-10 07:00:00', status: <Badge>Handled</Badge> },
  { id: 'MH003', ruleId: 'MR003 High-Frequency Transaction', target: 'IP 203.0.113.7', level: <Badge variant="secondary">Medium</Badge>, hitAt: '2026-08-09 23:30:00', status: <Badge>Handled</Badge> },
  { id: 'MH004', ruleId: 'MR001 Single Large Amount Alert', target: 'TX20260809100', level: <Badge variant="destructive">High</Badge>, hitAt: '2026-08-09 15:20:00', status: <Badge variant="destructive">Suspended</Badge> },
];

const monitorHitFields: MockField[] = [
  { key: 'id', label: 'Hit ID' },
  { key: 'ruleId', label: 'Rule' },
  { key: 'target', label: 'Hit Target' },
  { key: 'actualValue', label: 'Actual Value' },
  { key: 'threshold', label: 'Threshold' },
  { key: 'level', label: 'Alert Level' },
  { key: 'hitAt', label: 'Hit Time' },
  { key: 'handler', label: 'Handler' },
  { key: 'status', label: 'Handling Status' },
];

const monitorHitData = {
  id: 'MH001',
  ruleId: 'MR001 Single Large Amount Alert',
  target: 'TX20260810005',
  actualValue: '50,000',
  threshold: '> 100,000',
  level: <Badge variant="destructive">High</Badge>,
  hitAt: '2026-08-10 08:45:00',
  handler: '—',
  status: <Badge variant="secondary">Pending Handling</Badge>,
};

export function MonitorHitListPage() {
  return <MockListPage title="Hit Records" columns={monitorHitColumns} rows={monitorHitRows} />;
}

export function MonitorHitDetailPage() {
  return <MockDetailPage title="Hit Record Details" fields={monitorHitFields} data={monitorHitData} />;
}
