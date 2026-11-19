'use client';

import { isValidElement, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, Card, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { DEFAULT_PAGE_SIZE } from './wallet.constants';

interface OperationalWalletPaging {
  page: { pageNum: number; pageSize: number };
  onPageChange: (pageNum: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function useOperationalWalletPage(): OperationalWalletPaging {
  const [page, setPage] = useState({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  return {
    page,
    onPageChange: (pageNum: number) => setPage((prev) => ({ ...prev, pageNum })),
    onPageSizeChange: (pageSize: number) => setPage({ pageNum: 1, pageSize }),
  };
}

export function OperationalWalletLoadError({ retry }: { retry: () => unknown }) {
  const t = useTranslations('modules.wallet.operationalWallet');
  return (
    <div role="alert" className="flex items-center gap-3 p-4 text-sm">
      <span className="text-destructive">{t('loadFailed')}</span>
      <Button type="button" size="sm" variant="outline" onClick={() => void retry()}>{t('retry')}</Button>
    </div>
  );
}

export function OperationalWalletTable<R extends { id: string }>({
  title,
  columns,
  query,
  paging,
}: {
  title: string;
  columns: ColumnDef<R>[];
  query: {
    data?: { rows: R[]; page?: { total?: number } };
    isFetching: boolean;
    isError: boolean;
    isPlaceholderData?: boolean;
    refetch: () => unknown;
  };
  paging: OperationalWalletPaging;
}) {
  const t = useTranslations('modules.wallet');
  const total = query.data?.page?.total ?? 0;
  const staleTotals = query.isPlaceholderData === true;
  const { page: { pageNum, pageSize }, onPageChange, onPageSizeChange } = paging;
  const pageCount = Math.ceil(total / pageSize);
  useEffect(() => {
    if (staleTotals || query.isFetching) return;
    const maxPage = Math.max(1, pageCount);
    if (pageNum > maxPage) onPageChange(maxPage);
  }, [staleTotals, query.isFetching, pageCount, pageNum, onPageChange]);
  const copyLabel = t('operationalWallet.copy');
  const copySuccess = t('operationalWallet.copySuccess');
  const copyFailed = t('operationalWallet.copyFailed');
  const copyableColumns = useMemo(() => columns.map((column): ColumnDef<R> => {
    if (column.id === 'actions') return column;
    const { cell } = column;
    return {
      ...column,
      meta: { ...column.meta, overflow: 'none' },
      cell: (context) => {
        const value: unknown = typeof cell === 'function' ? cell(context) : cell ?? context.getValue();
        return typeof value === 'number' || typeof value === 'string'
          ? <CopyableEllipsisText value={value} copyLabel={copyLabel} copySuccessMessage={copySuccess} copyErrorMessage={copyFailed} />
          : isValidElement(value) ? value : null;
      },
    };
  }), [columns, copyLabel, copySuccess, copyFailed]);

  return (
    <Card>
      <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      {query.isError && !query.isFetching ? <OperationalWalletLoadError retry={query.refetch} /> : (
        <div className="space-y-2 p-4">
          <DataTable
            columns={copyableColumns}
            data={query.data?.rows ?? []}
            isLoading={query.isFetching}
            emptyMessage={t('common.noData')}
            pagination={total > 0 ? {
              page: pageNum,
              pageSize,
              total,
              onPageChange,
              onPageSizeChange: total > 50 ? onPageSizeChange : undefined,
              pageSizeOptions: [10, 20, 50, 100],
              disabled: staleTotals,
            } : undefined}
          />
        </div>
      )}
    </Card>
  );
}
