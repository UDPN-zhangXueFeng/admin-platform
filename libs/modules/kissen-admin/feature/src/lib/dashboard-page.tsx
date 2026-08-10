'use client';

import { MockDashboardPage } from './mock-components';

/**
 * 运营驾驶舱 — top-level dashboard for the Kissen admin console.
 */
export function DashboardPage() {
  return (
    <MockDashboardPage
      title="运营驾驶舱"
      stats={[
        { label: '在途交易', value: '128' },
        { label: 'EXCEPTION 待处理', value: '3' },
        { label: '水位告警 LP', value: '2' },
        { label: '待审批', value: '5' },
      ]}
    />
  );
}
