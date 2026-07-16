/**
 * Cross-Chain Status Badge — 跨链模块多子模块状态标签。
 *
 * 5 个子模块各有独立的状态色映射常量（来自 util/cross-chain.constants.ts）和
 * i18n label key 前缀，全部走 `modules.cross-chain` 命名空间动态拼接。
 *
 * 设计对齐 blockchain-status-badge（本地 TONE_CLASS 映射 antd 色名到
 * Tailwind badge class，不依赖 @myorg/shared/ui Badge）。
 *
 * 模式：
 *   kind 决定使用哪套状态色映射 + 文案 key 前缀。
 *   - cross-chain-tx：CROSS_CHAIN_TX_STATUS_COLOR + CROSS_CHAIN_TX_STATUS_LABEL_KEY_PREFIX
 *   - liquidity-pool：LIQUIDITY_POOL_STATUS_COLOR + LIQUIDITY_POOL_STATUS_LABEL_KEY_PREFIX
 *   - liquidity-pool-tx：LIQUIDITY_POOL_TX_STATUS_COLOR + LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX
 *   - rd-bridge：RD_BRIDGE_STATUS_COLOR + RD_BRIDGE_STATUS_LABEL_KEY_PREFIX
 *   - token-pair：TOKEN_PAIR_STATUS_COLOR + TOKEN_PAIR_STATUS_LABEL_KEY_PREFIX
 *
 * 注意：
 * - LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX 保留源项目拼写错误 "ststus"。
 * - fx-rate 无状态枚举，故不在 kind 中。
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CROSS_CHAIN_TX_STATUS_COLOR,
  LIQUIDITY_POOL_STATUS_COLOR,
  LIQUIDITY_POOL_TX_STATUS_COLOR,
  RD_BRIDGE_STATUS_COLOR,
  TOKEN_PAIR_STATUS_COLOR,
  CROSS_CHAIN_TX_STATUS_LABEL_KEY_PREFIX,
  LIQUIDITY_POOL_STATUS_LABEL_KEY_PREFIX,
  LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX,
  RD_BRIDGE_STATUS_LABEL_KEY_PREFIX,
  TOKEN_PAIR_STATUS_LABEL_KEY_PREFIX,
} from '@myorg/modules/cross-chain/util';

/**
 * antd 色名 → Tailwind badge class。
 *
 * 键覆盖源码中所有可能的状态色名（success / orange / processing / error /
 * default / gray）。未知色名回落 default（gray）。
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

/** 5 个子模块业务类型（fx-rate 无状态枚举，不在此列）。 */
export type CrossChainBadgeKind =
  | 'cross-chain-tx'
  | 'liquidity-pool'
  | 'liquidity-pool-tx'
  | 'rd-bridge'
  | 'token-pair';

/** 各 kind → 状态色映射（antd 色名）。 */
const STATUS_COLOR_MAP: Record<CrossChainBadgeKind, Record<number, string>> = {
  'cross-chain-tx': CROSS_CHAIN_TX_STATUS_COLOR as Record<number, string>,
  'liquidity-pool': LIQUIDITY_POOL_STATUS_COLOR as Record<number, string>,
  'liquidity-pool-tx': LIQUIDITY_POOL_TX_STATUS_COLOR as Record<number, string>,
  'rd-bridge': RD_BRIDGE_STATUS_COLOR as Record<number, string>,
  'token-pair': TOKEN_PAIR_STATUS_COLOR as Record<number, string>,
};

/** 各 kind → 文案 i18n key 前缀。 */
const LABEL_KEY_PREFIX_MAP: Record<CrossChainBadgeKind, string> = {
  'cross-chain-tx': CROSS_CHAIN_TX_STATUS_LABEL_KEY_PREFIX,
  'liquidity-pool': LIQUIDITY_POOL_STATUS_LABEL_KEY_PREFIX,
  'liquidity-pool-tx': LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX,
  'rd-bridge': RD_BRIDGE_STATUS_LABEL_KEY_PREFIX,
  'token-pair': TOKEN_PAIR_STATUS_LABEL_KEY_PREFIX,
};

export interface CrossChainStatusBadgeProps {
  /**
   * 子模块业务类型。
   */
  kind: CrossChainBadgeKind;
  /**
   * 后端状态码。
   * 传 null/undefined 时回退 fallback 纯文案。
   */
  status?: number | null;
  /** 空值占位文案，默认 '--'。 */
  fallback?: React.ReactNode;
}

/**
 * 渲染单个 cross-chain 状态标签。
 *
 * 色值取各子模块常量（antd 色名）→ toneClass 映射 Tailwind；
 * 文案取 i18n key `${prefix}${status}` 动态拼接。
 *
 * 用法：
 * ```tsx
 * <CrossChainStatusBadge kind="cross-chain-tx" status={row.status} />
 * <CrossChainStatusBadge kind="rd-bridge" status={row.status} />
 * ```
 */
export function CrossChainStatusBadge({
  kind,
  status,
  fallback = '--',
}: CrossChainStatusBadgeProps) {
  const t = useTranslations('modules.cross-chain');

  if (status == null) {
    return <span className="text-sm text-muted-foreground">{fallback}</span>;
  }

  const colorMap = STATUS_COLOR_MAP[kind];
  const tone = colorMap[status] ?? 'default';
  const labelKey = `${LABEL_KEY_PREFIX_MAP[kind]}${status}`;
  const label = t(labelKey);

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
