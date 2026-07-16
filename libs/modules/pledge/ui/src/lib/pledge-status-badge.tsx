/**
 * Pledge Status Badge — pledge 模块统一状态标签。
 *
 * 封装源 new-view.tsx 传入 view-basic / view-asset-transactions /
 * view-operation-records 的三套状态色映射（statusColorsBasic /
 * statusColorsAssetTxn / 内嵌 statusDict）+ Summary 表的二态 Active/Inactive，
 * 渲染一个统一的 Tailwind 徽标，供各页复用（消除 list-page / view-asset-transactions /
 * view-operation-records 各自内嵌的 toneClass）。
 *
 * 配色模式（抄 cross-chain-status-badge / tokenized-deposit-status-badge 的 TONE_CLASS）：
 *   antd 色名（processing / error / success / orange / gray / default）
 *   → Tailwind border + background + text class。
 *
 * variant 决定色来源 + 文案来源：
 *   - reserve：基本信息卡储备资产状态。色走 i18n `statusColor.${status}`（与 list-page
 *     行 status Tag 一致），文案走 i18n `status.${status}`（10/15/20/50）。
 *   - assetTxn：资产交易状态。色走 util ASSET_TXN_STATUS_COLOR，文案走 i18n
 *     `txnStatus.${status}`（5/10/15/35）。
 *   - opRecord：操作记录状态。色走 util OP_RECORD_STATUS，文案走 i18n
 *     `opRecordStatus.${status}`（5/10/15/20）。
 *   - categoryActive：Summary 表资产类别二态。0=Inactive / 1=Active，色 gray/green，
 *     文案走 i18n `viewBasic.categoryActive.${status}`。
 *
 * i18n namespace: `modules.pledge`，key 不带额外前缀（页面已 useTranslations('modules.pledge')）。
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ASSET_TXN_STATUS_COLOR,
  OP_RECORD_STATUS,
} from '@myorg/modules/pledge/util';

// ── TONE_CLASS 映射（antd 色名 → Tailwind badge class）──

/**
 * antd 色名 → Tailwind badge class。
 *
 * 与 cross-chain / tokenized-deposit status-badge 保持一致的 Record，覆盖 pledge
 * 源码中所有可能出现的状态色名。未知色名回落 `default`（gray）。
 */
const TONE_CLASS: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

function toneClass(tone: string): string {
  return TONE_CLASS[tone] ?? TONE_CLASS.default;
}

// ── categoryActive 二态色（源 view-basic Summary 表 `['gray','success'][s]`）──

const CATEGORY_ACTIVE_TONE: Record<number, string> = {
  0: 'gray',
  1: 'success',
};

// ── variant ──

/** 状态维度，决定色来源 + 文案 i18n key。 */
export type PledgeBadgeVariant =
  | 'reserve'
  | 'assetTxn'
  | 'opRecord'
  | 'categoryActive';

export interface PledgeStatusBadgeProps {
  /** 业务维度。 */
  variant: PledgeBadgeVariant;
  /**
   * 后端状态码。
   * reserve：10/15/20/50；assetTxn：5/10/15/35；opRecord：5/10/15/20；
   * categoryActive：0/1。
   * 传 null/undefined 时回退 fallback 占位文案。
   */
  status?: number | null;
  /** 空值占位文案，默认 '--'。 */
  fallback?: React.ReactNode;
}

/**
 * 渲染单个 pledge 状态标签。
 *
 * 用法：
 * ```tsx
 * <PledgeStatusBadge variant="reserve" status={basicInfo.status} />
 * <PledgeStatusBadge variant="assetTxn" status={row.status} />
 * <PledgeStatusBadge variant="opRecord" status={record.status} />
 * <PledgeStatusBadge variant="categoryActive" status={row.status} />
 * ```
 */
export function PledgeStatusBadge({
  variant,
  status,
  fallback = '--',
}: PledgeStatusBadgeProps): React.JSX.Element {
  const t = useTranslations('modules.pledge');

  // null/undefined → fallback
  if (status == null) {
    return <span className="text-sm text-muted-foreground">{fallback}</span>;
  }

  // categoryActive：Summary 表二态，文案 + 色都走 i18n/常量
  if (variant === 'categoryActive') {
    const tone = CATEGORY_ACTIVE_TONE[status] ?? 'default';
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
          tone,
        )}`}
      >
        {t(`viewBasic.categoryActive.${status}`)}
      </span>
    );
  }

  // reserve：色 + 文案都走 i18n 动态 key（与 list-page 行 status 一致）
  if (variant === 'reserve') {
    const tone = t(`statusColor.${status}`);
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
          tone,
        )}`}
      >
        {t(`status.${status}`)}
      </span>
    );
  }

  // assetTxn：色走 util，文案走 i18n txnStatus
  if (variant === 'assetTxn') {
    const tone =
      ASSET_TXN_STATUS_COLOR[
        status as keyof typeof ASSET_TXN_STATUS_COLOR
      ] ?? 'default';
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
          tone,
        )}`}
      >
        {t(`txnStatus.${status}`)}
      </span>
    );
  }

  // opRecord：色 + 文案都走 util（OP_RECORD_STATUS 同时含 color + label）
  const info =
    OP_RECORD_STATUS[status as keyof typeof OP_RECORD_STATUS] ?? undefined;
  const tone = info?.color ?? 'default';
  const label =
    info?.label ?? t(`opRecordStatus.${status}`);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
        tone,
      )}`}
    >
      {label}
    </span>
  );
}
