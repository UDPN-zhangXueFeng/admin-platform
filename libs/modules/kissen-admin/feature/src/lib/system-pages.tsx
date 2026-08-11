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
/* sys-user — User Management                                          */
/* ------------------------------------------------------------------ */

const sysUserColumns: MockColumn[] = [
  { key: 'id', label: 'User ID' },
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
];

const sysUserRows = [
  { id: 'U001', username: 'admin', name: 'Super Administrator', role: 'System Administrator', status: <Badge>Enabled</Badge> },
  { id: 'U002', username: 'ops.manager', name: 'Operations Supervisor', role: 'Operations Manager', status: <Badge>Enabled</Badge> },
  { id: 'U003', username: 'risk.manager', name: 'Risk Supervisor', role: 'Risk Manager', status: <Badge>Enabled</Badge> },
  { id: 'U004', username: 'settle.user', name: 'Settlement Clerk', role: 'Settlement Manager', status: <Badge variant="secondary">Disabled</Badge> },
  { id: 'U005', username: 'reviewer', name: 'Reviewer', role: 'Reviewer', status: <Badge>Enabled</Badge> },
];

const sysUserFields: MockField[] = [
  { key: 'id', label: 'User ID' },
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
  { key: 'lastLoginAt', label: 'Last Login' },
  { key: 'status', label: 'Status' },
];

const sysUserData = {
  id: 'U001',
  username: 'admin',
  name: 'Super Administrator',
  email: 'admin@example.com',
  phone: '138-0000-0001',
  role: 'System Administrator',
  lastLoginAt: '2026-08-10 08:00:00',
  status: <Badge>Enabled</Badge>,
};

const sysUserFormFields: MockField[] = [
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
];

export function SysUserListPage() {
  return <MockListPage title="User Management" columns={sysUserColumns} rows={sysUserRows} />;
}

export function SysUserDetailPage() {
  return <MockDetailPage title="User Details" fields={sysUserFields} data={sysUserData} />;
}

export function SysUserFormPage() {
  return <MockFormPage title="User Edit" fields={sysUserFormFields} />;
}

/* ------------------------------------------------------------------ */
/* sys-role — Role Management                                          */
/* ------------------------------------------------------------------ */

const sysRoleColumns: MockColumn[] = [
  { key: 'id', label: 'Role ID' },
  { key: 'name', label: 'Role Name' },
  { key: 'code', label: 'Role Code' },
  { key: 'userCount', label: 'User Count' },
  { key: 'status', label: 'Status' },
];

const sysRoleRows = [
  { id: 'R001', name: 'System Administrator', code: 'SYS_ADMIN', userCount: '1', status: <Badge>Enabled</Badge> },
  { id: 'R002', name: 'Operations Manager', code: 'OPS_ADMIN', userCount: '3', status: <Badge>Enabled</Badge> },
  { id: 'R003', name: 'Risk Manager', code: 'RISK_ADMIN', userCount: '2', status: <Badge>Enabled</Badge> },
  { id: 'R004', name: 'Settlement Manager', code: 'SETTLE_ADMIN', userCount: '2', status: <Badge>Enabled</Badge> },
  { id: 'R005', name: 'Reviewer', code: 'REVIEWER', userCount: '1', status: <Badge variant="secondary">Disabled</Badge> },
];

const sysRoleFields: MockField[] = [
  { key: 'id', label: 'Role ID' },
  { key: 'name', label: 'Role Name' },
  { key: 'code', label: 'Role Code' },
  { key: 'description', label: 'Description' },
  { key: 'userCount', label: 'User Count' },
  { key: 'permissionCount', label: 'Permission Count' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'status', label: 'Status' },
];

const sysRoleData = {
  id: 'R002',
  name: 'Operations Manager',
  code: 'OPS_ADMIN',
  description: 'Responsible for daily operations and approvals',
  userCount: '3',
  permissionCount: '28',
  updatedAt: '2026-07-20 10:00:00',
  status: <Badge>Enabled</Badge>,
};

const sysRoleFormFields: MockField[] = [
  { key: 'name', label: 'Role Name' },
  { key: 'code', label: 'Role Code' },
  { key: 'description', label: 'Description' },
];

export function SysRoleListPage() {
  return <MockListPage title="Role Management" columns={sysRoleColumns} rows={sysRoleRows} />;
}

