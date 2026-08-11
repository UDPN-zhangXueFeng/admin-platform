'use client';

import { MockDashboardPage } from '@myorg/shared/ui'

/**
 * Operations Cockpit — top-level dashboard for the Kissen admin console.
 */
export function DashboardPage() {
  return (
    <MockDashboardPage
      title="Operations Cockpit"
      stats={[
        { label: 'In-Flight Transactions', value: '128' },
        { label: 'EXCEPTION Pending', value: '3' },
        { label: 'Water Level Alert LP', value: '2' },
        { label: 'Pending Approval', value: '5' },
      ]}
    />
  );
}
