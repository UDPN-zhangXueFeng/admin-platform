'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DetailSection } from '@myorg/shared/ui';
import { FormDateRangePicker, FormSelect } from '@myorg/shared/ui-forms';
import type { EodClearingStatus, EodStatementRow } from '@myorg/modules/td-admin/data-access';
import { QueryForm } from '../query-form';
import type { EodFilters } from './use-eod-balances';

const CLEARING_OPTIONS = {
  settled: 'eod.clearingSettled',
  suspensed: 'eod.clearingSuspensed',
  adjusted: 'eod.clearingAdjusted',
  pending: 'eod.clearingPending',
} as const;

type FilterValues = Omit<EodFilters, 'clearingStatus'> & { clearingStatus: EodClearingStatus | 'all' };
const EMPTY: FilterValues = { rangeFrom: '', rangeTo: '', clearingStatus: 'all' };

export interface EodBalancesContentProps {
  rows: EodStatementRow[];
  columns: ColumnDef<EodStatementRow>[];
  title: string;
  loading: boolean;
  error: boolean;
  initialFilters: EodFilters;
  onApplyFilters: (filters: EodFilters) => void;
  onRetry: () => void;
  t: (key: string) => string;
}

export function EodBalancesContent({ rows, columns, title, loading, error, initialFilters, onApplyFilters, onRetry, t }: EodBalancesContentProps) {
  const { control, handleSubmit, reset } = useForm<FilterValues>({
    defaultValues: { ...initialFilters, clearingStatus: initialFilters.clearingStatus ?? 'all' },
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const apply = ({ clearingStatus, ...dates }: FilterValues) => {
    setPage(1);
    onApplyFilters({ ...dates, clearingStatus: clearingStatus === 'all' ? undefined : clearingStatus });
  };
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(apply)}>
        <QueryForm
          fields={[
            <FormDateRangePicker key="range" startName="rangeFrom" endName="rangeTo" control={control} label={t('eod.postingDate')} />,
            <FormSelect
              key="clearingStatus"
              name="clearingStatus"
              control={control}
              label={t('eod.clearingStatus')}
              options={[
                { value: 'all', label: t('filter.all') },
                ...Object.entries(CLEARING_OPTIONS).map(([value, key]) => ({ value, label: t(key) })),
              ]}
            />,
          ]}
          onReset={() => { reset(EMPTY); apply(EMPTY); }}
          queryType="submit"
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>
      <DetailSection
        title={title}
        loading={loading}
        skeleton="table"
        error={error ? { message: t('common.loadFailed'), retryLabel: t('common.retry'), onRetry } : undefined}
      >
        <DataTable
          columns={columns}
          data={rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          emptyMessage="--"
          pagination={{
            page: currentPage,
            pageSize,
            total: rows.length,
            onPageChange: setPage,
            onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
          }}
        />
      </DetailSection>
    </div>
  );
}
