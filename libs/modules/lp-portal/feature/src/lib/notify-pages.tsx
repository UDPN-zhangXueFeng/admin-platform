'use client';

import * as React from 'react';
import { Badge } from '@myorg/shared/ui';
import {
  MockListPage,
  type MockColumn,
} from './mock-components';

/* ------------------------------------------------------------------ *
 * 通知中心（notify）
 * 菜单标签：通知中心  路径：/notify  分组：more
 * 页面键：list （仅列表）
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'title', label: '标题' },
  { key: 'category', label: '分类' },
  { key: 'level', label: '级别' },
  { key: 'read', label: '状态' },
  { key: 'createdAt', label: '时间' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    title: 'POOL-HK-002 水位低于阈值',
    category: '水位告警',
    level: <Badge variant="destructive">紧急</Badge>,
    read: <Badge variant="secondary">未读</Badge>,
    createdAt: '2026-08-10 09:00:00',
  },
  {
    title: '补资单 TU-20260810-031 待处理',
    category: '补资',
    level: <Badge>普通</Badge>,
    read: <Badge variant="secondary">未读</Badge>,
    createdAt: '2026-08-10 07:45:00',
  },
  {
    title: 'USD/EUR 汇率已更新',
    category: '汇率',
    level: <Badge>普通</Badge>,
    read: <Badge>已读</Badge>,
    createdAt: '2026-08-09 18:00:00',
  },
];

export function NotifyListPage() {
  return (
    <MockListPage
      title="通知中心"
      description="查看水位告警、补资、汇率等系统通知"
      columns={listColumns}
      rows={listRows}
      actionLabel="全部标记已读"
    />
  );
}
