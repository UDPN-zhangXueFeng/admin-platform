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
 *      - Reserve Balance → reSet（经 formatStat）+ currencySymbol（源 index.tsx:1859）
 *    4 统计（按 mintMethod/pledgeType 切文案 + 图标）：
 *      - pledgeType===1 质押：Repository Balance / Circulation / Total Minted / Total Melted
 *      - 否则（SP/MMF）：Circulation / Issuance / Melting（首项隐藏）
 *
 * state 图标色走 TD_STATE_ICON_COLOR（0=#d4865f / 1=#87ca87 / 2=#fe5945）。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 *
 * 视觉实现使用轻量 SVG 渐变动效和项目已存在的 lucide-react 图标：不重新引入旧系统的
 * 位图背景和遗失 SVG 资源，避免为单个概览卡增加静态资源维护成本。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  TokenizedDepositCopy,
  type TokenizedDepositCopyProps,
} from '..';
import type { ApplyListItem } from '@myorg/modules/td-admin/data-access';
import {
  STAT_VISUALS,
  buildInfoRows,
  buildStatItems,
  formatStat,
} from './overview-info-card-stats';
import {
  AnimatedOverviewBackground,
  StateIcon,
} from './overview-info-card-visuals';

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
    <section
      className="my-4 grid w-full gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] min-[1600px]:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]"
      aria-label="Token overview"
    >
      {/* 左栏：Token 基本信息。渐变层替代旧系统缺失的 hsb.png 位图资源。 */}
      <div className="relative isolate overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-[0_16px_32px_rgba(83,88,181,0.18)] sm:p-6">
        <AnimatedOverviewBackground />

        <div className="relative flex items-start justify-between gap-5">
          <dl className="grid min-w-0 flex-1 gap-y-4 pt-0.5">
            {infoRows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(8.25rem,0.95fr)_minmax(0,1.15fr)] items-center gap-4 text-sm leading-6 sm:text-[15px]"
              >
                <dt className="text-primary-foreground/85">{row.label}</dt>
                <dd className="flex min-w-0 items-center font-semibold tracking-[-0.01em]">
                  <span className="truncate">{row.value}</span>
                  {row.key === 'token-name' ? (
                    <StateIcon state={row.state} />
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          {/* 右上角代币符号圆形徽标 */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white/90 bg-white/25 p-1 shadow-lg backdrop-blur-sm">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90 px-1 text-center text-sm font-bold text-primary">
              <span className="truncate">{td?.symbol ?? '--'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右栏：储备区 + 统计。 */}
      <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
        {/* 储备区（仅 mintMethod===1 稳定币） */}
        {isStablecoin ? (
          <div className="border-b border-border pb-5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-base">
              <span>{t('tokenized_deposit_0175')}:</span>
              <TokenizedDepositCopy {...reserveCopyProps} />
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base">
              <span>{t('tokenized_deposit_0071')}:</span>
              <span className="text-2xl font-bold tracking-[-0.03em] text-primary sm:text-[1.65rem]">
                {formatStat(td?.reserveBalance)} {td?.currencySymbol ?? ''}
              </span>
            </div>
          </div>
        ) : null}

        {/* 首项 label 为空的 SP/MMF 资产只展示三项统计。 */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 pt-5 sm:grid-cols-2">
          {statItems.map((item) => {
            if (!item.label) return null;
            const visual = STAT_VISUALS[item.valueKey];
            const Icon = visual.icon;

            return (
              <div
                key={item.valueKey}
                className="flex min-w-0 items-center gap-4"
              >
                <div
                  className={`flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${visual.className}`}
                  aria-hidden="true"
                >
                  <Icon className="h-7 w-7" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] leading-6 text-card-foreground/90 sm:text-base">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-lg font-bold tracking-[-0.02em]">
                    {formatStat(td?.[item.valueKey])} {td?.symbol ?? ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
