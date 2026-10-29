/**
 * 概览卡数据层：NUMBER_LOCALE/formatStat 数值格式化、InfoRow/StatItem 模型、
 * STAT_VISUALS 视觉映射、buildInfoRows（左栏 TD 基本信息 6 项）/
 * buildStatItems（右栏 4 统计项）。
 * 源: overview-info-card.tsx 51-200
 */
'use client';

import * as React from 'react';
import {
  CircleDollarSign,
  Coins,
  Layers3,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { ApplyListItem } from '@myorg/modules/td-admin/data-access';
import { reSet } from '../re-set';

/**
 * 安全数值格式化——直接代理模块级 `reSet`（源 libs/utils 变体逐分支等价：
 * undefined/负数→'--'，四舍五入 2 位小数 + 千分位）。
 */
export function formatStat(value: number | string | undefined | null): string {
  return reSet(value);
}

/** TD 基本信息（getTDInfo）单行。 */
export interface InfoRow {
  /** 稳定 React key。 */
  key: string;
  label: string;
  /** 渲染值（支持 ReactNode，用于 state 图标行）。 */
  value: React.ReactNode;
  /** state 图标的 state 值（仅第 2 行 Token Name 传入）。 */
  state?: number;
}

/** 统计项（stablecoinGet）定义。 */
export interface StatItem {
  /** i18n label（已 replace **** 完毕）。 */
  label: string;
  /** td 上的取值字段名（surplusCount/circulationCount/issueCount/removeCount）。 */
  valueKey: 'surplusCount' | 'circulationCount' | 'issueCount' | 'removeCount';
}

export interface StatVisual {
  icon: LucideIcon;
  className: string;
}

/** 统计值字段到视觉标识的固定映射，避免展示层依赖业务文案推断样式。 */
export const STAT_VISUALS: Record<StatItem['valueKey'], StatVisual> = {
  surplusCount: {
    icon: CircleDollarSign,
    className: 'bg-violet-500 shadow-violet-500/25',
  },
  circulationCount: {
    icon: Coins,
    className: 'bg-fuchsia-500 shadow-fuchsia-500/25',
  },
  issueCount: {
    icon: Layers3,
    className: 'bg-amber-400 shadow-amber-400/25',
  },
  removeCount: {
    icon: Waves,
    className: 'bg-emerald-400 shadow-emerald-400/25',
  },
};

/**
 * 计算左栏 TD 基本信息 6 项（getTDInfo）。
 *
 * 完整搬运源码 getTDInfo useMemo（index.tsx 407-435 行）。
 */
export function buildInfoRows(
  td: ApplyListItem | undefined,
  t: (k: string) => string,
): InfoRow[] {
  return [
    {
      key: 'token-type',
      label: t('tokenized_deposit_0062'),
      value: td?.mintMethod != null ? t(`token_type_${td.mintMethod}`) : '--',
    },
    {
      key: 'token-name',
      label: t('tokenized_deposit_0000'),
      value: td?.name ?? '--',
      state: td?.state,
    },
    {
      key: 'token-symbol',
      label: t('tokenized_deposit_0001'),
      value: td?.symbol ?? '--',
    },
    {
      key: 'token-price',
      label: t('tokenized_deposit_0011'),
      value:
        td?.stablecoinCount != null && td?.usPrice != null
          ? `${td.stablecoinCount} ${td?.symbol ?? ''} = ${td.usPrice} ${
              td?.currencySymbol ?? ''
            }`
          : '--',
    },
    {
      key: 'blockchain',
      label: t('tokenized_deposit_0007'),
      value: td?.blockchainName ?? '--',
    },
    {
      key: 'decimal-precision',
      label: t('stablecoin_settings_009'),
      value: td?.decimalPrecision != null ? String(td.decimalPrecision) : '--',
    },
  ];
}

/**
 * 计算右栏 4 统计项（stablecoinGet）。
 *
 * 完整搬运源码 stablecoinGet useMemo（index.tsx 366-406 行）。
 * mintMethod===1 && pledgeType===1（质押稳定币）：4 项全显，文案为储备/流通/总铸/总销。
 * 否则（SP 直铸 / MMF）：首项 Repository Balance 隐藏（源码 `{}` 空对象 → label 为空 → 不渲染），
 * 后 3 项文案切为 Circulation/Issuance/Melting。
 */
export function buildStatItems(
  td: ApplyListItem | undefined,
  t: (k: string) => string,
): StatItem[] {
  const isPledgeStablecoin = td?.mintMethod === 1 && td?.pledgeType === 1;
  const symbolUpper = td?.symbol?.toLocaleUpperCase() ?? '';
  return [
    {
      label: isPledgeStablecoin ? t('dashboard_0003') : '', // 非质押稳定币首项隐藏
      valueKey: 'surplusCount',
    },
    {
      label: t('dashboard_0002').replace('****', symbolUpper),
      valueKey: 'circulationCount',
    },
    {
      label: isPledgeStablecoin
        ? t('dashboard_0004')
        : t('tokenized_deposit_0064'),
      valueKey: 'issueCount',
    },
    {
      label: isPledgeStablecoin
        ? t('dashboard_0005')
        : t('tokenized_deposit_0065'),
      valueKey: 'removeCount',
    },
  ];
}
