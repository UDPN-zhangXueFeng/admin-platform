'use client';

import { useTranslations } from 'next-intl';

import {
  COMMON_TASK_STATUS_VALUES,
  SP_STATUS_VALUES,
  SUBMITTED_TX_STATUS_COLOR,
  USER_WALLET_STATE_VALUES,
} from './constants';
import { EMPTY_FIELD_VALUE } from './formatters';

/**
 * SP Access 状态 badge — 模块自洽 TONE_CLASS（不跨模块复用，呼应
 * approval-status-badge / wallet-status-badge 约定）。
 *
 * 色源与上游一致：
 * - spInfoState → i18n `sp_status_color_N`（0/1/2 词条齐备，SP_STATUS_VALUES
 *   白名单保证键存在），文案 `sp_status_N`。
 * - taskStatus（操作记录）→ i18n `approval_task_status_color_N`，文案
 *   `common_task_status_N`。
 * - 交易状态 → 本页 colorMap（SUBMITTED_TX_STATUS_COLOR），文案
 *   `common_task_status_N`。
 * - 钱包状态 → 固定色（上游 userWalletStatusColorMap），文案 `user_wallet_state_N`。
 *
 * 防御：next-intl 对缺失 key 会抛错，词表值集合外回退 EMPTY_FIELD_VALUE。
 */

/** antd 色名 → Tailwind badge class（唯一取色真源）。 */
const TONE_CLASS: Record<string, string> = {
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

/** 钱包状态固定色（上游 userWalletStatusColorMap） */
const USER_WALLET_STATE_COLOR: Record<number, string> = {
  0: 'processing',
  1: 'success',
  2: 'gray',
  3: 'error',
};

export type SpAccessBadgeKind = 'spStatus' | 'taskStatus' | 'txStatus' | 'walletStatus';

function isKnownValue(kind: SpAccessBadgeKind, status: number): boolean {
  if (kind === 'spStatus') return SP_STATUS_VALUES.has(status);
  if (kind === 'walletStatus') return USER_WALLET_STATE_VALUES.has(status);
  // taskStatus / txStatus 共用 common_task_status 词表
  return COMMON_TASK_STATUS_VALUES.has(status);
}

export interface SpAccessStatusBadgeProps {
  kind: SpAccessBadgeKind;
  status?: number | null;
}

export function SpAccessStatusBadge({ kind, status }: SpAccessStatusBadgeProps) {
  const t = useTranslations('modules.sp-access');

  if (status === null || status === undefined || !isKnownValue(kind, status)) {
    return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
  }

  let tone: string;
  let labelKey: string;
  if (kind === 'spStatus') {
    tone = t(`sp_status_color_${status}`);
    labelKey = `sp_status_${status}`;
  } else if (kind === 'walletStatus') {
    tone = USER_WALLET_STATE_COLOR[status] ?? 'default';
    labelKey = `user_wallet_state_${status}`;
  } else if (kind === 'txStatus') {
    tone = SUBMITTED_TX_STATUS_COLOR[status] ?? t(`approval_task_status_color_${status}`);
    labelKey = `common_task_status_${status}`;
  } else {
    tone = t(`approval_task_status_color_${status}`);
    labelKey = `common_task_status_${status}`;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone] ?? TONE_CLASS.default}`}
    >
      {t(labelKey)}
    </span>
  );
}
