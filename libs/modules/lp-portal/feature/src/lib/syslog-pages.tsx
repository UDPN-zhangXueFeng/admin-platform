'use client';

import * as React from 'react';
import { MockListPage,
type MockColumn, } from '@myorg/shared/ui'

/* ------------------------------------------------------------------ *
 * Operation Log (syslog)
 * Menu label: Operation Log  Path: /syslog  Group: more
 * Page keys: list (list only)
 * ------------------------------------------------------------------ */

const listColumns: MockColumn[] = [
  { key: 'operator', label: 'Operator' },
  { key: 'action', label: 'Action' },
  { key: 'module', label: 'Module' },
  { key: 'target', label: 'Target' },
  { key: 'ip', label: 'IP' },
  { key: 'createdAt', label: 'Time' },
];

const listRows: Record<string, React.ReactNode>[] = [
  {
    operator: 'lp-ops',
    action: 'Initiate Top-up',
    module: 'Top-up',
    target: 'TU-20260810-031',
    ip: '10.0.1.23',
    createdAt: '2026-08-10 07:45:00',
  },
  {
    operator: 'lp-admin',
    action: 'Update Water Mark',
    module: 'Liquidity Pool Management',
    target: 'POOL-CN-001',
    ip: '10.0.1.12',
    createdAt: '2026-08-09 18:20:00',
  },
  {
    operator: 'lp-finance',
    action: 'Export Settlement',
    module: 'Settlement',
    target: 'ST-202608-001',
    ip: '10.0.1.31',
    createdAt: '2026-08-09 10:05:00',
  },
];

export function SyslogListPage() {
  return (
    <MockListPage
      title="Operation Log"
      description="Audit key operation records of LP Portal users"
      columns={listColumns}
      rows={listRows}
      actionLabel="Export"
    />
  );
}
