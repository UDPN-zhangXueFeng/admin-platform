'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  Card,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { DateRangePicker } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';
import type {
  TrialBalanceAsOfOption,
  TrialBalanceFilterState,
  TrialBalanceRow,
  TrialBalanceSummary,
} from '@myorg/modules/td-admin/data-access';

const AS_OF_OPTIONS: TrialBalanceAsOfOption[] = [
  'end-of-last-eod',
  'end-of-last-month',
  'end-of-last-quarter',
  'end-of-last-year',
  'custom-date',
];

const AS_OF_I18N_KEYS: Record<TrialBalanceAsOfOption, string> = {
  'end-of-last-eod': 'trialBalance.asOfEndOfLastEod',
  'end-of-last-month': 'trialBalance.asOfEndOfLastMonth',
  'end-of-last-quarter': 'trialBalance.asOfEndOfLastQuarter',
  'end-of-last-year': 'trialBalance.asOfEndOfLastYear',
  'custom-date': 'trialBalance.asOfCustomDate',
};

export interface TrialBalanceContentProps {
  bookName: string;
  filters: TrialBalanceFilterState;
  onFiltersChange: (filters: TrialBalanceFilterState) => void;
  summary: TrialBalanceSummary;
  loading: boolean;
  columns: ColumnDef<TrialBalanceRow>[];
  t: (key: string, values?: Record<string, string | number>) => string;
}

/**
 * Trial Balance tab 内容（迁移自源 `TrialBalanceContent.tsx`）。
 *
 * as-of 下拉（上次日终 / 上月末 / 上季末 / 上年末 / 自定义日期）+ 汇总三卡 +
 * Assets / Liabilities 两张试算表。汇总与行数据由 `useTrialBalance` 提供。
 */
export function TrialBalanceContent({
  bookName,
  filters,
  onFiltersChange,
  summary,
  loading,
  columns,
  t,
}: TrialBalanceContentProps) {
  const isBalanced = summary.balancingCheck.trim().toLowerCase() === 'balanced';
  const rangeStart = filters.customDateRange?.[0] ?? '';
  const rangeEnd = filters.customDateRange?.[1] ?? '';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('trialBalance.description', { bookName })}
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {t('trialBalance.asOf')}
          </label>
          <Select
            value={filters.asOf}
            onValueChange={(value) =>
              onFiltersChange({
                asOf: value as TrialBalanceAsOfOption,
                customDateRange:
                  value === 'custom-date' ? filters.customDateRange : null,
              })
            }
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AS_OF_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(AS_OF_I18N_KEYS[option])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filters.asOf === 'custom-date' ? (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {t('trialBalance.customDateRange')}
            </label>
            <DateRangePicker
              value={{ start: rangeStart, end: rangeEnd }}
              onChange={(next) =>
                onFiltersChange({
                  ...filters,
                  customDateRange:
                    next.start && next.end ? [next.start, next.end] : null,
                })
              }
              className="w-[320px]"
            />
          </div>
        ) : null}
      </div>

      <div>
        <div className="text-xl font-semibold">
          {t('trialBalance.titleWithAsOf', {
            asOf: t(AS_OF_I18N_KEYS[filters.asOf]),
          })}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {summary.periodText}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">
            {t('trialBalance.totalAssets')}
          </div>
          <div className="mt-1 text-2xl font-semibold">{summary.totalAssets}</div>
          <div className="mt-3 text-xs text-muted-foreground">
            {t('trialBalance.asOfDate', { date: summary.asOfDate })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">
            {t('trialBalance.totalLiabilities')}
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.totalLiabilities}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {t('trialBalance.asOfDate', { date: summary.asOfDate })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">
            {t('trialBalance.balancingCheck')}
          </div>
          <div
            className={cn(
              'mt-2 text-2xl font-semibold',
              isBalanced ? 'text-green-600' : 'text-destructive'
            )}
          >
            {summary.balancingCheck}
          </div>
        </Card>
      </div>

      <div className="text-lg font-semibold text-blue-600">
        {t('trialBalance.assets')}
      </div>
      <Card>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={summary.assetRows}
            isLoading={loading}
            emptyMessage="--"
          />
        </div>
      </Card>

      <div className="text-lg font-semibold text-red-600">
        {t('trialBalance.liabilities')}
      </div>
      <Card>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={summary.liabilityRows}
            isLoading={loading}
            emptyMessage="--"
          />
        </div>
      </Card>
    </div>
  );
}