export function SysRoleDetailPage() {
  return <MockDetailPage title="Role Details" fields={sysRoleFields} data={sysRoleData} />;
}

export function SysRoleFormPage() {
  return <MockFormPage title="Role Edit" fields={sysRoleFormFields} />;
}

/* ------------------------------------------------------------------ */
/* sys-menu — Menu & API Permissions                                   */
/* ------------------------------------------------------------------ */

const sysMenuColumns: MockColumn[] = [
  { key: 'id', label: 'Menu ID' },
  { key: 'name', label: 'Menu Name' },
  { key: 'path', label: 'Route' },
  { key: 'parentId', label: 'Parent' },
  { key: 'sort', label: 'Sort Order' },
  { key: 'status', label: 'Status' },
];

const sysMenuRows = [
  { id: 'M01', name: 'Bank Onboarding Management', path: '/bank-onboard', parentId: '—', sort: '2', status: <Badge>Visible</Badge> },
  { id: 'M0101', name: 'Bank Profile & Configuration', path: '/bank-onboard/bank-info', parentId: 'M01', sort: '1', status: <Badge>Visible</Badge> },
  { id: 'M02', name: 'LP Onboarding & Liquidity', path: '/lp-liquidity', parentId: '—', sort: '3', status: <Badge>Visible</Badge> },
  { id: 'M09', name: 'System Management', path: '/system', parentId: '—', sort: '9', status: <Badge>Visible</Badge> },
  { id: 'M0901', name: 'User Management', path: '/system/sys-user', parentId: 'M09', sort: '1', status: <Badge>Visible</Badge> },
];

export function SysMenuListPage() {
  return <MockListPage title="Menu & API Permissions" columns={sysMenuColumns} rows={sysMenuRows} />;
}

/* ------------------------------------------------------------------ */
/* workflow-config — Approval Workflow Definition                      */
/* ------------------------------------------------------------------ */

const workflowConfigColumns: MockColumn[] = [
  { key: 'id', label: 'Workflow ID' },
  { key: 'name', label: 'Workflow Name' },
  { key: 'bizType', label: 'Business Type' },
  { key: 'nodes', label: 'Node Count' },
  { key: 'version', label: 'Version' },
  { key: 'status', label: 'Status' },
];

const workflowConfigRows = [
  { id: 'WF001', name: 'Bank Onboarding Workflow', bizType: 'Bank Onboarding', nodes: '3', version: 'v1.2', status: <Badge>Published</Badge> },
  { id: 'WF002', name: 'Fund Freeze Workflow', bizType: 'Fund Freeze', nodes: '2', version: 'v1.0', status: <Badge>Published</Badge> },
  { id: 'WF003', name: 'Rate Configuration Workflow', bizType: 'Rate Configuration', nodes: '2', version: 'v2.0', status: <Badge variant="secondary">Draft</Badge> },
  { id: 'WF004', name: 'Large Amount Release Workflow', bizType: 'Large Amount Release', nodes: '3', version: 'v1.1', status: <Badge>Published</Badge> },
];

const workflowConfigFields: MockField[] = [
  { key: 'id', label: 'Workflow ID' },
  { key: 'name', label: 'Workflow Name' },
  { key: 'bizType', label: 'Business Type' },
  { key: 'nodes', label: 'Node Count' },
  { key: 'nodeList', label: 'Node List' },
  { key: 'version', label: 'Version' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'status', label: 'Status' },
];

const workflowConfigData = {
  id: 'WF001',
  name: 'Bank Onboarding Workflow',
  bizType: 'Bank Onboarding',
  nodes: '3',
  nodeList: 'Submit → Operations Review → Supervisor Approval',
  version: 'v1.2',
  updatedAt: '2026-07-25 14:00:00',
  status: <Badge>Published</Badge>,
};

const workflowConfigFormFields: MockField[] = [
  { key: 'name', label: 'Workflow Name' },
  { key: 'bizType', label: 'Business Type' },
  { key: 'nodes', label: 'Node Count', type: 'number' },
  { key: 'nodeList', label: 'Node List' },
];

export function WorkflowConfigListPage() {
  return <MockListPage title="Approval Workflow Definition" columns={workflowConfigColumns} rows={workflowConfigRows} />;
}

