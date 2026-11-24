'use client';

import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, Input, Label } from '@myorg/shared/ui';

export interface ReconPage {
  pageNum: number;
  pageSize: number;
}

export function RealTimeTable<Row extends { id: string }>({
  columns, rows, total, loading, error, page, onPageChange,
}: {
  columns: ColumnDef<Row>[];
  rows: Row[];
  total: number;
  loading: boolean;
  error: boolean;
  page: ReconPage;
  onPageChange: (page: ReconPage) => void;
}) {
  const t = useTranslations('modules.reconciliation');
  const pageCount = Math.ceil(total / page.pageSize);
  if (error) return <p role="alert" className="text-sm text-destructive">{t('realTimeLoadError')}</p>;
  return (
    <div className="space-y-2">
      <DataTable columns={columns} data={rows} emptyMessage={t('common_no_data')} isLoading={loading}
        pagination={{
          page: page.pageNum, pageSize: page.pageSize, total, disabled: loading,
          onPageChange: (pageNum) => onPageChange({ ...page, pageNum }),
          onPageSizeChange: (pageSize) => onPageChange({ pageNum: 1, pageSize }),
          pageSizeOptions: [10, 20, 50, 100],
        }} />
      {pageCount > 1 && (
        <form className="flex items-center justify-end gap-2" onSubmit={(event) => {
          event.preventDefault();
          const pageNum = Number(new FormData(event.currentTarget).get('page'));
          if (Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= pageCount) onPageChange({ ...page, pageNum });
        }}>
          <Label htmlFor="reconciliation-jump">{t('realTimeJumpToPage')}</Label>
          <Input key={page.pageNum} id="reconciliation-jump" name="page" type="number" required min={1} max={pageCount}
            defaultValue={page.pageNum} disabled={loading} className="w-20" />
          <Button type="submit" size="sm" variant="outline" disabled={loading}>{t('realTimeGoToPage')}</Button>
        </form>
      )}
    </div>
  );
}
