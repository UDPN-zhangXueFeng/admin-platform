'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@myorg/shared/util-classnames';
import { toChartDate, toNumber } from './statistics-reports.utils';

/** Raw API rows — numeric-string amounts are converted here. */
export interface WalletQuantityRow {
  time: number | string;
  numberOfNewWallets: number;
}

export interface SpTransactionRow {
  spName: string;
  transactionCount: number;
  transactionVolume: number | string;
}

export interface AbcTransactionRow {
  time: number | string;
  topUpCount: number | string;
  transferCount: number | string;
  withdrawalCount: number | string;
  topUpVolume?: number | string | null;
  transferVolume?: number | string | null;
  withdrawalVolume?: number | string | null;
}

export type StatisticsReportMessages = Record<string, string>;

export interface StatisticsActivityChartsProps {
  /**
   * Localized labels resolved from `modules.statistics-reports` — the
   * component reads no i18n provider, so it also renders standalone
   * (e.g. inside a print popup created with `createRoot`).
   */
  messages: StatisticsReportMessages;
  walletData?: WalletQuantityRow[] | null;
  spData?: SpTransactionRow[] | null;
  abcCount?: AbcTransactionRow[] | null;
  abcVolume?: AbcTransactionRow[] | null;
  /** Selected coin label, shown in the count/volume chart titles. */
  coinName?: string;
  /** Coin symbol used as the volume unit. */
  symbol?: string;
  className?: string;
}

type SpMetric = 'count' | 'volume';

const SERIES_COLORS = ['#6366f1', '#16a34a', '#d97706'];
const GRID_STROKE = 'hsl(var(--border))';
const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const CHART_HEIGHT = 240;
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    color: 'hsl(var(--popover-foreground))',
    fontSize: 12,
  },
  labelStyle: { color: 'hsl(var(--popover-foreground))', fontWeight: 600 },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;

function dateAxis(dataKey: string) {
  return (
    <XAxis
      dataKey={dataKey}
      tick={AXIS_TICK}
      tickLine={false}
      axisLine={{ stroke: GRID_STROKE }}
      minTickGap={24}
    />
  );
}

function valueAxis(width = 56) {
  return (
    <YAxis
      width={width}
      tick={AXIS_TICK}
      tickLine={false}
      axisLine={false}
      allowDecimals={false}
    />
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height: CHART_HEIGHT }}
    >
      {label}
    </div>
  );
}

function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="truncate text-sm font-medium">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * The four activity charts (new wallets / service providers / transaction
 * count / transaction volume) shared by the on-screen page. Wallets render
 * as a bar chart and the SP chart shows a single selectable metric
 * (count vs volume) like the upstream single-mode legend; the volume series
 * prefers the `*Volume` fields and falls back to the legacy `*Count` amounts.
 */
export function StatisticsActivityCharts({
  messages,
  walletData,
  spData,
  abcCount,
  abcVolume,
  coinName,
  symbol,
  className,
}: StatisticsActivityChartsProps) {
  const m = React.useCallback(
    (key: string) => messages[key] ?? key,
    [messages],
  );
  const [spMetric, setSpMetric] = React.useState<SpMetric>('count');

  const emptyLabel = m('statistics_reports_0043');

  const walletRows = React.useMemo(
    () =>
      (walletData ?? []).map((row) => ({
        date: toChartDate(row.time),
        value: toNumber(row.numberOfNewWallets),
      })),
    [walletData],
  );

  const spRows = React.useMemo(
    () =>
      (spData ?? []).map((row) => ({
        date: row.spName,
        count: toNumber(row.transactionCount),
        volume: toNumber(row.transactionVolume),
      })),
    [spData],
  );

  const spMetricName = m(
    spMetric === 'count' ? 'statistics_reports_0035' : 'statistics_reports_0036',
  );

  const volumeOf = React.useCallback(
    (row: AbcTransactionRow, volumeKey: keyof AbcTransactionRow, countKey: keyof AbcTransactionRow) =>
      toNumber((row[volumeKey] ?? row[countKey]) as number | string | null | undefined),
    [],
  );

  const countRows = React.useMemo(
    () =>
      (abcCount ?? []).map((row) => ({
        date: toChartDate(row.time),
        topUp: toNumber(row.topUpCount),
        transfer: toNumber(row.transferCount),
        withdrawal: toNumber(row.withdrawalCount),
      })),
    [abcCount],
  );

  const volumeRows = React.useMemo(
    () =>
      (abcVolume ?? []).map((row) => ({
        date: toChartDate(row.time),
        topUp: volumeOf(row, 'topUpVolume', 'topUpCount'),
        transfer: volumeOf(row, 'transferVolume', 'transferCount'),
        withdrawal: volumeOf(row, 'withdrawalVolume', 'withdrawalCount'),
      })),
    [abcVolume, volumeOf],
  );

  const seriesNames = {
    topUp: m('topUp'),
    transfer: m('transfer'),
    withdrawal: m('withdrawal'),
  };

  const coinTitle = (labelKey: string, unit?: string) => {
    const unitSuffix = unit ? ` (${unit})` : '';
    return `${coinName ? `${coinName} ` : ''}${m(labelKey)}${unitSuffix}`;
  };

  const metricToggle = (
    <div className="flex shrink-0 rounded-md border text-xs" role="group">
      {(['count', 'volume'] as const).map((metric) => (
        <button
          key={metric}
          type="button"
          aria-pressed={spMetric === metric}
          onClick={() => setSpMetric(metric)}
          className={cn(
            'rounded-md px-2 py-1 transition-colors',
            spMetric === metric
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m(metric === 'count' ? 'statistics_reports_0035' : 'statistics_reports_0036')}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn('grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2', className)}>
      <ChartCard title={m('statistics_reports_0037')}>
        {walletRows.length ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={walletRows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              {dateAxis('date')}
              {valueAxis()}
              <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
              <Bar
                dataKey="value"
                name={m('statistics_reports_0038')}
                fill={SERIES_COLORS[1]}
                isAnimationActive={false}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyHint label={emptyLabel} />
        )}
      </ChartCard>

      <ChartCard title={m('statistics_reports_0039')} action={metricToggle}>
        {spRows.length ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={spRows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              {dateAxis('date')}
              {valueAxis(72)}
              <Tooltip
                {...TOOLTIP_STYLE}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                formatter={(value) => [
                  spMetric === 'volume'
                    ? `${toNumber(value as number)} ${symbol ?? ''}`.trimEnd()
                    : String(value),
                  spMetricName,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey={spMetric}
                name={spMetricName}
                fill={SERIES_COLORS[0]}
                isAnimationActive={false}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyHint label={emptyLabel} />
        )}
      </ChartCard>

      <ChartCard title={coinTitle('statistics_reports_0040')}>
        {countRows.length ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={countRows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              {dateAxis('date')}
              {valueAxis()}
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(['topUp', 'transfer', 'withdrawal'] as const).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={seriesNames[key]}
                  stroke={SERIES_COLORS[index]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyHint label={emptyLabel} />
        )}
      </ChartCard>

      <ChartCard title={coinTitle('statistics_reports_0041', symbol)}>
        {volumeRows.length ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={volumeRows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              {dateAxis('date')}
              {valueAxis(72)}
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value, name) => [`${toNumber(value as number)} ${symbol ?? ''}`.trimEnd(), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(['topUp', 'transfer', 'withdrawal'] as const).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={seriesNames[key]}
                  stroke={SERIES_COLORS[index]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyHint label={emptyLabel} />
        )}
      </ChartCard>
    </div>
  );
}
