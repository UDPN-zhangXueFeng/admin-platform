'use client';
import { Badge, type BadgeProps } from '@myorg/shared/ui';
import { useTranslations } from 'next-intl';
import { RULE_STATUS_MAP, SUSPICIOUS_STATUS_MAP } from '@myorg/modules/screening-monitoring/util';

/**
 * Map 业务语义色 → Badge 支持的 variant。
 * shared/ui Badge 只暴露 default/secondary/destructive/outline/ghost/link，
 * 这里把状态色收敛到最接近的 variant，保持语义（红=危险/错误，灰=中性，主色=进行中）。
 */
const COLOR_TO_BADGE: Record<string, BadgeProps['variant']> = {
  destructive: 'destructive',
  error: 'destructive',
  success: 'secondary',
  processing: 'default',
  gray: 'outline',
  orange: 'secondary',
};

export function ScreeningStatusBadge({ status, variant }: { status: number; variant: 'rule' | 'suspicious' }) {
  const t = useTranslations('modules.screening-monitoring');
  const map = variant === 'rule' ? RULE_STATUS_MAP : SUSPICIOUS_STATUS_MAP;
  const cfg = map[status];
  if (!cfg) return <span>{status}</span>;
  return <Badge variant={COLOR_TO_BADGE[cfg.color] ?? 'secondary'}>{t(cfg.label)}</Badge>;
}
