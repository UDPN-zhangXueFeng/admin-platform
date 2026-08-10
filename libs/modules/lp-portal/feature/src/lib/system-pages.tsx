'use client';

import * as React from 'react';
import { Badge } from '@myorg/shared/ui';
import {
  MockDetailPage,
  MockFormPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from './mock-components';

/* ================================================================== *
 * 系统管理（sys 分组）
 * 路径：/sys/user | /sys/role | /sys/menu
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * 用户管理（user）  list / create / edit / detail
 * ------------------------------------------------------------------ */

const userListColumns: MockColumn[] = [
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'role', label: '角色' },
  { key: 'email', label: '邮箱' },
  { key: 'status', label: '状态' },
];

const userListRows: Record<string, React.ReactNode>[] = [
  {
    username: 'lp-admin',
    name: '张管理',
    role: '系统管理员',
    email: 'admin@lp.example',
    status: <Badge>启用</Badge>,
  },
  {
    username: 'lp-ops',
    name: '李运营',
    role: '运营',
    email: 'ops@lp.example',
    status: <Badge>启用</Badge>,
  },
  {
    username: 'lp-finance',
    name: '王财务',
    role: '财务',
    email: 'finance@lp.example',
    status: <Badge variant="secondary">停用</Badge>,
  },
];

const userDetailFields: MockField[] = [
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'role', label: '角色' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'status', label: '状态' },
  { key: 'lastLoginAt', label: '最后登录' },
  { key: 'createdAt', label: '创建时间' },
];

const userDetailData: Record<string, React.ReactNode> = {
  username: 'lp-admin',
  name: '张管理',
  role: '系统管理员',
  email: 'admin@lp.example',
  phone: '138****0001',
  status: <Badge>启用</Badge>,
  lastLoginAt: '2026-08-10 08:00:00',
  createdAt: '2026-01-01 00:00:00',
};

const userFormFields: MockField[] = [
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'role', label: '角色', type: 'select', options: ['系统管理员', '运营', '财务', '只读'] },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] },
];

export function UserListPage() {
  return (
    <MockListPage
      title="用户管理"
      description="维护 LP Portal 用户账号与角色"
      columns={userListColumns}
      rows={userListRows}
    />
  );
}

export function UserDetailPage() {
  return (
    <MockDetailPage title="用户详情" fields={userDetailFields} data={userDetailData} />
  );
}

export function UserFormPage() {
  return <MockFormPage title="用户编辑" fields={userFormFields} />;
}

/* ------------------------------------------------------------------ *
 * 角色管理（role）  list / create / edit / detail
 * ------------------------------------------------------------------ */

const roleListColumns: MockColumn[] = [
  { key: 'roleCode', label: '角色编码' },
  { key: 'roleName', label: '角色名称' },
  { key: 'userCount', label: '用户数' },
  { key: 'status', label: '状态' },
  { key: 'updatedAt', label: '更新时间' },
];

const roleListRows: Record<string, React.ReactNode>[] = [
  {
    roleCode: 'LP_ADMIN',
    roleName: '系统管理员',
    userCount: '2',
    status: <Badge>启用</Badge>,
    updatedAt: '2026-07-01 10:00:00',
  },
  {
    roleCode: 'LP_OPS',
    roleName: '运营',
    userCount: '5',
    status: <Badge>启用</Badge>,
    updatedAt: '2026-07-01 10:00:00',
  },
  {
    roleCode: 'LP_FINANCE',
    roleName: '财务',
    userCount: '3',
    status: <Badge>启用</Badge>,
    updatedAt: '2026-07-01 10:00:00',
  },
];

const roleDetailFields: MockField[] = [
  { key: 'roleCode', label: '角色编码' },
  { key: 'roleName', label: '角色名称' },
  { key: 'userCount', label: '用户数' },
  { key: 'status', label: '状态' },
  { key: 'remark', label: '备注' },
  { key: 'updatedAt', label: '更新时间' },
];

const roleDetailData: Record<string, React.ReactNode> = {
  roleCode: 'LP_ADMIN',
  roleName: '系统管理员',
  userCount: '2',
  status: <Badge>启用</Badge>,
  remark: '拥有全部权限',
  updatedAt: '2026-07-01 10:00:00',
};

const roleFormFields: MockField[] = [
  { key: 'roleCode', label: '角色编码' },
  { key: 'roleName', label: '角色名称' },
  { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] },
  { key: 'remark', label: '备注' },
];

export function RoleListPage() {
  return (
    <MockListPage
      title="角色管理"
      description="维护角色与菜单/数据权限"
      columns={roleListColumns}
      rows={roleListRows}
    />
  );
}

export function RoleDetailPage() {
  return (
    <MockDetailPage title="角色详情" fields={roleDetailFields} data={roleDetailData} />
  );
}

export function RoleFormPage() {
  return <MockFormPage title="角色编辑" fields={roleFormFields} />;
}

/* ------------------------------------------------------------------ *
 * 菜单与权限（menu）  list （仅列表）
 * ------------------------------------------------------------------ */

const menuListColumns: MockColumn[] = [
  { key: 'menuCode', label: '菜单编码' },
  { key: 'menuName', label: '菜单名称' },
  { key: 'path', label: '路径' },
  { key: 'group', label: '分组' },
  { key: 'sort', label: '排序' },
  { key: 'status', label: '状态' },
];

const menuListRows: Record<string, React.ReactNode>[] = [
  {
    menuCode: 'dashboard',
    menuName: '工作台',
    path: '/dashboard',
    group: '-',
    sort: '1',
    status: <Badge>启用</Badge>,
  },
  {
    menuCode: 'pool',
    menuName: '资金池管理',
    path: '/pool',
    group: '-',
    sort: '2',
    status: <Badge>启用</Badge>,
  },
  {
    menuCode: 'user',
    menuName: '用户管理',
    path: '/sys/user',
    group: 'more',
    sort: '11',
    status: <Badge>启用</Badge>,
  },
];

export function MenuListPage() {
  return (
    <MockListPage
      title="菜单与权限"
      description="维护菜单结构与可见性"
      columns={menuListColumns}
      rows={menuListRows}
    />
  );
}
