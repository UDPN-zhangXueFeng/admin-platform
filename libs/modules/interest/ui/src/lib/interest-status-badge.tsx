/**
 * Interest 状态 Badge 组件。
 *
 * 支持策略 4 态（POLICY_STATUS_MAP）和交易 8 态（颜色从 common namespace 取值）。
 * 策略状态直接使用 POLICY_STATUS_MAP 内置 color 映射；
 * 交易状态通过 `t('approval_task_status_color_${status}')` 从 common 取色。
 */
'use client';

import { Badge, type BadgeProps } from '@myorg/shared/ui';
import { useTranslations } from 'next-intl';
import { POLICY_STATUS_MAP } from '@myorg/modules/interest/util';

/**
 * 语义颜色 → Badge variant 映射。
 * shared/ui 的 Badge 只支持 default/secondary/destructive/outline/ghost/link，
 * 将原模块的 success/processing/gray/destructive 语义色映射到可用 variant。
 */
const COLOR_TO_VARIANT: Record<string, BadgeProps['variant']> = {
  success: 'default',
  processing: 'secondary',
  gray: 'outline',
  destructive: 'destructive',
};

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
      <Badge variant={COLOR_TO_VARIANT[config.color] ?? 'secondary'}>
        {t(config.label)}
      </Badge>
    );
  }

  // transaction variant 仅作占位：颜色/标签来自 common namespace，
  // 实际渲染由 <TransactionStatusBadge /> 承担（见下）。
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
    <Badge variant={COLOR_TO_VARIANT[colorVariant] ?? 'secondary'}>
      {ti(labelMap[status] || labelKey)}
    </Badge>
  );
}
