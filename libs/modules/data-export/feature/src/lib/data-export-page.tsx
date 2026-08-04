'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type DataTablePagination } from '@myorg/shared/ui';
import { toast } from '@myorg/shared/ui';
import type { ExportTask } from '@myorg/modules/data-export/data-access';
import { useExportTaskList } from '@myorg/modules/data-export/data-access';

const STATUS_COLORS: Record<number, string> = { 0: 'orange', 1: 'processing', 2: 'success', 3: 'error' };

export function DataExportPage() {
  const t = useTranslations('modules.financial'); const tc = useTranslations('common');
  const [pg, setPg] = React.useState<DataTablePagination>({ pageNum: 1, pageSize: 10 });
  const { data, isLoading } = useExportTaskList(pg.pageNum, pg.pageSize);
  const [spinning, setSpinning] = React.useState(false);

  const cols = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'spId' as const, cell: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { id: 'moduleType', header: t('financial_0056'), accessorKey: 'moduleType' as const, cell: ({ getValue }: { getValue: () => number }) => t(`module_type_${getValue()}`) },
    { id: 'fileId', header: t('financial_0076'), accessorKey: 'fileId' as const },
    { id: 'fileHash', header: t('financial_0040'), accessorKey: 'fileHash' as const, cell: ({ getValue }: { getValue: () => string }) => getValue() || '--' },
    { id: 'exportTime', header: t('financial_0055'), accessorKey: 'exportTime' as const, cell: ({ getValue }: { getValue: () => string }) => new Date(Number(getValue())).toLocaleString() },
    { id: 'exportUserName', header: tc('PUB_Creater'), accessorKey: 'exportUserName' as const, cell: ({ getValue }: { getValue: () => string }) => getValue() || '--' },
    { id: 'exportState', header: tc('PUB_Status'), accessorKey: 'exportState' as const, cell: ({ getValue }: { getValue: () => number }) => <span className={`px-2 py-1 rounded text-xs bg-${STATUS_COLORS[getValue()] || 'gray'}-100 text-${STATUS_COLORS[getValue()] || 'gray'}-700`}>{t(`export_status_${getValue()}`)}</span> },
  ];

  return (
    <DataTable columns={cols} data={(data?.rows || []).map((r, i) => ({ ...r, id: String(r.spId || i) }))} pagination={{ ...pg, total: data?.page?.total || 0 }} onPaginationChange={setPg} isLoading={isLoading || spinning}
      actions={[{ key: 'Download', label: tc('PUB_Download'), limit: '33053b32b93346239d6fcd120cb67040', disabled: (r: ExportTask) => r.exportState !== 2 }]}
      onAction={async (key, row) => { if (key === 'Download') { setSpinning(true); try { const { downloadExportFile } = await import('@myorg/modules/data-export/data-access'); const res = await downloadExportFile(row.busId, row.busType); const blob = new Blob([res as unknown as BlobPart]); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `export-${row.fileId}.xlsx`; a.click(); URL.revokeObjectURL(a.href); toast.success(tc('PUB_Success')); } finally { setSpinning(false); } } }}
    />
  );
}
