'use client';

import { MockDashboardPage } from '@myorg/shared/ui'

/**
 * Dashboard — LP Portal operations cockpit.
 * KPI items come from configs/lp-portal.json dashboard.widgets:
 * Liquidity pool balance / water-level alerts / pending top-ups / unread notifications.
 */
export function DashboardPage() {
  return (
    <MockDashboardPage
      title="Dashboard"
      stats={[
        { label: 'Liquidity Pool Balance', value: '¥ 12,580,300.00' },
        { label: 'Water Level Alert', value: '2' },
        { label: 'Pending Top-up', value: '5' },
        { label: 'Unread Notifications', value: '7' },
      ]}
    />
  );
}
