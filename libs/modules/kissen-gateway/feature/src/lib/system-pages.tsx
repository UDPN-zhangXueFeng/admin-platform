'use client';

import { usePathname } from 'next/navigation';
import {
  MockDetailPage,
  MockFormPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from './mock-components';

/* -------------------------------- user ---------------------------------- */

const userColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'role', label: '角色' },
  { key: 'department', label: '部门' },
  { key: 'status', label: '状态' },
];

const userRows = [
  { id: 'U001', username: 'admin', name: '管理员', role: '超级管理员', department: '运营', status: '启用' },
  { id: 'U002', username: 'trader01', name: '张伟', role: '交易员', department: '交易', status: '启用' },
  { id: 'U003', username: 'risk01', name: '李娜', role: '风控专员', department: '风控', status: '启用' },
  { id: 'U004', username: 'ops02', name: '王强', role: '运营专员', department: '运营', status: '停用' },
];

const userDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'role', label: '角色' },
  { key: 'department', label: '部门' },
  { key: 'status', label: '状态' },
];

const userDetailData = {
  id: 'U002',
  username: 'trader01',
  name: '张伟',
  email: 'zhangwei@example.com',
  phone: '138-0000-0001',
  role: '交易员',
  department: '交易',
  status: '启用',
};

const userFormFields: MockField[] = [
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'role', label: '角色', type: 'select', options: ['超级管理员', '交易员', '风控专员', '运营专员'] },
  { key: 'department', label: '部门', type: 'select', options: ['运营', '交易', '风控', '技术'] },
  { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] },
];

export function UserListPage() {
  return (
    <MockListPage
      title="用户管理"
      description="系统用户账号管理"
      columns={userColumns}
      rows={userRows}
    />
  );
}

export function UserDetailPage() {
  return <MockDetailPage title="用户详情" fields={userDetailFields} data={userDetailData} />;
}

export function UserFormPage() {
  return <MockFormPage title="用户编辑" fields={userFormFields} />;
}

/* -------------------------------- role ---------------------------------- */

const roleColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'code', label: '角色编码' },
  { key: 'name', label: '角色名称' },
  { key: 'users', label: '用户数' },
  { key: 'description', label: '描述' },
  { key: 'status', label: '状态' },
];

const roleRows = [
  { id: 'R001', code: 'SUPER_ADMIN', name: '超级管理员', users: '1', description: '拥有全部权限', status: '启用' },
  { id: 'R002', code: 'TRADER', name: '交易员', users: '6', description: '交易相关操作', status: '启用' },
  { id: 'R003', code: 'RISK', name: '风控专员', users: '3', description: '风控审核', status: '启用' },
  { id: 'R004', code: 'OPS', name: '运营专员', users: '4', description: '日常运营', status: '启用' },
];

const roleDetailFields: MockField[] = [
  { key: 'id', label: 'ID' },
  { key: 'code', label: '角色编码' },
  { key: 'name', label: '角色名称' },
  { key: 'users', label: '用户数' },
  { key: 'description', label: '描述' },
  { key: 'status', label: '状态' },
];

function useRoleDetailData() {
  const pathname = usePathname();
  const segments = pathname.split('/');
  const id = segments[segments.length - 1];
  return roleRows.find((r) => r.id === id) ?? roleRows[0];
}

const roleFormFields: MockField[] = [
  { key: 'code', label: '角色编码' },
  { key: 'name', label: '角色名称' },
  { key: 'description', label: '描述' },
  { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] },
];

export function RoleListPage() {
  return (
    <MockListPage
      title="角色管理"
      description="系统角色与权限配置"
      columns={roleColumns}
      rows={roleRows}
    />
  );
}

export function RoleDetailPage() {
  const data = useRoleDetailData();
  return <MockDetailPage title="角色详情" fields={roleDetailFields} data={data} />;
}

export function RoleFormPage() {
  return <MockFormPage title="角色编辑" fields={roleFormFields} />;
}

/* -------------------------------- menu ---------------------------------- */

const menuColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: '菜单名称' },
  { key: 'path', label: '路径' },
  { key: 'icon', label: '图标' },
  { key: 'sort', label: '排序' },
  { key: 'visible', label: '可见' },
];

const menuRows = [
  { id: 'M001', name: '入网申请', path: '/onboard', icon: 'FileCheck2', sort: '1', visible: '是' },
  { id: 'M002', name: '仪表盘', path: '/dashboard', icon: 'LayoutDashboard', sort: '2', visible: '是' },
  { id: 'M003', name: '交易记录', path: '/tx', icon: 'Receipt', sort: '3', visible: '是' },
  { id: 'M004', name: '业务查看', path: '/market/currencypair', icon: 'Coins', sort: '4', visible: '是' },
  { id: 'M005', name: '系统管理', path: '/system/user', icon: 'Shield', sort: '5', visible: '是' },
];

export function MenuListPage() {
  return (
    <MockListPage
      title="菜单权限"
      description="系统菜单与访问权限"
      columns={menuColumns}
      rows={menuRows}
    />
  );
}

/* -------------------------------- log ----------------------------------- */

const logColumns: MockColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'operator', label: '操作人' },
  { key: 'action', label: '操作' },
  { key: 'target', label: '对象' },
  { key: 'ip', label: 'IP' },
  { key: 'createdAt', label: '操作时间' },
];

const logRows = [
  { id: 'L001', operator: 'admin', action: '登录', target: '—', ip: '10.0.0.1', createdAt: '2026-08-09 09:00:12' },
  { id: 'L002', operator: 'trader01', action: '新建交易', target: 'TX20260801001', ip: '10.0.0.12', createdAt: '2026-08-09 09:30:45' },
  { id: 'L003', operator: 'risk01', action: '审核', target: 'OB20260802', ip: '10.0.0.21', createdAt: '2026-08-09 10:15:08' },
  { id: 'L004', operator: 'admin', action: '更新汇率', target: 'R001', ip: '10.0.0.1', createdAt: '2026-08-09 11:42:33' },
];

export function LogListPage() {
  return (
    <MockListPage
      title="操作日志"
      description="系统操作审计日志"
      columns={logColumns}
      rows={logRows}
    />
  );
}
