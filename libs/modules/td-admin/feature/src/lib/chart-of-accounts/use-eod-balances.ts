'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@myorg/shared/ui';
import {
  buildEodStatementDetail,
  buildEodStatementRows,
  getUtc8DayTimestampRange,
  useEodBalancesQuery,
  useEodStatementDetailQuery,
  type EodClearingStatus,
  type EodStatementRow,
} from '@myorg/modules/td-admin/data-access';
import { buildEodColumns, buildFirstBookEodColumns } from './eod-columns';

export interface EodFilters {
  rangeFrom: string;
  rangeTo: string;
  clearingStatus?: EodClearingStatus;
}

export function useEodBalances({ financeBookId, detailId, currency, enabled }: {
  financeBookId?: number;
  detailId: string;
  currency: string;
  enabled: boolean;
}) {
  const t = useTranslations('modules.chart-of-accounts');
  const toast = useToast();
  const [appliedFilters, onApplyFilters] = useState<EodFilters>({ rangeFrom: '', rangeTo: '' });
  const [selectedStatement, setSelectedStatement] = useState<EodStatementRow | null>(null);
  const { rangeFrom, rangeTo, clearingStatus } = appliedFilters;
  const range = getUtc8DayTimestampRange(rangeFrom, rangeTo);
  const balancesQuery = useEodBalancesQuery(financeBookId, {
    ...range,
    pageNum: 1,
    pageSize: 10,
  }, enabled);

  const filteredEodRows = useMemo(() =>
    buildEodStatementRows(balancesQuery.data, currency).filter(
      (row) => !clearingStatus || row.clearingStatus === clearingStatus
    ), [balancesQuery.data, currency, clearingStatus]);
  const eodId = selectedStatement?.financeBookEodId;
  const detailQuery = useEodStatementDetailQuery(eodId, enabled && !!eodId);
  const selectedDetail = useMemo(
    () => buildEodStatementDetail(detailQuery.data, currency, selectedStatement),
    [detailQuery.data, currency, selectedStatement]
  );
  const openDetail = useCallback((record: EodStatementRow) => {
    if (!record.financeBookEodId) {
      toast.error(t('missingEodId'));
      return;
    }
    setSelectedStatement(record);
  }, [t, toast]);
  const closeDetail = useCallback(() => setSelectedStatement(null), []);
  const isFirstBook = detailId === '1';
  const columns = useMemo(() => (isFirstBook ? buildFirstBookEodColumns : buildEodColumns)({ t, onOpenDetail: openDetail }),
    [t, isFirstBook, openDetail]);

  return {
    appliedFilters,
    filteredEodRows,
    columns,
    isFirstBook,
    balancesLoading: balancesQuery.isFetching,
    balancesError: balancesQuery.isError,
    retryBalances: () => { void balancesQuery.refetch(); },
    selectedStatement,
    selectedDetail,
    detailLoading: detailQuery.isFetching,
    detailError: detailQuery.isError,
    drawerOpen: enabled && !!selectedStatement && selectedStatement.clearingStatus !== 'pending',
    reviewOpen: enabled && selectedStatement?.clearingStatus === 'pending',
    closeDetail,
    onApplyFilters,
  };
}
