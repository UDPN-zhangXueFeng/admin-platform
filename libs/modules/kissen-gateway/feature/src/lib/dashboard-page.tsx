'use client';

import { MockDashboardPage } from './mock-components';

export function DashboardPage() {
  return (
    <MockDashboardPage
      title="仪表盘"
      description="Kissen Gateway 运营概览（Mock 数据）"
      stats={[
        { label: '交易总数', value: '12,480' },
        { label: '待处理交易', value: '36' },
        { label: '活跃货币对', value: '24' },
        { label: '活跃 LP', value: '8' },
      ]}
    />
  );
}
