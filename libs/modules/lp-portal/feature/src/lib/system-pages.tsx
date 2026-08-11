'use client';

import * as React from 'react';
import {
  Badge,
  MockDetailPage,
  MockFormPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from '@myorg/shared/ui';
/* ================================================================== *
 * System Management (sys group)
 * Path: /sys/user | /sys/role | /sys/menu
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * User Management (user)  list / create / edit / detail
 * ------------------------------------------------------------------ */

const userListColumns: MockColumn[] = [
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
];

const userListRows: Record<string, React.ReactNode>[] = [
  {
    username: 'lp-admin',
    name: 'Alice Zhang',
    role: 'System Administrator',
    email: 'admin@lp.example',
    status: <Badge>Enabled</Badge>,
  },
  {
    username: 'lp-ops',
    name: 'Brian Li',
    role: 'Operations',
    email: 'ops@lp.example',
    status: <Badge>Enabled</Badge>,
  },
  {
    username: 'lp-finance',
    name: 'Carol Wang',
    role: 'Finance',
    email: 'finance@lp.example',
    status: <Badge variant="secondary">Disabled</Badge>,
  },
];

const userDetailFields: MockField[] = [
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'lastLoginAt', label: 'Last Login' },
  { key: 'createdAt', label: 'Created At' },
];

const userDetailData: Record<string, React.ReactNode> = {
  username: 'lp-admin',
  name: 'Alice Zhang',
  role: 'System Administrator',
  email: 'admin@lp.example',
  phone: '138****0001',
  status: <Badge>Enabled</Badge>,
  lastLoginAt: '2026-08-10 08:00:00',
  createdAt: '2026-01-01 00:00:00',
};

const userFormFields: MockField[] = [
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role', type: 'select', options: ['System Administrator', 'Operations', 'Finance', 'Read-only'] },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status', type: 'select', options: ['Enabled', 'Disabled'] },
];

export function UserListPage() {
  return (
    <MockListPage
      title="User Management"
      description="Maintain LP Portal user accounts and roles"
      columns={userListColumns}
      rows={userListRows}
    />
  );
}

export function UserDetailPage() {
  return (
    <MockDetailPage title="User Detail" fields={userDetailFields} data={userDetailData} />
  );
}

export function UserFormPage() {
  return <MockFormPage title="User Edit" fields={userFormFields} />;
}

/* ------------------------------------------------------------------ *
 * Role Management (role)  list / create / edit / detail
 * ------------------------------------------------------------------ */

const roleListColumns: MockColumn[] = [
  { key: 'roleCode', label: 'Role Code' },
  { key: 'roleName', label: 'Role Name' },
  { key: 'userCount', label: 'User Count' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Updated At' },
];

const roleListRows: Record<string, React.ReactNode>[] = [
  {
    roleCode: 'LP_ADMIN',
    roleName: 'System Administrator',
    userCount: '2',
    status: <Badge>Enabled</Badge>,
    updatedAt: '2026-07-01 10:00:00',
  },
  {
    roleCode: 'LP_OPS',
    roleName: 'Operations',
    userCount: '5',
    status: <Badge>Enabled</Badge>,
    updatedAt: '2026-07-01 10:00:00',
  },
  {
    roleCode: 'LP_FINANCE',
    roleName: 'Finance',
    userCount: '3',
    status: <Badge>Enabled</Badge>,
    updatedAt: '2026-07-01 10:00:00',
  },
];

const roleDetailFields: MockField[] = [
  { key: 'roleCode', label: 'Role Code' },
  { key: 'roleName', label: 'Role Name' },
  { key: 'userCount', label: 'User Count' },
  { key: 'status', label: 'Status' },
  { key: 'remark', label: 'Remark' },
  { key: 'updatedAt', label: 'Updated At' },
];

const roleDetailData: Record<string, React.ReactNode> = {
  roleCode: 'LP_ADMIN',
  roleName: 'System Administrator',
  userCount: '2',
  status: <Badge>Enabled</Badge>,
  remark: 'Has all permissions',
  updatedAt: '2026-07-01 10:00:00',
};

const roleFormFields: MockField[] = [
  { key: 'roleCode', label: 'Role Code' },
  { key: 'roleName', label: 'Role Name' },
  { key: 'status', label: 'Status', type: 'select', options: ['Enabled', 'Disabled'] },
  { key: 'remark', label: 'Remark' },
];

export function RoleListPage() {
  return (
    <MockListPage
      title="Role Management"
      description="Maintain roles and menu/data permissions"
      columns={roleListColumns}
      rows={roleListRows}
    />
  );
}

export function RoleDetailPage() {
  return (
    <MockDetailPage title="Role Detail" fields={roleDetailFields} data={roleDetailData} />
  );
}

export function RoleFormPage() {
  return <MockFormPage title="Role Edit" fields={roleFormFields} />;
}

/* ------------------------------------------------------------------ *
 * Menu & Permissions (menu)  list (list only)
 * ------------------------------------------------------------------ */

const menuListColumns: MockColumn[] = [
  { key: 'menuCode', label: 'Menu Code' },
  { key: 'menuName', label: 'Menu Name' },
  { key: 'path', label: 'Path' },
  { key: 'group', label: 'Group' },
  { key: 'sort', label: 'Sort' },
  { key: 'status', label: 'Status' },
];

const menuListRows: Record<string, React.ReactNode>[] = [
  {
    menuCode: 'dashboard',
    menuName: 'Dashboard',
    path: '/dashboard',
    group: '-',
    sort: '1',
    status: <Badge>Enabled</Badge>,
  },
  {
    menuCode: 'pool',
    menuName: 'Liquidity Pool Management',
    path: '/pool',
    group: '-',
    sort: '2',
    status: <Badge>Enabled</Badge>,
  },
  {
    menuCode: 'user',
    menuName: 'User Management',
    path: '/sys/user',
    group: 'more',
    sort: '11',
    status: <Badge>Enabled</Badge>,
  },
];

export function MenuListPage() {
  return (
    <MockListPage
      title="Menu & Permissions"
      description="Maintain menu structure and visibility"
      columns={menuListColumns}
      rows={menuListRows}
    />
  );
}
