'use client';

import * as React from 'react';
import {
  MockListPage,
  type MockColumn,
} from './mock-components';

/* ------------------------------------------------------------------ *
 * 操作日志（syslog）
 * 菜单标签：操作日志  路径：/syslog  分组：more
 * 页面键：list （仅列表）
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'operator', label: '操作人' },
  { key: 'action', label: '操作' },
  { key: 'module', label: '模块' },
  { key: 'target', label: '对象' },
  { key: 'ip', label: 'IP' },
  { key: 'createdAt', label: '时间' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    operator: 'lp-ops',
    action: '发起补资',
    module: '补资',
    target: 'TU-20260810-031',
    ip: '10.0.1.23',
    createdAt: '2026-08-10 07:45:00',
  },
  {
    operator: 'lp-admin',
    action: '修改水位线',
    module: '资金池管理',
    target: 'POOL-CN-001',
    ip: '10.0.1.12',
    createdAt: '2026-08-09 18:20:00',
  },
  {
    operator: 'lp-finance',
    action: '导出结算单',
    module: '结算',
    target: 'ST-202608-001',
    ip: '10.0.1.31',
    createdAt: '2026-08-09 10:05:00',
  },
];

export function SyslogListPage() {
  return (
    <MockListPage
      title="操作日志"
      description="审计 LP Portal 用户的关键操作记录"
      columns={listColumns}
      rows={listRows}
      actionLabel="导出"
    />
  );
}
