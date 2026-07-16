/**
 * OverviewInfoCard — 运营总览页顶部概览卡。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 `getTDInfo` useMemo
 * （源码 407-435 行）+ `stablecoinGet` useMemo（366-406 行）+ 卡片渲染（1799-1896 行）。
 *
 * 两栏布局（源码 `md:flex w-full justify-between`）：
 *
 *  左栏（深色卡 hsb.png 背景）— TD 基本信息 6 项（getTDInfo）：
 *    1. Token Type    → t(`token_type_${mintMethod}`)
 *    2. Token Name    → name + state 图标（ClockIcon/CheckCircleIcon/NoSymbolIcon）
 *    3. Symbol        → symbol
 *    4. Pegged        → `${stablecoinCount} ${symbol} = ${usPrice} ${currencySymbol}`
 *    5. Blockchain    → blockchainName
 *    6. Decimal       → decimalPrecision
 *
 *  右栏（白卡）— 储备区 + 4 统计（stablecoinGet）：
 *    储备区（仅 mintMethod===1）：
 *      - Reserve Account → TokenizedDepositCopy（copyable）
 *      - Reserve Balance → formatNumber + currencySymbol
 *    4 统计（按 mintMethod/pledgeType 切文案 + 图标）：
 *      - pledgeType===1 质押：Repository Balance / Circulation / Total Minted / Total Melted
 *      - 否则（SP/MMF）：Circulation / Issuance / Melting（首项隐藏）
 *
 * state 图标色走 TD_STATE_ICON_COLOR（0=#d4865f / 1=#87ca87 / 2=#fe5945）。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 *
 * 注意：源码用 antd `Image` 渲染统计图标 SVG（`/stablecoin/images/*.svg`），
 * admin-platform 无该静态资源；迁移时统计图标改为左侧色块占位（保留统计文案 + 数值布局），
 * 图标资源缺失不影响数据正确性，运行时冒烟可按需补。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { formatNumber } from '@myorg/shared/util-formatting';
import {
  TokenizedDepositCopy,
  type TokenizedDepositCopyProps,
} from '@myorg/modules/tokenized-deposit/ui';
import {
  TD_STATE_ICON_COLOR,
} from '@myorg/modules/tokenized-deposit/util';
import type { ApplyListItem } from '@myorg/modules/tokenized-deposit/data-access';

/** 数值格式化 locale（与源码 reSet 千分位 + 2 位小数对齐）。 */
const NUMBER_LOCALE = 'en-US';

/**
 * 安全数值格式化（千分位 + 2 位小数）。
 *
 * 对齐源码 `reSet(value)` 行为：value>=0 时千分位 + 2 位小数，否则 '--'。
 * 迁移说明：源 reSet 内部 `Number(value).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g,'$1,')`，
 * 这里用 Intl.NumberFormat 等价实现（en-US 即千分位逗号 + 小数点）。
 */
