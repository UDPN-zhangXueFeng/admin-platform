/**
 * Tokenized Deposit Status Badge — 多维度状态标签。
 *
 * 按 dimension 取不同的颜色来源 + i18n 文案前缀，渲染一个统一的 Tailwind 徽标。
 *
 * 配色模式（抄 cross-chain-status-badge TONE_CLASS）：
 *   antd 色名（success/processing/error/orange/gray 等）→ Tailwind border+background+text class。
 *
 * 支持维度：
 *   - task：任务/记录/钱包/操作状态。色走 i18n `approval_task_status_color_*`，文案走 i18n `common_task_status_*`。
 *   - smartContract：智能合约状态。色走 i18n `smart_contract_status_color_*`，文案走 i18n `smart_contract_status_*`。
 *   - step：部署步骤状态。色走前端硬色 STEP_STATUS_COLOR（3/4/default），文案走 i18n `step_status_*`。
 *   - tdState：TD 启停状态图标色（TD_STATE_ICON_COLOR），仅纯色标识，无文案（概览卡独立图标组件用）。
 *   - roleWallet：角色钱包状态。variant 映射（Unconfigured→default / Processing→processing / Active→success），文案走 i18n `role_wallet_status_*`。
 *
 * i18n namespace: `modules.tokenized-deposit`，key 不带额外前缀。
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  TASK_STATUS_COLOR_KEY_PREFIX,
  TASK_STATUS_LABEL_KEY_PREFIX,
  SMART_CONTRACT_STATUS_COLOR_KEY_PREFIX,
  SMART_CONTRACT_STATUS_LABEL_KEY_PREFIX,
  STEP_STATUS_COLOR,
  STEP_STATUS_DEFAULT_COLOR,
  STEP_STATUS_KEY_PREFIX,
  TD_STATE_ICON_COLOR,
  ROLE_WALLET_STATUS_KEY_PREFIX,
} from '@myorg/modules/tokenized-deposit/util';

// ── TONE_CLASS 映射（antd 色名 → Tailwind class）──

/**
 * antd 色名 → Tailwind badge class。
 *
 * 与 cross-chain-status-badge 保持一致的 Record，覆盖源码中所有可能的
 * 状态色名。未知色名回落 `default`（gray）。
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

/** 硬编码颜色值（#rrggbb）→ 内联 style（step / tdState 维度用）。 */
function hexToTailwindStyle(hex: string): React.CSSProperties {
  return {
    borderColor: hex,
    backgroundColor: `${hex}1A`, // 10% opacity
    color: hex,
  };
}

// ── Role Wallet variant 映射 ──

/** 角色钱包 status 字符串 → antd 色名。 */
const ROLE_WALLET_VARIANT_MAP: Record<string, string> = {
  unconfigured: 'default',
  processing: 'processing',
  active: 'success',
};

// ── Props ──

export type TokenizedDepositBadgeDimension =
  | 'task'
  | 'smartContract'
  | 'step'
  | 'tdState'
  | 'roleWallet';

export interface TokenizedDepositStatusBadgeProps {
  /**
   * 业务维度，决定颜色来源 + 文案前缀 + 渲染策略。
   */
  dimension: TokenizedDepositBadgeDimension;
  /**
   * 状态值。
   * - task/smartContract/step/tdState：number 状态码。
   * - roleWallet：status 字符串（'unconfigured' | 'processing' | 'active'）。
   * 传 null/undefined 时显示 fallback 占位符。
   */
  status?: number | string | null;
  /** 空值占位文案，默认 '--'。 */
  fallback?: React.ReactNode;
}

// ── 组件 ──

/**
 * 渲染单个 tokenized-deposit 状态标签。
 *
 * 用法：
 * ```tsx
 * <TokenizedDepositStatusBadge dimension="task" status={row.applyStatus} />
 * <TokenizedDepositStatusBadge dimension="smartContract" status={row.state} />
 * <TokenizedDepositStatusBadge dimension="step" status={row.stepStatus} />
 * <TokenizedDepositStatusBadge dimension="roleWallet" status="active" />
 * ```
 */
export function TokenizedDepositStatusBadge({
  dimension,
  status,
  fallback = '--',
}: TokenizedDepositStatusBadgeProps) {
  const t = useTranslations('modules.tokenized-deposit');

  // ── null/undefined → fallback ──
  if (status == null) {
    return <span className="text-sm text-muted-foreground">{fallback}</span>;
  }

  // ── tdState：纯色标识，无文案（概览卡图标组件自行处理） ──
  if (dimension === 'tdState') {
    const hex = TD_STATE_ICON_COLOR[Number(status)] ?? '#666666';
    return (
      <span
        style={hexToTailwindStyle(hex)}
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
      >
        {/* 纯色点，文案由调用方在卡片区域自行渲染 */}
      </span>
    );
  }

  // ── step：前端硬色 + i18n 文案 ──
  if (dimension === 'step') {
    const colorHex =
      STEP_STATUS_COLOR[Number(status)] ?? STEP_STATUS_DEFAULT_COLOR;
    const labelKey = `${STEP_STATUS_KEY_PREFIX}${status}`;
    const label = t(labelKey);

    return (
      <span
        style={hexToTailwindStyle(colorHex)}
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
      >
        {label}
      </span>
    );
  }

  // ── roleWallet：variant 映射 + i18n 文案 ──
  if (dimension === 'roleWallet') {
    const statusStr = String(status).toLowerCase();
    const variant = ROLE_WALLET_VARIANT_MAP[statusStr] ?? 'default';
    const labelKey = `${ROLE_WALLET_STATUS_KEY_PREFIX}${statusStr}`;
    const label = t(labelKey);

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
          variant,
        )}`}
      >
        {label}
      </span>
    );
  }

  // ── task / smartContract：色 + 文案都走 i18n 动态拼接 ──
  const colorPrefix =
    dimension === 'task'
      ? TASK_STATUS_COLOR_KEY_PREFIX
      : SMART_CONTRACT_STATUS_COLOR_KEY_PREFIX;

  const labelPrefix =
    dimension === 'task'
      ? TASK_STATUS_LABEL_KEY_PREFIX
      : SMART_CONTRACT_STATUS_LABEL_KEY_PREFIX;

  const tone = t(`${colorPrefix}${status}`);
  const label = t(`${labelPrefix}${status}`);

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
