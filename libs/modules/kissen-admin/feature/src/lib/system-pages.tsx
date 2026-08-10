'use client';

import {
  MockListPage,
  MockDetailPage,
  MockFormPage,
  type MockColumn,
  type MockField,
} from './mock-components';
import { Badge } from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* sys-user — 用户管理                                                 */
/* ------------------------------------------------------------------ */

const sysUserColumns: MockColumn[] = [
  { key: 'id', label: '用户 ID' },
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'role', label: '角色' },
  { key: 'status', label: '状态' },
];

const sysUserRows = [
  { id: 'U001', username: 'admin', name: '超级管理员', role: '系统管理员', status: <Badge>启用</Badge> },
  { id: 'U002', username: 'ops.manager', name: '运营主管', role: '运营管理员', status: <Badge>启用</Badge> },
  { id: 'U003', username: 'risk.manager', name: '风控主管', role: '风控管理员', status: <Badge>启用</Badge> },
  { id: 'U004', username: 'settle.user', name: '结算员', role: '结算管理员', status: <Badge variant="secondary">停用</Badge> },
  { id: 'U005', username: 'reviewer', name: '复核员', role: '复核员', status: <Badge>启用</Badge> },
];

const sysUserFields: MockField[] = [
  { key: 'id', label: '用户 ID' },
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'role', label: '角色' },
  { key: 'lastLoginAt', label: '最后登录' },
  { key: 'status', label: '状态' },
];

const sysUserData = {
  id: 'U001',
  username: 'admin',
  name: '超级管理员',
  email: 'admin@example.com',
  phone: '138-0000-0001',
  role: '系统管理员',
  lastLoginAt: '2026-08-10 08:00:00',
  status: <Badge>启用</Badge>,
};

const sysUserFormFields: MockField[] = [
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'role', label: '角色' },
];

export function SysUserListPage() {
  return <MockListPage title="用户管理" columns={sysUserColumns} rows={sysUserRows} />;
}

export function SysUserDetailPage() {
  return <MockDetailPage title="用户详情" fields={sysUserFields} data={sysUserData} />;
}

export function SysUserFormPage() {
  return <MockFormPage title="用户编辑" fields={sysUserFormFields} />;
}

/* ------------------------------------------------------------------ */
/* sys-role — 角色管理                                                 */
/* ------------------------------------------------------------------ */

const sysRoleColumns: MockColumn[] = [
  { key: 'id', label: '角色 ID' },
  { key: 'name', label: '角色名称' },
  { key: 'code', label: '角色编码' },
  { key: 'userCount', label: '用户数' },
  { key: 'status', label: '状态' },
];

const sysRoleRows = [
  { id: 'R001', name: '系统管理员', code: 'SYS_ADMIN', userCount: '1', status: <Badge>启用</Badge> },
  { id: 'R002', name: '运营管理员', code: 'OPS_ADMIN', userCount: '3', status: <Badge>启用</Badge> },
  { id: 'R003', name: '风控管理员', code: 'RISK_ADMIN', userCount: '2', status: <Badge>启用</Badge> },
  { id: 'R004', name: '结算管理员', code: 'SETTLE_ADMIN', userCount: '2', status: <Badge>启用</Badge> },
  { id: 'R005', name: '复核员', code: 'REVIEWER', userCount: '1', status: <Badge variant="secondary">停用</Badge> },
];

const sysRoleFields: MockField[] = [
  { key: 'id', label: '角色 ID' },
  { key: 'name', label: '角色名称' },
  { key: 'code', label: '角色编码' },
  { key: 'description', label: '描述' },
  { key: 'userCount', label: '用户数' },
  { key: 'permissionCount', label: '权限数' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'status', label: '状态' },
];

const sysRoleData = {
  id: 'R002',
  name: '运营管理员',
  code: 'OPS_ADMIN',
  description: '负责日常运营操作与审批',
  userCount: '3',
  permissionCount: '28',
  updatedAt: '2026-07-20 10:00:00',
  status: <Badge>启用</Badge>,
};

const sysRoleFormFields: MockField[] = [
  { key: 'name', label: '角色名称' },
  { key: 'code', label: '角色编码' },
  { key: 'description', label: '描述' },
];

