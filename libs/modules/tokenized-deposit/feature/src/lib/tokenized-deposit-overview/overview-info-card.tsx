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
 * 视觉实现使用轻量 SVG 渐变动效和项目已存在的 lucide-react 图标：不重新引入旧系统的
 * 位图背景和遗失 SVG 资源，避免为单个概览卡增加静态资源维护成本。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CircleDollarSign,
  Coins,
  Layers3,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber } from '@myorg/shared/util-formatting';
import {
  TokenizedDepositCopy,
  type TokenizedDepositCopyProps,
} from '@myorg/modules/tokenized-deposit/ui';
import { TD_STATE_ICON_COLOR } from '@myorg/modules/tokenized-deposit/util';
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
  /** 稳定 React key。 */
  key: string;
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

interface StatVisual {
  icon: LucideIcon;
  className: string;
}

/** 统计值字段到视觉标识的固定映射，避免展示层依赖业务文案推断样式。 */
const STAT_VISUALS: Record<StatItem['valueKey'], StatVisual> = {
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
function buildInfoRows(
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
function buildStatItems(
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

/** 复用 Header 的主题色与低频动画类，避免为概览卡引入额外位图资源。 */
function AnimatedOverviewBackground(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 800 340"
    >
      <defs>
        <linearGradient id="token-overview-base" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--banner-start)" />
          <stop offset="0.52" stopColor="var(--banner-mid)" />
          <stop offset="1" stopColor="var(--banner-end)" />
        </linearGradient>
        <radialGradient id="token-overview-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--banner-glow)" stopOpacity="0.52" />
          <stop offset="1" stopColor="var(--banner-glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="token-overview-highlight" cx="50%" cy="50%" r="50%">
          <stop
            offset="0"
            stopColor="var(--banner-highlight)"
            stopOpacity="0.38"
          />
          <stop
            offset="1"
            stopColor="var(--banner-highlight)"
            stopOpacity="0"
          />
        </radialGradient>
      </defs>
      <rect width="800" height="340" fill="url(#token-overview-base)" />
      <ellipse
        className="app-banner-orb-one"
        cx="120"
        cy="75"
        rx="260"
        ry="160"
        fill="url(#token-overview-glow)"
      />
      <ellipse
        className="app-banner-orb-two"
        cx="670"
        cy="290"
        rx="280"
        ry="175"
        fill="url(#token-overview-highlight)"
      />
      <path
        className="app-banner-wave"
        d="M-80 240C70 195 180 295 350 236C500 183 615 280 880 184V340H-80Z"
        fill="var(--banner-wave)"
        opacity="0.2"
      />
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
