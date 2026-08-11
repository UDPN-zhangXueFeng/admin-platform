'use client';

import { MockDashboardPage } from '@myorg/shared/ui'

export function DashboardPage() {
  return (
    <MockDashboardPage
      title="Dashboard"
      description="Kissen Gateway operations overview (Mock data)"
      stats={[
        { label: 'Total Transactions', value: '12,480' },
        { label: 'Pending Transactions', value: '36' },
        { label: 'Active Currency Pairs', value: '24' },
        { label: 'Active LP', value: '8' },
      ]}
    />
  );
}
