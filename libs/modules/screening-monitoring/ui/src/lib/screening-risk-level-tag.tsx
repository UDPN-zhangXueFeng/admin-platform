'use client';
import { useTranslations } from 'next-intl';
import { RISK_LEVEL_MAP } from '@myorg/modules/screening-monitoring/util';

export function ScreeningRiskLevelTag({ priority }: { priority: number }) {
  const t = useTranslations('modules.screening-monitoring');
  const colorMap: Record<number, string> = { 20: '#22c55e', 30: '#eab308', 40: '#ef4444' };
  return <span style={{ color: colorMap[priority] || '#6b7280', fontWeight: 500 }}>{t(RISK_LEVEL_MAP[priority] || String(priority))}</span>;
}
