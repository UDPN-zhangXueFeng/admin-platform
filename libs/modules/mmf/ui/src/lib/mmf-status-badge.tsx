/**
 * MMF Status Badge — 通用状态标签。
 *
 * 按 status + 业务类型（accrual / settlement / settlement-wallet-record）
 * 从 util 层三套 COLOR 常量取色，映射到 Tailwind badge class。
 *
 * 迁移自源的 antd `<Tag color={approvalTaskStatus[status]}>` 渲染：
 *   - accrual（accrual/index + accrual/view）→ ACCRUAL_STATUS_COLOR（3 态）
 *   - settlement（settlement/index + settlement/view 基本信息状态）→ SETTLEMENT_STATUS_COLOR（6 态）
 *   - settlement-wallet-record（settlement/view Tab1 子表格）→ SETTLEMENT_WALLET_RECORD_STATUS_COLOR（4 态）
 *
 * 源色值为 antd 内置色名（orange / processing / success / error），
 * 本组件内部映射到 Tailwind badge class（与 suspense-status-badge 同模式，
 * 不依赖 @myorg/shared/ui 的 Badge —— 该库未导出 Badge）。
 *
 * 审批记录状态（settlement/view Tab2）色值走 i18n key `approval_task_status_color_${state}`，
 * 属全局 common 约定，不使用本组件（页面层自行渲染）。
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ACCRUAL_STATUS_COLOR,
  SETTLEMENT_STATUS_COLOR,
  SETTLEMENT_WALLET_RECORD_STATUS_COLOR,
  statusToneClass,
} from '@myorg/modules/mmf/util';

/** 业务类型 → 对应的 COLOR 映射表。 */
const COLOR_MAP_BY_KIND = {
  accrual: ACCRUAL_STATUS_COLOR,
  settlement: SETTLEMENT_STATUS_COLOR,
  'settlement-wallet-record': SETTLEMENT_WALLET_RECORD_STATUS_COLOR,
} as const;

/**
 * 业务类型 → i18n 文案 key 前缀（相对 modules.mmf 命名空间）。
 * 与 util 层 OPTIONS 的 labelKey 前缀保持一致。
 */
const LABEL_KEY_PREFIX: Record<MmfBadgeKind, string> = {
  accrual: 'status.mmf_distribution_status_',
  settlement: 'status.mmf_settlement_status_',
  'settlement-wallet-record': 'status.mmf_settlement_records_status_',
};

/** antd 色名 → Tailwind badge class 统一走 util.statusToneClass（消除重复映射）。 */

export type MmfBadgeKind = keyof typeof COLOR_MAP_BY_KIND;

export interface MmfStatusBadgeProps {
  /** 业务类型，决定取哪套 COLOR 映射 + 文案 key 前缀。 */
  kind: MmfBadgeKind;
  /** 后端状态码（5/10/15/20/30/35/40 之一，随业务类型不同）。 */
  status: number | undefined | null;
  /** 空值占位文案，默认 '--'。 */
  fallback?: React.ReactNode;
}

/**
 * 渲染单个 mmf 状态标签。status 缺失或未命中映射时回退为 fallback。
 *
 * 用法：
 * ```tsx
 * <MmfStatusBadge kind="accrual" status={row.status} />
 * <MmfStatusBadge kind="settlement" status={detail.status} />
 * <MmfStatusBadge kind="settlement-wallet-record" status={record.status} />
 * ```
 */
export function MmfStatusBadge({
  kind,
  status,
  fallback = '--',
}: MmfStatusBadgeProps) {
  const t = useTranslations('modules.mmf');

  if (status == null) {
    return <span className="text-sm text-muted-foreground">{fallback}</span>;
  }

  const colorMap = COLOR_MAP_BY_KIND[kind];
  const tone = colorMap[status];

  // 未命中映射时显示纯文案（用 status 兜底），无取色。
  const labelKey = `${LABEL_KEY_PREFIX[kind]}${status}`;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        tone ? statusToneClass(tone) : statusToneClass('default')
      }`}
    >
      {t(labelKey)}
    </span>
  );
}
