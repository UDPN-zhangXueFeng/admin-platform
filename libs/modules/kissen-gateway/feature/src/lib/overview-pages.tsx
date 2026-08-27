'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';

import { Badge, Skeleton } from '@myorg/shared/ui';

import {
  OVERVIEW_PERIOD_DEFAULT,
  OVERVIEW_PERIOD_OPTIONS,
  TOKEN_STATUS,
  TX_STATUS,
  txBankRoleText,
  txBankRoleVariant,
  txStatusText,
  txStatusVariant,
  useOverviewStatsQuery,
  type OverviewPeriod,
} from '@myorg/modules/kissen-gateway/data-access';

import { fmtAmount, formatTime } from './kit';
import { PageHead } from './page-head';
import { ErrorBlock, EmptyHint } from './state-blocks';

/**
 * 统计概览页（源 `views/overview/index.vue`：metrics 卡 + 源/目标口径 +
 * 状态分布条形 + 业务概览 + 最近交易动态，period 四档切换默认 7D）。
 * 路由 /overview（registry：overview → list）。
 *
 * - 服务端状态 TanStack Query（period/from/to 即 query key 维度）。
 * - 接口失败 fail-loud：ErrorBlock + Retry（源 catch 仅靠拦截器，目标
 *   约束升级为页面内可感知可恢复）。
 * - TX/TOKEN 状态映射复用 data-access 既有 TX_STATUS/TOKEN_STATUS（同一
 *   后端枚举，两页共用），Badge variant 分层与 tx/token 页一致。分布条
 *   底色例外：variant 分层折叠 primary/warning，页面以 status→色直查表
 *   （DIST_BAR_COLOR_BY_STATUS）恢复源逐色；CUSTOM 日界取本地零点。
 */

/* ================================================================== */
/* period 切换（源 el-radio-group + el-date-picker daterange）          */
/* ================================================================== */

/** 源切换 period 非 CUSTOM 时清空 range 再拉取（onPeriodChange）。 */
function onPeriodSelect(
  next: string,
  period: OverviewPeriod,
  setPeriod: (p: OverviewPeriod) => void,
  setRange: (r: [string, string] | null) => void,
): void {
  const value = next as OverviewPeriod;
  setPeriod(value);
  if (value !== 'CUSTOM') setRange(null);
}

/**
 * CUSTOM 日界字符串（YYYY-MM-DD）→ 本地零点毫秒。源 daterange
 * value-format="x" 按浏览器本地零点取整；kit.toEpochMs 走 new Date(value)
 * 会把纯日期串按 UTC 零点解析，差一个时区偏移——拼 'T00:00:00' 后按本地解析对齐。
 */
function dayRangeToEpochMs(value: string): number | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

/* ================================================================== */
/* 状态分布条形（源 dist-list：tag + 比例条 + 计数）                    */
/* ================================================================== */

/**
 * 源 distribution 条形底色直查表：status → barColor。逐态对齐源
 * overview/index.vue 的 TX_STATUS TagType × barColor()（warning 橙 #B45309、
 * primary 蓝 #3B82F6…）。data-access TX_STATUS 的 variant 分层把 primary/warning
 * 折叠成 secondary，按 variant 反推会把 30/50 错染成 primary 蓝且 secondary→warning
 * 回退不可达——故页面层建立 13 态直查恢复源色，未知码兜底源默认 info 灰。
 */
const DIST_BAR_COLOR_BY_STATUS: Record<number, string> = {
  1: '#9CA3AF', // info Created
  5: '#3B82F6', // primary Quoted
  10: '#3B82F6', // primary Confirmed
  20: '#3B82F6', // primary Source Transfer in Progress
  25: '#3B82F6', // primary Source Arrival Verified
  30: '#B45309', // warning Disbursing
  35: '#0B6B53', // success Credited
  40: '#0B6B53', // success Completed
  50: '#B45309', // warning Reversing
  60: '#9CA3AF', // info Reversed
  70: '#C2410C', // danger Error (Manual Handling)
  80: '#9CA3AF', // info Cancelled
  90: '#C2410C', // danger Failed
};

/** 未知码条形色（源 distribution 元数据缺省 type='info'）。 */
const DIST_BAR_COLOR_FALLBACK = '#9CA3AF';

