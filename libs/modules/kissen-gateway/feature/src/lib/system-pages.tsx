'use client';

import { usePathname } from 'next/navigation';
import { MockDetailPage,
MockFormPage,
MockListPage,
type MockColumn,
type MockField, } from '@myorg/shared/ui'

/* -------------------------------- user ---------------------------------- */

const userColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Full Name' },
  { key: 'role', label: 'Role' },
  { key: 'department', label: 'Department' },
  { key: 'status', label: 'Status' },
];

const userRows = [
  { id: 'U001', username: 'admin', name: 'Administrator', role: 'Super Administrator', department: 'Operations', status: 'Active' },
  { id: 'U002', username: 'trader01', name: 'Zhang Wei', role: 'Trader', department: 'Trading', status: 'Active' },
  { id: 'U003', username: 'risk01', name: 'Li Na', role: 'Risk Control Specialist', department: 'Risk Control', status: 'Active' },
  { id: 'U004', username: 'ops02', name: 'Wang Qiang', role: 'Operations Specialist', department: 'Operations', status: 'Disabled' },
];

const userDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Mobile' },
  { key: 'role', label: 'Role' },
  { key: 'department', label: 'Department' },
  { key: 'status', label: 'Status' },
];

const userDetailData = {
  id: 'U002',
  username: 'trader01',
  name: 'Zhang Wei',
  email: 'zhangwei@example.com',
  phone: '138-0000-0001',
  role: 'Trader',
  department: 'Trading',
  status: 'Active',
};

const userFormFields: MockField[] = [
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Mobile' },
  { key: 'role', label: 'Role', type: 'select', options: ['Super Administrator', 'Trader', 'Risk Control Specialist', 'Operations Specialist'] },
  { key: 'department', label: 'Department', type: 'select', options: ['Operations', 'Trading', 'Risk Control', 'Tech'] },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Disabled'] },
];

export function UserListPage() {
  return (
    <MockListPage
      title="User Management"
      description="System user account management"
      columns={userColumns}
      rows={userRows}
    />
  );
}

export function UserDetailPage() {
  return <MockDetailPage title="User Details" fields={userDetailFields} data={userDetailData} />;
}

export function UserFormPage() {
  return <MockFormPage title="Edit User" fields={userFormFields} />;
}

/* -------------------------------- role ---------------------------------- */

const roleColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'code', label: 'Role Code' },
  { key: 'name', label: 'Role Name' },
  { key: 'users', label: 'User Count' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
];

const roleRows = [
  { id: 'R001', code: 'SUPER_ADMIN', name: 'Super Administrator', users: '1', description: 'Has all permissions', status: 'Active' },
  { id: 'R002', code: 'TRADER', name: 'Trader', users: '6', description: 'Trading-related operations', status: 'Active' },
  { id: 'R003', code: 'RISK', name: 'Risk Control Specialist', users: '3', description: 'Risk control review', status: 'Active' },
  { id: 'R004', code: 'OPS', name: 'Operations Specialist', users: '4', description: 'Daily operations', status: 'Active' },
];

const roleDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'code', label: 'Role Code' },
  { key: 'name', label: 'Role Name' },
  { key: 'users', label: 'User Count' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
];

function useRoleDetailData() {
  const pathname = usePathname();
  const segments = pathname.split('/');
  const id = segments[segments.length - 1];
  return roleRows.find((r) => r.id === id) ?? roleRows[0];
}

const roleFormFields: MockField[] = [
  { key: 'code', label: 'Role Code' },
  { key: 'name', label: 'Role Name' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Disabled'] },
];

export function RoleListPage() {
  return (
    <MockListPage
      title="Role Management"
      description="System roles and permission configuration"
      columns={roleColumns}
      rows={roleRows}
    />
  );
}

export function RoleDetailPage() {
  const data = useRoleDetailData();
  return <MockDetailPage title="Role Details" fields={roleDetailFields} data={data} />;
}

export function RoleFormPage() {
  return <MockFormPage title="Edit Role" fields={roleFormFields} />;
}

/* -------------------------------- menu ---------------------------------- */

const menuColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Menu Name' },
  { key: 'path', label: 'Path' },
  { key: 'icon', label: 'Icon' },
  { key: 'sort', label: 'Sort Order' },
  { key: 'visible', label: 'Visible' },
];

const menuRows = [
  { id: 'M001', name: 'Onboarding Application', path: '/onboard', icon: 'FileCheck2', sort: '1', visible: 'Yes' },
  { id: 'M002', name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', sort: '2', visible: 'Yes' },
  { id: 'M003', name: 'Transaction Records', path: '/tx', icon: 'Receipt', sort: '3', visible: 'Yes' },
  { id: 'M004', name: 'Business View', path: '/market/currencypair', icon: 'Coins', sort: '4', visible: 'Yes' },
  { id: 'M005', name: 'System Management', path: '/system/user', icon: 'Shield', sort: '5', visible: 'Yes' },
];

export function MenuListPage() {
  return (
    <MockListPage
      title="Menu Permission"
      description="System menus and access permissions"
      columns={menuColumns}
      rows={menuRows}
    />
  );
}

/* -------------------------------- log ----------------------------------- */

const logColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'operator', label: 'Operator' },
  { key: 'action', label: 'Action' },
  { key: 'target', label: 'Target' },
  { key: 'ip', label: 'IP' },
  { key: 'createdAt', label: 'Operation Time' },
];

const logRows = [
  { id: 'L001', operator: 'admin', action: 'Login', target: '—', ip: '10.0.0.1', createdAt: '2026-08-09 09:00:12' },
  { id: 'L002', operator: 'trader01', action: 'Create Transaction', target: 'TX20260801001', ip: '10.0.0.12', createdAt: '2026-08-09 09:30:45' },
  { id: 'L003', operator: 'risk01', action: 'Review', target: 'OB20260802', ip: '10.0.0.21', createdAt: '2026-08-09 10:15:08' },
  { id: 'L004', operator: 'admin', action: 'Update Rate', target: 'R001', ip: '10.0.0.1', createdAt: '2026-08-09 11:42:33' },
];

export function LogListPage() {
  return (
    <MockListPage
      title="Operation Log"
      description="System operation audit log"
      columns={logColumns}
      rows={logRows}
    />
  );
}
