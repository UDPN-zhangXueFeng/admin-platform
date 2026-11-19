'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button, Card, DataTable, Input } from '@myorg/shared/ui';
import { useAuth } from '@myorg/shared/util-auth';
import { formatAdminTimestamp } from '../format-admin-time';
import { createRowActionsColumn } from '../row-actions';

import {
  useAuditTrailListQuery,
  useCreateExportTaskMutation,
  type AuditTrailItem,
  type AuditTrailListFilters,
  type ExportAuditTaskReq,
} from '@myorg/modules/td-admin/data-access/lib/audit-trail';
import {
  AUDIT_TRAIL_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  resolveTokenTypeMessageKey,
  resolveTxTypeMessageKey,
} from './audit-trail.constants';
import { AuditTrailQueryForm } from './audit-trail-query-form';
import { EMPTY_FORM, formatAuditAmount, toAuditTrailFilters, type AuditTrailFilterForm } from './audit-trail.filters';

export function AuditTrailListPage() {
  const t = useTranslations('modules.audit-trail');
  const router = useRouter();
  const { permissions } = useAuth();
  const canViewDetail = permissions.has(AUDIT_TRAIL_PERMISSIONS.VIEW_DETAIL);
  const canExportAll = permissions.has(AUDIT_TRAIL_PERMISSIONS.EXPORT_ALL);
  const canExportRow = permissions.has(AUDIT_TRAIL_PERMISSIONS.EXPORT_ROW);

  const { register, control, handleSubmit, getValues, reset } =
    useForm<AuditTrailFilterForm>({ defaultValues: EMPTY_FORM });

  const [filters, setFilters] = React.useState<AuditTrailListFilters>({});
  const [jumpPage, setJumpPage] = React.useState('');
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = { ...pagination, filters };

  const listResult = useAuditTrailListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const { mutate: createExportTask, isPending: exportPending } = useCreateExportTaskMutation();

  const handleExport = React.useCallback(
    (req: ExportAuditTaskReq) => {
      createExportTask(req, {
        onSuccess: () =>
          toast.success(t('exportSuccess'), {
            description: t('exportDescription'),
            action: {
              label: t('downloadCenter'),
              onClick: () => router.push('/data-export'),
            },
          }),
        onError: (error) => toast.error(t('exportFailed'), { description: error.message }),
      });
    },
    [createExportTask, router, t],
  );

  const columns = React.useMemo<ColumnDef<AuditTrailItem>[]>(
    () => [
      {
        accessorKey: 'traceId',
        header: t('field.traceId'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.traceId || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'txFrom',
        header: t('field.txFrom'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.txFrom || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'txTo',
        header: t('field.txTo'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.txTo || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'txType',
        header: t('field.txType'),
        cell: ({ row }) => {
          const key = resolveTxTypeMessageKey(row.original.txType);
          return <span>{key && t.has(key) ? t(key) : (row.original.txType ?? EMPTY_DISPLAY)}</span>;
        },
      },
      {
        accessorKey: 'tokenName',
        header: t('field.tokenName'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('field.tokenType'),
        cell: ({ row }) => {
          const key = resolveTokenTypeMessageKey(row.original.tokenType);
          return <span>{key && t.has(key) ? t(key) : (row.original.tokenType ?? EMPTY_DISPLAY)}</span>;
        },
      },
      {
        accessorKey: 'blockchainName',
        header: t('field.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'txAmount',
        header: t('field.txAmount'),
        cell: ({ row }) => formatAuditAmount(row.original.txAmount, row.original.symbol),
      },
      {
        accessorKey: 'txTime',
        header: t('field.txTime'),
        cell: ({ row }) => (
          <span>
            {row.original.txTime
              ? formatAdminTimestamp(row.original.txTime)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'txHash',
        header: t('field.txHash'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.txHash || EMPTY_DISPLAY}
          </span>
        ),
      },
      createRowActionsColumn<AuditTrailItem>({
        header: t('field.actions'),
        detail: canViewDetail
          ? (row) => row.traceId ? {
              label: t('action.detail'),
              onClick: () => router.push(`/accounting/audit-trail/view?id=${encodeURIComponent(row.traceId)}`),
            } : undefined
          : undefined,
        menu: (row) =>
          canExportRow && row.traceId
            ? [
                {
                  label: t('action.export'),
                  disabled: exportPending,
                  onClick: () =>
                    handleExport({
                      exportType: 1,
                      moduleType: 10,
                      auditTrailDownloadReqVO: { traceId: row.traceId },
                    }),
                },
              ]
            : [],
      }),
    ],
    [t, router, handleExport, canExportRow, canViewDetail, exportPending],
  );

  const onSubmit = (form: AuditTrailFilterForm) => {
    const next = toAuditTrailFilters(form, 'list');
    if (JSON.stringify(next) === JSON.stringify(filters)) {
      void listResult.refetch();
      return;
    }
    setFilters(next);
  };
  const totalPages = Math.ceil(total / pagination.pageSize);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <AuditTrailQueryForm register={register} control={control} onReset={() => reset(EMPTY_FORM)} />
      </form>

      <Card>
        <div className="flex min-h-12 items-center justify-between border-b px-6 py-3 text-sm font-semibold">
          {t('list.title')}
          {canExportAll && (
            <Button
              type="button"
              loading={exportPending}
              onClick={() => handleExport({
                exportType: 1,
                moduleType: 10,
                auditTrailDownloadReqVO: toAuditTrailFilters(getValues(), 'export'),
              })}
            >
              {t('action.export')}
            </Button>
          )}
        </div>
        <div className="p-4">
          {listResult.isError && <p role="alert" className="mb-3 text-sm text-destructive">{t('loadFailed')}</p>}
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              disabled: isLoading,
              pageSizeOptions: [10, 20, 50, 100],
              onPageChange: (pageNum) => setPagination((prev) => ({ ...prev, pageNum })),
              onPageSizeChange: (pageSize) => setPagination({ pageNum: 1, pageSize }),
            }}
          />
          {totalPages > 1 && (
            <form className="mt-2 flex items-center justify-end gap-2" onSubmit={(event) => {
              event.preventDefault();
              const pageNum = Number(jumpPage);
              if (isLoading || !Number.isInteger(pageNum) || pageNum < 1 || pageNum > totalPages) return;
              setPagination((prev) => ({ ...prev, pageNum }));
              setJumpPage('');
            }}>
              <label htmlFor="audit-trail-jump-page" className="text-sm">{t('filter.jumpToPage')}</label>
              <Input id="audit-trail-jump-page" className="w-24" type="number" min={1} max={totalPages} required
                value={jumpPage} onChange={(event) => setJumpPage(event.target.value)} disabled={isLoading} />
              <Button type="submit" variant="outline" disabled={isLoading}>{t('filter.go')}</Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
