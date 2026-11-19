'use client';

import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import {
  buildTrialBalanceActivityRows,
  buildTrialBalanceSummary,
  getTrialBalanceActivityItems,
  getTrialBalanceRange,
  parseDateToMs,
  useTrialBalanceActivityQuery,
  useTrialBalanceQuery,
  type TrialBalanceActivityMeta,
  type TrialBalanceActivityRow,
  type TrialBalanceFilterState,
  type TrialBalanceRow,
} from '@myorg/modules/td-admin/data-access';

import {
  buildTrialBalanceActivityColumns,
  buildTrialBalanceColumns,
} from './trial-balance-columns';

export interface UseTrialBalanceOptions {
  financeBookId: number | undefined;
  /** Tab 激活时才发请求。 */
  enabled: boolean;
  basicInfoLoading: boolean;
  lastEodPostingRun?: string;
  basicInfo: { financialBookName: string; bookId: string };
  /** 账本货币（响应缺省时的兜底）。 */
  fallbackCurrency: string;
  tokenType?: number;
}

/** 文本或数字字段 → 展示文本（`undefined` 时返回空串，供 `||` 链式回退）。 */
function toText(value?: string | number): string {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  return text && text !== '0' ? text : '';
}

/**
 * useTrialBalance — Trial Balance tab 的状态与数据。
 *
 * 迁移自源 `useChartOfAccounts` 的 Trial Balance 部分：as-of 区间计算
 * （`getTrialBalanceRange`）、汇总（`buildTrialBalanceSummary`）、科目活动明细
 * （选中行 + `buildTrialBalanceActivityRows`）。`end-of-last-eod` 需等
 * Basic Information 返回 `lastEodPostingRun` 后再查询（源行为）。
 */
export function useTrialBalance({
  financeBookId,
  enabled,
  basicInfoLoading,
  lastEodPostingRun,
  basicInfo,
  fallbackCurrency,
  tokenType,
}: UseTrialBalanceOptions) {
  const t = useTranslations('modules.chart-of-accounts');
  const [filters, setFilters] = useState<TrialBalanceFilterState>({
    asOf: 'end-of-last-eod',
    customDateRange: null,
  });
  const [selectedRow, setSelectedRow] = useState<TrialBalanceRow | null>(null);

  const range = useMemo(
    () =>
      getTrialBalanceRange(
        filters.asOf,
        filters.customDateRange,
        lastEodPostingRun
      ),
    [filters.asOf, filters.customDateRange, lastEodPostingRun]
  );
  const rangeReady =
    Number.isFinite(range.startTime) && Number.isFinite(range.endTime);
  const waitingForBasicInfo =
    filters.asOf === 'end-of-last-eod' && basicInfoLoading;

  const queryParams = useMemo(
    () =>
      rangeReady && !waitingForBasicInfo
        ? { startDate: range.startTime, endDate: range.endTime }
        : undefined,
    [rangeReady, range.endTime, range.startTime, waitingForBasicInfo]
  );

  const balanceQuery = useTrialBalanceQuery(
    financeBookId,
    queryParams,
    enabled
  );

  const summary = useMemo(
    () =>
      buildTrialBalanceSummary(balanceQuery.data, {
        fallbackCurrency,
        asOf: filters.asOf,
        startDate: range.startDate,
        endDate: range.endDate,
        subtotalLabels: {
          assets: t('trialBalance.subtotalAssets'),
          liabilities: t('trialBalance.subtotalLiabilities'),
        },
      }),
    [
      balanceQuery.data,
      fallbackCurrency,
      filters.asOf,
      range.endDate,
      range.startDate,
      t,
    ]
  );

  const activityParams = useMemo(
    () =>
      selectedRow?.accountCode && queryParams
        ? {
            accountCode: selectedRow.accountCode,
            startDate: queryParams.startDate,
            endDate: queryParams.endDate,
          }
        : undefined,
    [queryParams, selectedRow?.accountCode]
  );
  const activityQuery = useTrialBalanceActivityQuery(
    financeBookId,
    activityParams,
    enabled
  );

  const activityRows = useMemo<TrialBalanceActivityRow[]>(
    () =>
      buildTrialBalanceActivityRows(activityQuery.data, {
        accountCode: selectedRow?.accountCode,
        accountName: selectedRow?.accountName,
        currencyCode: balanceQuery.data?.currencyCode || fallbackCurrency,
        tokenType,
      }),
    [
      activityQuery.data,
      balanceQuery.data?.currencyCode,
      fallbackCurrency,
      selectedRow?.accountCode,
      selectedRow?.accountName,
      tokenType,
    ]
  );

  const activityMeta = useMemo<TrialBalanceActivityMeta>(() => {
    const activityData = activityQuery.data;
    const balanceData = balanceQuery.data;
    const firstActivityItem = getTrialBalanceActivityItems(activityData)[0];
    const activityStartDate = activityData?.startDate?.trim();
    const startDateMs = parseDateToMs(activityStartDate);
    const startDateText =
      activityStartDate && /^\d{4}-\d{2}-\d{2}$/.test(activityStartDate)
        ? activityStartDate
        : Number.isFinite(startDateMs)
          ? format(new Date(startDateMs), 'yyyy-MM-dd')
          : undefined;

    return {
      financialBookName:
        toText(activityData?.financialBookName) ||
        toText(activityData?.bookName) ||
        toText(firstActivityItem?.financialBookName) ||
        toText(firstActivityItem?.bookName) ||
        toText(balanceData?.bookName) ||
        basicInfo.financialBookName,
      bookId:
        toText(activityData?.bookId) ||
        toText(activityData?.bookNo) ||
        toText(activityData?.financeBookId) ||
        toText(firstActivityItem?.bookId) ||
        toText(firstActivityItem?.bookNo) ||
        toText(firstActivityItem?.financeBookId) ||
        toText(balanceData?.bookId) ||
        basicInfo.bookId,
      startDateText,
    };
  }, [
    activityQuery.data,
    balanceQuery.data,
    basicInfo.bookId,
    basicInfo.financialBookName,
  ]);

  const openActivity = useCallback(
    (record: TrialBalanceRow) => setSelectedRow(record),
    []
  );
  const closeActivity = useCallback(() => setSelectedRow(null), []);

  const columns = useMemo<ColumnDef<TrialBalanceRow>[]>(
    () =>
      buildTrialBalanceColumns({
        t: (key: string) => t(key),
        onOpenActivity: openActivity,
      }),
    [openActivity, t]
  );

  const activityColumns = useMemo<ColumnDef<TrialBalanceActivityRow>[]>(
    () => buildTrialBalanceActivityColumns({ t: (key: string) => t(key) }),
    [t]
  );

  return {
    filters,
    setFilters,
    summary,
    loading: balanceQuery.isLoading || balanceQuery.isFetching,
    error: balanceQuery.isError,
    columns,
    selectedRow,
    openActivity,
    closeActivity,
    activityRows,
    activityMeta,
    activityColumns,
    activityError: activityQuery.isError,
    activityLoading:
      activityQuery.isLoading || activityQuery.isFetching,
  };
}