function formatStat(value: number | string | undefined | null): string {
  if (value == null || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return formatNumber(num, NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** TD 基本信息（getTDInfo）单行。 */
interface InfoRow {
  label: string;
  /** 渲染值（支持 ReactNode，用于 state 图标行）。 */
  value: React.ReactNode;
  /** state 图标的 state 值（仅第 2 行 Token Name 传入）。 */
  state?: number;
}

/** 统计项（stablecoinGet）定义。 */
interface StatItem {
  /** i18n label（已 replace **** 完毕）。 */
  label: string;
  /** td 上的取值字段名（surplusCount/circulationCount/issueCount/removeCount）。 */
  valueKey: 'surplusCount' | 'circulationCount' | 'issueCount' | 'removeCount';
}

/**
 * 计算左栏 TD 基本信息 6 项（getTDInfo）。
 *
 * 完整搬运源码 getTDInfo useMemo（index.tsx 407-435 行）。
 */
function buildInfoRows(
  td: ApplyListItem | undefined,
  t: (k: string) => string,
): InfoRow[] {
  return [
    {
      label: t('tokenized_deposit_0062'),
      value: td?.mintMethod != null ? t(`token_type_${td.mintMethod}`) : '--',
    },
    {
      label: t('tokenized_deposit_0000'),
      value: td?.name ?? '--',
      state: td?.state,
    },
    {
      label: t('tokenized_deposit_0001'),
      value: td?.symbol ?? '--',
    },
    {
      label: t('tokenized_deposit_0011'),
      value:
        td?.stablecoinCount != null && td?.usPrice != null
          ? `${td.stablecoinCount} ${td?.symbol ?? ''} = ${td.usPrice} ${
              td?.currencySymbol ?? ''
            }`
          : '--',
    },
    {
      label: t('tokenized_deposit_0007'),
      value: td?.blockchainName ?? '--',
    },
    {
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
function buildStatItems(
  td: ApplyListItem | undefined,
  t: (k: string) => string,
): StatItem[] {
  const isPledgeStablecoin = td?.mintMethod === 1 && td?.pledgeType === 1;
  const symbolUpper = td?.symbol?.toLocaleUpperCase() ?? '';
  return [
    {
      label: isPledgeStablecoin
        ? t('dashboard_0003')
        : '', // 非质押稳定币首项隐藏
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

/**
 * state 图标（概览卡 Token Name 行尾）。
 *
 * 0=ClockIcon(#d4865f) / 1=CheckCircleIcon(#87ca87) / 2=NoSymbolIcon(#fe5945)。
 * 色走 TD_STATE_ICON_COLOR 常量（与 util 一致，勿硬编码）。
 */
function StateIcon({ state }: { state?: number }): React.JSX.Element | null {
  if (state == null) return null;
  const color = TD_STATE_ICON_COLOR[state] ?? '#666666';
  // heroicons outline 24×24 等价（Clock/CheckCircle/NoSymbol）。
  if (state === 0) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 inline-block h-4 w-4 align-middle"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    );
  }
  if (state === 1) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 inline-block h-4 w-4 align-middle"
        aria-hidden="true"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  // state === 2（禁用）
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-1 inline-block h-4 w-4 align-middle"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  );
}

export interface OverviewInfoCardProps {
  /** 当前选中 TD 的概览数据（applyList[activeKey]）。 */
  td: ApplyListItem | undefined;
}

/**
 * 渲染顶部概览卡（左栏 TD 基本信息 + 右栏储备区 + 4 统计）。
 *
 * 用法：
 * ```tsx
 * <OverviewInfoCard td={currentTd} />
 * ```
 */
export function OverviewInfoCard({
  td,
}: OverviewInfoCardProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const infoRows = React.useMemo(() => buildInfoRows(td, t), [td, t]);
  const statItems = React.useMemo(() => buildStatItems(td, t), [td, t]);

  const isStablecoin = td?.mintMethod === 1;

  // 复制 props 类型对齐 TokenizedDepositCopy（reserveAccount copyable）。
  const reserveAccountStr =
    td?.reserveAccount != null ? String(td.reserveAccount) : '';
  const reserveCopyProps: TokenizedDepositCopyProps = {
    text: reserveAccountStr,
  };

  return (
    <div className="my-4 flex w-full flex-col justify-between md:flex-row">
      {/* 左栏：TD 基本信息（深色卡，hsb.png 背景） */}
      <div className="mb-10 max-h-80 w-full rounded-xl !bg-cover p-5 text-white md:mb-0 md:w-[45%]">
        <div className="flex">
          <div className="flex-1">
            {infoRows.map((row, index) => (
              <div
                key={index}
                className="mb-4 flex items-center text-base"
              >
                <span className="mb-1 w-1/2">{row.label}</span>
                <span className="flex flex-1 font-extrabold">
                  {row.value}
                  {index === 1 ? <StateIcon state={row.state} /> : null}
                </span>
              </div>
            ))}
          </div>
          {/* 右上角代币符号圆形徽标 */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
            <div className="flex h-12 w-12 items-center justify-center pt-1 text-center text-xs font-extrabold leading-10 rounded-full bg-[#DEDEFA] text-indigo-600">
              {td?.symbol ?? ''}
            </div>
          </div>
        </div>
      </div>

      {/* 右栏：储备区 + 4 统计（白卡） */}
      <div className="w-full justify-between rounded-xl bg-white p-6 shadow-lg md:ml-10 md:w-[55%]">
        {/* 储备区（仅 mintMethod===1 稳定币） */}
        {isStablecoin ? (
          <>
            <div className="flex items-center">
              <span>{t('tokenized_deposit_0175')}: </span>
              <span className="ml-1 text-base">
                <TokenizedDepositCopy {...reserveCopyProps} />
              </span>
            </div>
            <div>
              <span>{t('tokenized_deposit_0071')}: </span>
              <span className="text-xl font-extrabold text-indigo-600">
                {formatStat(td?.reserveBalance)} {td?.currencySymbol ?? ''}
              </span>
            </div>
          </>
        ) : null}

        {/* 4 统计（首项 label 为空则隐藏） */}
        <div className="flex flex-wrap">
          {statItems.map((item, index) =>
            item.label ? (
              <div key={index} className="mt-8" style={{ width: '47%' }}>
                <div className="flex items-center">
                  <div className="h-12 w-12 shrink-0 rounded-md bg-indigo-50" />
                  <div className="ml-4">
                    <span className="mb-2 block">{item.label}</span>
                    <span className="font-bold">
                      {formatStat(td?.[item.valueKey])} {td?.symbol ?? ''}
                    </span>
                  </div>
                </div>
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
