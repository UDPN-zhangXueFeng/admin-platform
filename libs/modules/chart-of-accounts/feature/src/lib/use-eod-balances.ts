'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import {
  buildEodStatementDetail,
  buildEodStatementRows,
  getUtc8DayTimestampRange,
  useEodBalancesQuery,
  useEodStatementDetailQuery,
  type EodClearingStatus,
  type EodStatementDetail,
  type EodStatementRow,
} from '@myorg/modules/chart-of-accounts/data-access';

import { getFinancialBookMetaById } from './financial-book-meta';
import { buildEodColumns, buildFirstBookEodColumns } from './eod-columns';

export interface UseEodBalancesOptions {
  financeBookId: number | undefined;
  /** 账本 meta id（'1' / '2'）。 */
  detailId: string;
  /** 账本货币（fallback + 金额格式化）。 */
  currency: string;
  enabled?: boolean;
}

/**
 * useEodBalances — EOD Statements tab 的状态与操作。
 *
 * 迁移自源 useChartOfAccounts 的 EOD 部分：余额列表（服务端按 range 查询 + 客户端
 * clearingStatus 过滤）、明细（drawer / review modal）、post-to-suspense（modal）。
 */
export function useEodBalances({
  financeBookId,
  detailId,
  currency,
  enabled = true,
}: UseEodBalancesOptions) {
  const t = useTranslations('modules.chart-of-accounts');
  const [appliedRange, setAppliedRange] = useState<[number, number] | null>(null);
  const [appliedClearing, setAppliedClearing] = useState<EodClearingStatus | undefined>(
    undefined
  );
  const [selectedStatement, setSelectedStatement] = useState<EodStatementRow | null>(null);
  const [postToSuspenseStatement, setPostToSuspenseStatement] =
    useState<EodStatementRow | null>(null);

  const bookMeta = useMemo(() => getFinancialBookMetaById(detailId), [detailId]);
  const isFirstBook = bookMeta.id === '1';

  const rangeTs = useMemo(() => getUtc8DayTimestampRange(appliedRange), [appliedRange]);

  const balancesQuery = useEodBalancesQuery(
    financeBookId,
    {
      startDate: rangeTs?.startDate,
      endDate: rangeTs?.endDate,
      pageNum: 1,
      pageSize: 10,
    },
    enabled
  );

  const eodRows = useMemo(
    () => buildEodStatementRows(balancesQuery.data, currency),
    [balancesQuery.data, currency]
  );

  // 客户端再过滤 clearingStatus（range 已在服务端过滤）
  const filteredEodRows = useMemo(() => {
    return eodRows.filter((row) => {
      if (appliedClearing && row.clearingStatus !== appliedClearing) return false;
      return true;
    });
  }, [eodRows, appliedClearing]);

  // 明细查询：仅 details / review-confirm 时
  const selectedEodId =
    selectedStatement &&
    (selectedStatement.actionType === 'details' ||
      selectedStatement.actionType === 'review-confirm')
      ? selectedStatement.financeBookEodId
      : undefined;
  const detailQuery = useEodStatementDetailQuery(selectedEodId, Boolean(selectedEodId));
  const selectedDetail = useMemo<EodStatementDetail | null>(
    () => buildEodStatementDetail(detailQuery.data, currency, selectedStatement),
    [detailQuery.data, currency, selectedStatement]
  );

  const openDetail = useCallback((record: EodStatementRow) => {
    if (!record.financeBookEodId) return;
    setSelectedStatement({
      ...record,
      actionType:
        record.clearingStatus === 'pending' ? 'review-confirm' : 'details',
    });
  }, []);

  const closeDetail = useCallback(() => setSelectedStatement(null), []);

  const openPostToSuspense = useCallback(
    (record: EodStatementRow) => setPostToSuspenseStatement(record),
    []
  );
  const closePostToSuspense = useCallback(() => setPostToSuspenseStatement(null), []);

  const onApplyFilters = useCallback(
    (range: [number, number] | null, clearing?: EodClearingStatus) => {
      setAppliedRange(range);
      setAppliedClearing(clearing);
    },
    []
  );

  const columns = useMemo<ColumnDef<EodStatementRow>[]>(() => {
    const opts = {
      t: (key: string) => t(key),
      onOpenDetail: openDetail,
      onPostToSuspense: openPostToSuspense,
    };
    return isFirstBook ? buildFirstBookEodColumns(opts) : buildEodColumns(opts);
  }, [t, isFirstBook, openDetail, openPostToSuspense]);

  return {
    filteredEodRows,
    columns,
    isFirstBook,
    balancesLoading: balancesQuery.isLoading,
    selectedStatement,
    selectedDetail,
    detailLoading: detailQuery.isLoading,
    drawerOpen:
      !!selectedStatement && selectedStatement.actionType === 'details',
    reviewOpen:
      !!selectedStatement && selectedStatement.actionType === 'review-confirm',
    postToSuspenseStatement,
    postToSuspenseOpen: !!postToSuspenseStatement,
    openDetail,
    closeDetail,
    openPostToSuspense,
    closePostToSuspense,
    onApplyFilters,
  };
}
