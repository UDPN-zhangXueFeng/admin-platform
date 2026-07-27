/**
 * Interest 状态 Badge 组件。
 *
 * 支持策略 4 态（POLICY_STATUS_MAP）和交易 8 态（颜色从 common namespace 取值）。
 * 策略状态直接使用 POLICY_STATUS_MAP 内置 color 映射；
 * 交易状态通过 `t('approval_task_status_color_${status}')` 从 common 取色。
 */
'use client';

import { Badge } from '@myorg/shared/ui';
import { useTranslations } from 'next-intl';
import { POLICY_STATUS_MAP } from '@myorg/modules/interest/util';

export interface InterestStatusBadgeProps {
  status: number;
  /** 'policy' | 'transaction' — 决定颜色来源 */
  variant: 'policy' | 'transaction';
}

export function InterestStatusBadge({ status, variant }: InterestStatusBadgeProps) {
  const t = useTranslations('modules.interest');

  if (variant === 'policy') {
    const config = POLICY_STATUS_MAP[status];
    if (!config) return <span>{status}</span>;
    return (
      <Badge variant={config.color as 'success' | 'processing' | 'gray'}>
        {t(config.label)}
      </Badge>
    );
  }

  // transaction: 颜色从 common namespace 取
  const colorKey = `approval_task_status_color_${status}`;
  const labelKey = `common_task_status_${status}`;
  // 注意：这两个 key 在 common namespace 中，需要用 common 的 useTranslations
  // 此处通过 props 传入或使用 common namespace
  return <span>{status}</span>;
}

/**
 * 交易状态 Badge（颜色从 common namespace 取值）。
 * 使用 common namespace 的 `useTranslations('common')`。
 */
export function TransactionStatusBadge({ status }: { status: number }) {
  const tc = useTranslations('common');
  const ti = useTranslations('modules.interest');
  const labelKey = `common_task_status_${status}`;
  const colorVariant = tc(`approval_task_status_color_${status}`) as string;

  const labelMap: Record<number, string> = {
    1: 'interest_list_transaction_status_1',
    5: 'interest_list_transaction_status_5',
    10: 'interest_list_transaction_status_10',
    15: 'interest_list_transaction_status_15',
    20: 'interest_list_transaction_status_20',
    30: 'interest_list_transaction_status_30',
    35: 'interest_list_transaction_status_35',
    40: 'interest_list_transaction_status_40',
  };

  return (
    <Badge variant={colorVariant as 'success' | 'processing' | 'gray' | 'destructive'}>
      {ti(labelMap[status] || labelKey)}
    </Badge>
  );
}
