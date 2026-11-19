'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import type { ColumnDef } from '@tanstack/react-table';
import { useToast } from '@myorg/shared/ui';
import {
  buildOperationRecordListParams,
  buildOperationRecordRow,
  DEFAULT_PAGE_SIZE,
  useOperationRecordsQuery,
  type OperationFilterState,
  type OperationRecordRow,
} from '@myorg/modules/td-admin/data-access';

import { buildOperationRecordColumns } from './operation-record-columns';

const EMPTY_FILTERS: OperationFilterState = { creationDateRange: null };

export interface UseOperationRecordsOptions {
  financeBookId: number | undefined;
  /** Tab 激活时才发请求。 */
  enabled: boolean;
}

/**
 * useOperationRecords — Operation Records tab 的状态与数据。
 *
 * 迁移自源 `useChartOfAccounts` 的 Operation Records 部分：已应用筛选 + 服务端
 * 分页、明细 drawer、审批详情跳转（缺少 taskId/busCode 时提示）。
 */
export function useOperationRecords({
  financeBookId,
  enabled,
}: UseOperationRecordsOptions) {
  const t = useTranslations('modules.chart-of-accounts');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const toast = useToast();

  const [appliedFilters, setAppliedFilters] =
    useState<OperationFilterState>(EMPTY_FILTERS);
  const [pagination, setPagination] = useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = useMemo(
    () =>
      buildOperationRecordListParams(
        appliedFilters,
        pagination.pageNum,
        pagination.pageSize
      ),
    [appliedFilters, pagination.pageNum, pagination.pageSize]
  );

  const recordsQuery = useOperationRecordsQuery(
    financeBookId,
    params,
    enabled
  );

  const rows = useMemo<OperationRecordRow[]>(
    () => (recordsQuery.data?.rows ?? []).map(buildOperationRecordRow),
    [recordsQuery.data?.rows]
  );
  const total = recordsQuery.data?.page?.total ?? 0;

  const applyFilters = useCallback((filters: OperationFilterState) => {
    setAppliedFilters(filters);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setAppliedFilters(EMPTY_FILTERS);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, []);

  const goToPage = useCallback((pageNum: number) => {
    setPagination((prev) => ({ ...prev, pageNum }));
  }, []);

  const changePageSize = useCallback((pageSize: number) => {
    setPagination({ pageNum: 1, pageSize });
  }, []);


  const openWorkflowDetail = useCallback(
    (record: OperationRecordRow) => {
      if (!record.taskId || !record.busCode) {
        toast.error(t('operationRecords.missingTask'));
        return;
      }
      const query = new URLSearchParams({ id: String(record.taskId), busCode: record.busCode });
      router.push(`/approval-manage/view?${query.toString()}`);
    },
    [router, t, toast]
  );

  const columns = useMemo<ColumnDef<OperationRecordRow>[]>(
    () =>
      buildOperationRecordColumns({
        t: (key: string) => t(key),
        tCommon: (key: string) => tCommon(key),
        onOpenDetails: openWorkflowDetail,
      }),
    [openWorkflowDetail, t, tCommon]
  );

  return {
    rows,
    total,
    loading: recordsQuery.isLoading || recordsQuery.isFetching,
    error: recordsQuery.isError,
    columns,
    pagination,
    appliedFilters,
    applyFilters,
    resetFilters,
    goToPage,
    changePageSize,
  };
}