/** 分布行：count>0 才显示，按 count 降序；percent 下限 2（源 distribution computed）。 */
function buildDistribution(dist: Record<string, number> | undefined) {
  const entries = Object.entries(dist ?? {});
  const total = entries.reduce((a, [, b]) => a + Number(b), 0);
  return entries
    .map(([code, count]) => {
      const c = Number(count);
      const text = TX_STATUS[Number(code)]?.text ?? `Status (${code})`;
      return {
        code: Number(code),
        text,
        count: c,
        percent: total ? Math.max(2, (c / total) * 100) : 0,
        color: DIST_BAR_COLOR_BY_STATUS[Number(code)] ?? DIST_BAR_COLOR_FALLBACK,
      };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** token 分状态 tags：count>0 才显示（源 tokenStatusList computed）。 */
function buildTokenStatusList(dist: Record<string, number> | undefined) {
  return Object.entries(dist ?? {})
    .map(([code, count]) => {
      const c = Number(count);
      const meta = TOKEN_STATUS[Number(code)] ?? { text: `Status (${code})`, variant: 'outline' as const };
      return { code: Number(code), count: c, text: meta.text, variant: meta.variant };
    })
    .filter((t) => t.count > 0);
}

/* ================================================================== */
/* 页面                                                                 */
/* ================================================================== */

export function OverviewListPage() {
  const router = useRouter();

  const [period, setPeriod] = React.useState<OverviewPeriod>(OVERVIEW_PERIOD_DEFAULT);
  const [range, setRange] = React.useState<[string, string] | null>(null);

  const params = React.useMemo(
    () => ({
      period,
      from: period === 'CUSTOM' && range ? dayRangeToEpochMs(range[0]) : undefined,
      to: period === 'CUSTOM' && range ? dayRangeToEpochMs(range[1]) : undefined,
    }),
    [period, range],
  );

  const { data: stats, isLoading, isError, error, refetch } = useOverviewStatsQuery(params);

  const distribution = React.useMemo(
    () => buildDistribution(stats?.statusDistribution),
    [stats],
  );
  const tokenStatusList = React.useMemo(
    () => buildTokenStatusList(stats?.tokenByStatus),
    [stats],
  );

  /** 源 goTx：row-click 跳交易列表。 */
  const goTx = React.useCallback(() => {
    router.push('/tx');
  }, [router]);

  return (
    <div className="space-y-4">
      <PageHead variant="banner" title="Overview">
        <div className="flex flex-wrap items-center gap-2">
          {/* 源 el-radio-group size=small：四档互斥切换，选中即拉取。 */}
          <div
            role="radiogroup"
            aria-label="Statistics period"
            className="flex overflow-hidden rounded-md border"
          >
            {OVERVIEW_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={period === option.value}
                onClick={() => onPeriodSelect(option.value, period, setPeriod, setRange)}
                className={
                  period === option.value
                    ? 'h-8 border-border px-3 text-sm font-medium border-y border-l last:border-r bg-primary text-primary-foreground'
                    : 'h-8 border-border px-3 text-sm font-medium border-y border-l last:border-r hover:bg-muted'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* 源 el-date-picker daterange value-format="x"：起止日期 → 毫秒。 */}
          {period === 'CUSTOM' && (
            <span className="flex items-center gap-2 text-sm">
              <input
                type="date"
                aria-label="Start date"
                value={range?.[0] ?? ''}
                onChange={(e) =>
                  setRange((prev) => [e.target.value, prev?.[1] ?? ''])
                }
                className="h-8 rounded-md border border-input bg-transparent px-3 text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                aria-label="End date"
                value={range?.[1] ?? ''}
                onChange={(e) =>
                  setRange((prev) => [prev?.[0] ?? '', e.target.value])
                }
                className="h-8 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </span>
          )}
        </div>
      </PageHead>

      {isError ? (
        <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
          <ErrorBlock
            message={error instanceof Error ? error.message : String(error)}
            onRetry={() => refetch()}
          />
        </section>
      ) : isLoading || !stats ? (
        /* 源 v-loading 覆盖指标卡区：首帧骨架。 */
        <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </section>
      ) : (
        <>
          {/* 交易指标卡（源 metric-grid：auto-fit 七卡） */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            <MetricCard value={String(stats.totalCount)} label="Total Transactions" tone="" />
            <MetricCard value={String(stats.completedCount)} label="Completed" tone="ok" />
            <MetricCard value={String(stats.failedCount)} label="Failed" tone="bad" />
            <MetricCard value={String(stats.reversedCount)} label="Reversed" tone="" />
            <MetricCard value={String(stats.exceptionCount)} label="Error (Manual Handling)" tone="bad" />
            <MetricCard value={String(stats.pendingCount)} label="Pending" tone="warn" />
            <MetricCard value={formatSuccessRate(stats.successRate)} label="Success Rate" tone="ok" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* 源/目标口径（源「交易口径（本行角色）」descriptions） */}
            <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
              <div className="mb-4 text-sm font-semibold">Transaction Breakdown (Bank Role)</div>
              <div className="divide-y rounded-md border">
                <DescRow label="Source Count">
                  <span className="tabular-nums">{stats.sourceCount}</span>
                </DescRow>
                <DescRow label="Source Principal Sum">
                  <span className="tabular-nums">{fmtAmount(stats.sourcePrincipalSum)}</span>
                </DescRow>
                <DescRow label="Target Count">
                  <span className="tabular-nums">{stats.targetCount}</span>
                </DescRow>
                <DescRow label="Target Principal Sum">
                  <span className="tabular-nums">{fmtAmount(stats.targetPrincipalSum)}</span>
                </DescRow>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Principal amounts are summed directly in each transaction&apos;s source token, for reference only.
              </p>
            </section>

            {/* 状态分布（源 dist-list：tag + 条 + 计数；空窗口 el-empty） */}
            <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
              <div className="mb-4 text-sm font-semibold">Status Distribution</div>
              {distribution.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {distribution.map((d) => (
                    <div key={d.code} className="flex items-center gap-2.5">
                      <Badge variant="outline" className="w-28 shrink-0 justify-center">
                        {d.text}
                      </Badge>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full min-w-[2px] rounded"
                          style={{ width: `${d.percent}%`, background: d.color }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm tabular-nums">{d.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyHint text="No transactions in this window" />
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* 业务概览（源「业务概览」descriptions） */}
            <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
              <div className="mb-4 text-sm font-semibold">Business Overview</div>
              <div className="divide-y rounded-md border">
                <DescRow label="Registered Tokens">
                  <span className="tabular-nums">{stats.tokenTotal}</span>
                  <span className="ml-2.5 inline-flex flex-wrap gap-1.5">
                    {tokenStatusList.map((t) => (
                      <Badge key={t.code} variant={t.variant}>
                        {t.text} {t.count}
                      </Badge>
                    ))}
                  </span>
                </DescRow>
                <DescRow label="Related Token Pairs">
                  <span className="tabular-nums">{stats.tokenPairCount}</span>
                </DescRow>
                <DescRow label="Statistics Window">
                  <span className="tabular-nums">
                    {formatTime(stats.from)} ~ {formatTime(stats.to)}
                  </span>
                </DescRow>
              </div>
            </section>

            {/* 最近交易动态（源 el-table max-height 320 row-click 跳列表） */}
            <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
              <div className="mb-4 text-sm font-semibold">Recent Transactions</div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full caption-bottom text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {RECENT_TX_HEADERS.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.recentTxs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={RECENT_TX_HEADERS.length}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No data
                        </td>
                      </tr>
                    ) : (
                      stats.recentTxs.map((row) => (
                        <tr
                          key={row.recordId}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={goTx}
                        >
                          <td className="max-w-[17rem] px-4 py-3 align-middle tabular-nums">
                            <span className="block truncate" title={recentTxNo(row)}>
                              {recentTxNo(row) || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {row.bankRole ? (
                              <Badge variant={txBankRoleVariant(row.bankRole)}>
                                {txBankRoleText(row.bankRole)}
                              </Badge>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right align-middle tabular-nums">
                            {fmtAmount(row.principal)}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <Badge variant={txStatusVariant(row.status)}>
                              {txStatusText(row.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 align-middle tabular-nums">
                            {formatTime(row.createTime)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Statistics are based on local instance data only (transaction records / token
            registrations / token pair pushes), not network-wide figures.
          </p>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* 子组件                                                               */
/* ================================================================== */

/** 源列头（交易编号/本行角色/本金/状态/创建时间）。 */
const RECENT_TX_HEADERS = [
  'Transaction No.',
  'Bank Role',
  'Principal',
  'Status',
  'Create Time',
] as const;

/** 源 txNo || txUuid || transactionId 兜底链。 */
function recentTxNo(row: { txNo?: string; txUuid?: string; transactionId: number }): string {
  return row.txNo || row.txUuid || String(row.transactionId);
}

/** 源 successRate：null → '—'；否则 ×100 保留两位百分号。 */
function formatSuccessRate(rate: number | null | undefined): string {
  return rate == null ? '—' : `${(Number(rate) * 100).toFixed(2)}%`;
}

const METRIC_TONES: Record<string, string> = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-orange-700 dark:text-orange-400',
  warn: 'text-amber-700 dark:text-amber-400',
};

/** 指标卡（源 metric-card：26px mono 数值 + 12px 灰标；tone 为源 ok/bad/warn 色系）。 */
function MetricCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'ok' | 'bad' | 'warn' | '';
}) {
  return (
    <div className="rounded-lg border-border/60 bg-card p-4 text-card-foreground shadow-float">
      <div className={`text-2xl font-semibold tabular-nums ${METRIC_TONES[tone] ?? ''}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** descriptions 单列描边行（源 el-descriptions :column="1" border）。 */
function DescRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-3">
      <div className="text-xs leading-6 text-muted-foreground">{label}</div>
      <div className="min-w-0 text-sm leading-6">{children}</div>
    </div>
  );
}
