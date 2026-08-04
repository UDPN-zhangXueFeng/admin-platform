'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, toast } from '@myorg/shared/ui';
import { downloadExportFile, useExportTaskList, type ExportTask } from '@myorg/modules/data-export/data-access';

/** exportState → 静态 Tailwind 类名（动态拼接会被 JIT 清理，故预声明完整类串）。 */
const STATUS_TONE: Record<number, string> = {
  0: 'text-orange-700 bg-orange-100',
  1: 'text-blue-700 bg-blue-100',
  2: 'text-green-700 bg-green-100',
  3: 'text-red-700 bg-red-100',
};

type ExportRow = ExportTask & { id: string };

export function DataExportPage() {
  const t = useTranslations('modules.financial');
  const tc = useTranslations('common');
  const [pg, setPg] = React.useState({ page: 1, pageSize: 10 });
  const { data, isLoading } = useExportTaskList(pg.page, pg.pageSize);
  const [spinning, setSpinning] = React.useState(false);

  const rows = React.useMemo<ExportRow[]>(
    () => (data?.rows ?? []).map((r, i) => ({ ...r, id: String(r.spId || i) })),
    [data],
  );

  const handleDownload = React.useCallback(
    async (row: ExportTask) => {
      setSpinning(true);
      try {
        const blob = await downloadExportFile(row.busId, row.busType);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${row.fileId}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(tc('PUB_Success'));
      } finally {
        setSpinning(false);
      }
    },
    [tc],
  );

  const cols = React.useMemo<ColumnDef<ExportRow>[]>(
    () => [
      { id: 'index', header: tc('PUB_Index'), cell: ({ row }) => row.index + 1 },
      { accessorKey: 'moduleType', header: t('financial_0056'), cell: ({ row }) => t(`module_type_${row.original.moduleType}`) },
      { accessorKey: 'fileId', header: t('financial_0076') },
      { accessorKey: 'fileHash', header: t('financial_0040'), cell: ({ row }) => row.original.fileHash || '--' },
      { accessorKey: 'exportTime', header: t('financial_0055'), cell: ({ row }) => new Date(Number(row.original.exportTime)).toLocaleString() },
      { accessorKey: 'exportUserName', header: tc('PUB_Creater'), cell: ({ row }) => row.original.exportUserName || '--' },
      {
        accessorKey: 'exportState',
        header: tc('PUB_Status'),
        cell: ({ row }) => (
          <span className={`px-2 py-1 rounded text-xs ${STATUS_TONE[row.original.exportState] ?? 'text-gray-700 bg-gray-100'}`}>
            {t(`export_status_${row.original.exportState}`)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: tc('PUB_Operation'),
        cell: ({ row }) => (
          <Button
            variant="link"
            className="h-auto p-0"
            disabled={row.original.exportState !== 2 || spinning}
            onClick={() => handleDownload(row.original)}
          >
            {tc('PUB_Download')}
          </Button>
        ),
      },
    ],
    [t, tc, spinning, handleDownload],
  );

  return (
    <DataTable
      columns={cols}
      data={rows}
      pagination={{
        page: pg.page,
        pageSize: pg.pageSize,
        total: data?.page?.total || 0,
        onPageChange: (page) => setPg((prev) => ({ ...prev, page })),
      }}
      isLoading={isLoading || spinning}
    />
  );
}