export function WorkflowConfigDetailPage() {
  return <MockDetailPage title="Approval Workflow Details" fields={workflowConfigFields} data={workflowConfigData} />;
}

export function WorkflowConfigFormPage() {
  return <MockFormPage title="Approval Workflow Edit" fields={workflowConfigFormFields} />;
}

/* ------------------------------------------------------------------ */
/* scheduled-task — Scheduled Task Monitor                             */
/* ------------------------------------------------------------------ */

const scheduledTaskColumns: MockColumn[] = [
  { key: 'id', label: 'Task ID' },
  { key: 'name', label: 'Task Name' },
  { key: 'cron', label: 'Cron Expression' },
  { key: 'lastRunAt', label: 'Last Run' },
  { key: 'status', label: 'Status' },
];

const scheduledTaskRows = [
  { id: 'JOB001', name: 'End-of-Day Settlement Summary', cron: '0 0 23 * * ?', lastRunAt: '2026-08-09 23:00:00', status: <Badge>Running</Badge> },
  { id: 'JOB002', name: 'Scheduled Rate Push', cron: '0 0 8 * * ?', lastRunAt: '2026-08-10 08:00:00', status: <Badge>Running</Badge> },
  { id: 'JOB003', name: 'Water Level Alert Inspection', cron: '0 */10 * * * ?', lastRunAt: '2026-08-10 08:50:00', status: <Badge>Running</Badge> },
  { id: 'JOB004', name: 'Reconciliation Data Pull', cron: '0 30 18 * * ?', lastRunAt: '2026-08-09 18:30:00', status: <Badge variant="destructive">Error</Badge> },
];

const scheduledTaskFields: MockField[] = [
  { key: 'id', label: 'Task ID' },
  { key: 'name', label: 'Task Name' },
  { key: 'cron', label: 'Cron Expression' },
  { key: 'lastRunAt', label: 'Last Run' },
  { key: 'lastResult', label: 'Last Result' },
  { key: 'nextRunAt', label: 'Next Run' },
  { key: 'retryCount', label: 'Retry Count' },
  { key: 'status', label: 'Status' },
];

const scheduledTaskData = {
  id: 'JOB004',
  name: 'Reconciliation Data Pull',
  cron: '0 30 18 * * ?',
  lastRunAt: '2026-08-09 18:30:00',
  lastResult: 'Connection Timeout',
  nextRunAt: '2026-08-10 18:30:00',
  retryCount: '3',
  status: <Badge variant="destructive">Error</Badge>,
};

export function ScheduledTaskListPage() {
  return <MockListPage title="Scheduled Task Monitor" columns={scheduledTaskColumns} rows={scheduledTaskRows} />;
}

export function ScheduledTaskDetailPage() {
  return <MockDetailPage title="Scheduled Task Details" fields={scheduledTaskFields} data={scheduledTaskData} />;
}

/* ------------------------------------------------------------------ */
/* operate-log — Operation Log                                         */
/* ------------------------------------------------------------------ */

const operateLogColumns: MockColumn[] = [
  { key: 'id', label: 'Log ID' },
  { key: 'operator', label: 'Operator' },
  { key: 'action', label: 'Action' },
  { key: 'target', label: 'Target' },
  { key: 'ip', label: 'IP' },
  { key: 'createdAt', label: 'Time' },
];

const operateLogRows = [
  { id: 'LOG20260810001', operator: 'admin', action: 'Login', target: '—', ip: '203.0.113.10', createdAt: '2026-08-10 08:00:00' },
  { id: 'LOG20260810002', operator: 'ops.manager', action: 'Approval Passed', target: 'AV202608003', ip: '203.0.113.11', createdAt: '2026-08-10 09:30:00' },
  { id: 'LOG20260810003', operator: 'risk.manager', action: 'Freeze', target: 'LP004', ip: '203.0.113.12', createdAt: '2026-08-09 22:05:00' },
  { id: 'LOG20260810004', operator: 'settle.user', action: 'Confirm Settlement Order', target: 'SO20260810-CNA', ip: '203.0.113.13', createdAt: '2026-08-10 18:00:00' },
];

export function OperateLogListPage() {
  return <MockListPage title="Operation Log" columns={operateLogColumns} rows={operateLogRows} />;
}
