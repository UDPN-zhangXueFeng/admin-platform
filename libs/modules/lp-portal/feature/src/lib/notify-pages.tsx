'use client';

import * as React from 'react';
import { Badge, MockListPage, type MockColumn } from '@myorg/shared/ui';
/* ------------------------------------------------------------------ *
 * Notification Center (notify)
 * Menu label: Notification Center  Path: /notify  Group: more
 * Page keys: list (list only)
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'category', label: 'Category' },
  { key: 'level', label: 'Level' },
  { key: 'read', label: 'Status' },
  { key: 'createdAt', label: 'Time' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    title: 'POOL-HK-002 water level below threshold',
    category: 'Water Level Alert',
    level: <Badge variant="destructive">Urgent</Badge>,
    read: <Badge variant="secondary">Unread</Badge>,
    createdAt: '2026-08-10 09:00:00',
  },
  {
    title: 'Top-up TU-20260810-031 pending',
    category: 'Top-up',
    level: <Badge>Normal</Badge>,
    read: <Badge variant="secondary">Unread</Badge>,
    createdAt: '2026-08-10 07:45:00',
  },
  {
    title: 'USD/EUR exchange rate updated',
    category: 'Exchange Rate',
    level: <Badge>Normal</Badge>,
    read: <Badge>Read</Badge>,
    createdAt: '2026-08-09 18:00:00',
  },
];

export function NotifyListPage() {
  return (
    <MockListPage
      title="Notification Center"
      description="View system notifications such as water-level alerts, top-ups, and exchange rates"
      columns={listColumns}
      rows={listRows}
      actionLabel="Mark All as Read"
    />
  );
}
