'use client';
import { Badge } from '@myorg/shared/ui';
import { useTranslations } from 'next-intl';
import { RULE_STATUS_MAP, SUSPICIOUS_STATUS_MAP } from '@myorg/modules/screening-monitoring/util';

export function ScreeningStatusBadge({ status, variant }: { status: number; variant: 'rule' | 'suspicious' }) {
  const t = useTranslations('modules.screening-monitoring');
  const map = variant === 'rule' ? RULE_STATUS_MAP : SUSPICIOUS_STATUS_MAP;
  const cfg = map[status];
  if (!cfg) return <span>{status}</span>;
  return <Badge variant={(cfg.color as 'success' | 'processing' | 'gray' | 'destructive') || 'gray'}>{t(cfg.label)}</Badge>;
}