export function SysRoleListPage() {
  return <MockListPage title="角色管理" columns={sysRoleColumns} rows={sysRoleRows} />;
}

export function SysRoleDetailPage() {
  return <MockDetailPage title="角色详情" fields={sysRoleFields} data={sysRoleData} />;
}

export function SysRoleFormPage() {
  return <MockFormPage title="角色编辑" fields={sysRoleFormFields} />;
}

/* ------------------------------------------------------------------ */
/* sys-menu — 菜单与接口权限                                           */
/* ------------------------------------------------------------------ */

const sysMenuColumns: MockColumn[] = [
  { key: 'id', label: '菜单 ID' },
  { key: 'name', label: '菜单名称' },
  { key: 'path', label: '路由' },
  { key: 'parentId', label: '父级' },
  { key: 'sort', label: '排序' },
  { key: 'status', label: '状态' },
];

const sysMenuRows = [
  { id: 'M01', name: '银行入网管理', path: '/bank-onboard', parentId: '—', sort: '2', status: <Badge>显示</Badge> },
  { id: 'M0101', name: '银行资料与配置', path: '/bank-onboard/bank-info', parentId: 'M01', sort: '1', status: <Badge>显示</Badge> },
  { id: 'M02', name: 'LP 入网与流动性', path: '/lp-liquidity', parentId: '—', sort: '3', status: <Badge>显示</Badge> },
  { id: 'M09', name: '系统管理', path: '/system', parentId: '—', sort: '9', status: <Badge>显示</Badge> },
  { id: 'M0901', name: '用户管理', path: '/system/sys-user', parentId: 'M09', sort: '1', status: <Badge>显示</Badge> },
];

export function SysMenuListPage() {
  return <MockListPage title="菜单与接口权限" columns={sysMenuColumns} rows={sysMenuRows} />;
}

/* ------------------------------------------------------------------ */
/* workflow-config — 审批流定义                                         */
/* ------------------------------------------------------------------ */

const workflowConfigColumns: MockColumn[] = [
  { key: 'id', label: '流程 ID' },
  { key: 'name', label: '流程名称' },
  { key: 'bizType', label: '业务类型' },
  { key: 'nodes', label: '节点数' },
  { key: 'version', label: '版本' },
  { key: 'status', label: '状态' },
];

const workflowConfigRows = [
  { id: 'WF001', name: '银行入网审批流', bizType: '银行入网', nodes: '3', version: 'v1.2', status: <Badge>已发布</Badge> },
  { id: 'WF002', name: '资金冻结审批流', bizType: '资金冻结', nodes: '2', version: 'v1.0', status: <Badge>已发布</Badge> },
  { id: 'WF003', name: '汇率配置审批流', bizType: '汇率配置', nodes: '2', version: 'v2.0', status: <Badge variant="secondary">草稿</Badge> },
  { id: 'WF004', name: '大额放行审批流', bizType: '大额放行', nodes: '3', version: 'v1.1', status: <Badge>已发布</Badge> },
];

const workflowConfigFields: MockField[] = [
  { key: 'id', label: '流程 ID' },
  { key: 'name', label: '流程名称' },
  { key: 'bizType', label: '业务类型' },
  { key: 'nodes', label: '节点数' },
  { key: 'nodeList', label: '节点列表' },
  { key: 'version', label: '版本' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'status', label: '状态' },
];

const workflowConfigData = {
  id: 'WF001',
  name: '银行入网审批流',
  bizType: '银行入网',
  nodes: '3',
  nodeList: '提交 → 运营复核 → 主管审批',
  version: 'v1.2',
  updatedAt: '2026-07-25 14:00:00',
  status: <Badge>已发布</Badge>,
};

const workflowConfigFormFields: MockField[] = [
  { key: 'name', label: '流程名称' },
  { key: 'bizType', label: '业务类型' },
  { key: 'nodes', label: '节点数', type: 'number' },
  { key: 'nodeList', label: '节点列表' },
];

export function WorkflowConfigListPage() {
  return <MockListPage title="审批流定义" columns={workflowConfigColumns} rows={workflowConfigRows} />;
}

