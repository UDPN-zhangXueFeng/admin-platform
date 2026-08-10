'use client';

import { MockDashboardPage } from './mock-components';

/**
 * 工作台 —— LP Portal 运营驾驶舱。
 * KPI 项来自 configs/lp-portal.json 的 dashboard.widgets：
 * 资金池余额 / 水位告警 / 待补资 / 未读通知。
 */
export function DashboardPage() {
  return (
    <MockDashboardPage
      title="工作台"
      stats={[
        { label: '资金池余额', value: '¥ 12,580,300.00' },
        { label: '水位告警', value: '2' },
        { label: '待补资', value: '5' },
        { label: '未读通知', value: '7' },
      ]}
    />
  );
}
