'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { hashKey } from '@tanstack/react-query';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { Button, Card, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { DEFAULT_PAGE_SIZE } from './wallet.constants';

export const FIRST_PAGE = { pageNum: 1, pageSize: DEFAULT_PAGE_SIZE };
export type WalletPage = typeof FIRST_PAGE;

export function useWalletTableState<F extends object>(initialFilters: F) {
  const [request, setRequest] = useState({ ...FIRST_PAGE, filters: initialFilters });
  return {
    request,
    apply: (filters: F, refetch: () => unknown, resetSize = false) => {
      const next = { pageNum: 1, pageSize: resetSize ? DEFAULT_PAGE_SIZE : request.pageSize, filters };
      if (hashKey([request]) === hashKey([next])) void refetch();
      else setRequest(next);
    },
    onPageChange: (pageNum: number) => setRequest((prev) => ({ ...prev, pageNum })),
    onPageSizeChange: (pageSize: number) => setRequest((prev) => ({ ...prev, pageNum: 1, pageSize })),
  };
}

export function WalletLoadError({ retry }: { retry: () => void }) {
  const t = useTranslations('modules.wallet.userWallet');
  return (
    <div role="alert" className="flex items-center gap-3 p-4 text-sm">
      <span className="text-destructive">{t('loadFailed')}</span>
      <Button type="button" variant="outline" size="sm" onClick={retry}>{t('retry')}</Button>
    </div>
  );
}

export function UserWalletTable<R extends { id: string }>({
  title, columns, query, page, onPageChange, onPageSizeChange, children,
}: {
  title: string;
  columns: ColumnDef<R>[];
  query: {
    data?: { rows: R[]; page?: { total?: number } };
    isFetching: boolean;
    isError: boolean;
    refetch: () => unknown;
  };
  page: WalletPage;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  children?: ReactNode;
}) {
  const t = useTranslations('modules.wallet');
  const total = query.data?.page?.total ?? 0;
  const copyLabel = t('userWallet.copy');
  const copyableColumns = columns.map((column): ColumnDef<R> => {
    const { cell } = column;
    return { ...column, cell: (context: CellContext<R, unknown>) => {
      const value: unknown = typeof cell === 'function' ? cell(context) : cell ?? context.getValue();
      return typeof value === 'string' || typeof value === 'number'
        ? <CopyableEllipsisText value={value} copyLabel={copyLabel} />
        : value;
    } };
  });
  return (
    <section className="space-y-4">
      {children}
      <Card>
        <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
        {query.isError ? <WalletLoadError retry={query.refetch} /> : (
          <div className="space-y-2 p-4">
            <DataTable
              columns={copyableColumns}
              data={query.data?.rows ?? []}
              isLoading={query.isFetching}
              emptyMessage={t('common.noData')}
              pagination={{
                page: page.pageNum, pageSize: page.pageSize, total,
                pageSizeOptions: [10, 20, 50, 100], onPageChange, onPageSizeChange,
              }}
            />
          </div>
        )}
      </Card>
    </section>
  );
}