export function WorkflowConfigDetailPage() {
  return <MockDetailPage title="审批流详情" fields={workflowConfigFields} data={workflowConfigData} />;
}

export function WorkflowConfigFormPage() {
  return <MockFormPage title="审批流编辑" fields={workflowConfigFormFields} />;
}

/* ------------------------------------------------------------------ */
/* scheduled-task — 定时任务监控                                       */
/* ------------------------------------------------------------------ */

const scheduledTaskColumns: MockColumn[] = [
  { key: 'id', label: '任务 ID' },
  { key: 'name', label: '任务名称' },
  { key: 'cron', label: 'Cron 表达式' },
  { key: 'lastRunAt', label: '上次执行' },
  { key: 'status', label: '状态' },
];

const scheduledTaskRows = [
  { id: 'JOB001', name: '日终结算汇总', cron: '0 0 23 * * ?', lastRunAt: '2026-08-09 23:00:00', status: <Badge>运行中</Badge> },
  { id: 'JOB002', name: '汇率定时推送', cron: '0 0 8 * * ?', lastRunAt: '2026-08-10 08:00:00', status: <Badge>运行中</Badge> },
  { id: 'JOB003', name: '水位告警巡检', cron: '0 */10 * * * ?', lastRunAt: '2026-08-10 08:50:00', status: <Badge>运行中</Badge> },
  { id: 'JOB004', name: '对账数据拉取', cron: '0 30 18 * * ?', lastRunAt: '2026-08-09 18:30:00', status: <Badge variant="destructive">异常</Badge> },
];

const scheduledTaskFields: MockField[] = [
  { key: 'id', label: '任务 ID' },
  { key: 'name', label: '任务名称' },
  { key: 'cron', label: 'Cron 表达式' },
  { key: 'lastRunAt', label: '上次执行' },
  { key: 'lastResult', label: '上次结果' },
  { key: 'nextRunAt', label: '下次执行' },
  { key: 'retryCount', label: '重试次数' },
  { key: 'status', label: '状态' },
];

const scheduledTaskData = {
  id: 'JOB004',
  name: '对账数据拉取',
  cron: '0 30 18 * * ?',
  lastRunAt: '2026-08-09 18:30:00',
  lastResult: '连接超时',
  nextRunAt: '2026-08-10 18:30:00',
  retryCount: '3',
  status: <Badge variant="destructive">异常</Badge>,
};

export function ScheduledTaskListPage() {
  return <MockListPage title="定时任务监控" columns={scheduledTaskColumns} rows={scheduledTaskRows} />;
}

export function ScheduledTaskDetailPage() {
  return <MockDetailPage title="定时任务详情" fields={scheduledTaskFields} data={scheduledTaskData} />;
}

/* ------------------------------------------------------------------ */
/* operate-log — 操作日志                                              */
/* ------------------------------------------------------------------ */

const operateLogColumns: MockColumn[] = [
  { key: 'id', label: '日志 ID' },
  { key: 'operator', label: '操作人' },
  { key: 'action', label: '操作' },
  { key: 'target', label: '对象' },
  { key: 'ip', label: 'IP' },
  { key: 'createdAt', label: '时间' },
];

const operateLogRows = [
  { id: 'LOG20260810001', operator: 'admin', action: '登录', target: '—', ip: '203.0.113.10', createdAt: '2026-08-10 08:00:00' },
  { id: 'LOG20260810002', operator: 'ops.manager', action: '审批通过', target: 'AV202608003', ip: '203.0.113.11', createdAt: '2026-08-10 09:30:00' },
  { id: 'LOG20260810003', operator: 'risk.manager', action: '冻结', target: 'LP004', ip: '203.0.113.12', createdAt: '2026-08-09 22:05:00' },
  { id: 'LOG20260810004', operator: 'settle.user', action: '确认结算单', target: 'SO20260810-CNA', ip: '203.0.113.13', createdAt: '2026-08-10 18:00:00' },
];

export function OperateLogListPage() {
  return <MockListPage title="操作日志" columns={operateLogColumns} rows={operateLogRows} />;
}
