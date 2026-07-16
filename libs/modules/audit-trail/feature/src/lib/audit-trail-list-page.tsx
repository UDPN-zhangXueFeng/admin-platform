'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';

import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';

import {
  useAuditTrailListQuery,
  useBlockchainListQuery,
  useCreateExportTaskMutation,
  useStablecoinSearchesQuery,
  type AuditTrailItem,
  type AuditTrailListFilters,
  type ExportAuditTaskReq,
} from '@myorg/modules/audit-trail/data-access';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  FIXED_TOKEN_TYPES,
  TX_TYPE_VALUES,
  resolveTokenTypeMessageKey,
  resolveTxTypeMessageKey,
} from '@myorg/modules/audit-trail/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** react-hook-form 筛选表单（文本空串 / 下拉 ALL_VALUE = 无筛选；日期 YYYY-MM-DD）。 */
interface AuditTrailFilterForm {
  traceId: string;
  txFrom: string;
  txTo: string;
  txType: string;
  tokenName: string;
  tokenType: string;
  blockchainId: string;
  txTimeFrom: string;
  txTimeTo: string;
  txHash: string;
}

const EMPTY_FORM: AuditTrailFilterForm = {
  traceId: '',
  txFrom: '',
  txTo: '',
  txType: ALL_VALUE,
  tokenName: ALL_VALUE,
  tokenType: ALL_VALUE,
  blockchainId: ALL_VALUE,
  txTimeFrom: '',
  txTimeTo: '',
  txHash: '',
};

function formToFilters(form: AuditTrailFilterForm): AuditTrailListFilters {
  return {
    traceId: form.traceId.trim() || undefined,
    txFrom: form.txFrom.trim() || undefined,
    txTo: form.txTo.trim() || undefined,
    txType: form.txType !== ALL_VALUE ? form.txType : undefined,
    tokenName: form.tokenName !== ALL_VALUE ? form.tokenName : undefined,
    tokenType:
      form.tokenType !== ALL_VALUE ? Number(form.tokenType) : undefined,
    blockchainId:
      form.blockchainId !== ALL_VALUE ? form.blockchainId : undefined,
    txStartTime: form.txTimeFrom
      ? startOfDay(parseISO(form.txTimeFrom)).getTime()
      : undefined,
    txEndTime: form.txTimeTo
      ? endOfDay(parseISO(form.txTimeTo)).getTime()
      : undefined,
    txHash: form.txHash.trim() || undefined,
  };
}

/**
 * AuditTrailListPage — 审计追踪列表页。
 *
 * 迁移自 td-manage src/pages/financial/audit-trail/index.tsx（506 行）。
 * useCustomTable → RHF + DataTable。保留：10 字段筛选（traceId/txFrom/txTo/txType/
 * tokenName/tokenType/blockchainId/txTime 范围/txHash）、10 列、View 详情跳转、
 * Download 行导出 + 顶部 Download 全筛选导出。源 Drawer 导出规则为死代码，不迁移。
 */
export function AuditTrailListPage() {
  const t = useTranslations('modules.audit-trail');
  const router = useRouter();

  const { register, control, handleSubmit, reset } =
    useForm<AuditTrailFilterForm>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<AuditTrailFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );

  const listResult = useAuditTrailListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const stablecoinSearches = useStablecoinSearchesQuery();
  const blockchainList = useBlockchainListQuery();
  const exportMutation = useCreateExportTaskMutation();

  const txTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...TX_TYPE_VALUES.map((v) => ({ value: String(v), label: t(`txType.${v}`) })),
    ],
    [t],
  );
  const tokenNameOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(stablecoinSearches.data ?? []).map((s) => ({
        value: s.name ?? '',
        label: s.name ?? '',
      })),
    ],
    [t, stablecoinSearches.data],
  );
  const tokenTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...FIXED_TOKEN_TYPES.map((v) => ({
        value: String(v),
        label: t(`tokenType.${v}`),
      })),
    ],
    [t],
  );
  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(blockchainList.data ?? []).map((b) => ({
        value: String(b.key ?? ''),
        label: b.value ?? '',
      })),
    ],
    [t, blockchainList.data],
  );

  const handleExport = React.useCallback(
    (req: ExportAuditTaskReq) => {
      exportMutation.mutate(req, {
        onSuccess: () => toast.success(t('exportSuccess')),
        onError: () => toast.error(t('exportFailed')),
      });
    },
    [exportMutation, t],
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
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
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
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
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
        cell: ({ row }) => (
          <span>
            {row.original.txAmount != null
              ? `${row.original.txAmount} ${row.original.symbol ?? ''}`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'txTime',
        header: t('field.txTime'),
        cell: ({ row }) => (
          <span>
            {row.original.txTime
              ? formatDate(row.original.txTime, DATETIME_FMT)
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
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => (
          <div className="flex gap-3">
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(`/audit-trail/view?id=${row.original.traceId}`)
              }
            >
              {t('action.detail')}
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                handleExport({
                  exportType: 1,
                  moduleType: 10,
                  auditTrailDownloadReqVO: { traceId: row.original.traceId },
                })
              }
            >
              {t('action.export')}
            </Button>
          </div>
        ),
      },
    ],
    [t, router, handleExport],
  );

  const onSubmit = React.useCallback((form: AuditTrailFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryValues(form);
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="traceId"
            label={t('field.traceId')}
            register={register('traceId')}
            placeholder={t('field.traceId')}
          />
          <FormField
            name="txFrom"
            label={t('field.txFrom')}
            register={register('txFrom')}
            placeholder={t('field.txFrom')}
          />
          <FormField
            name="txTo"
            label={t('field.txTo')}
            register={register('txTo')}
            placeholder={t('field.txTo')}
          />
          <FormSelect
            name="txType"
            control={control}
            label={t('field.txType')}
            options={txTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="tokenName"
            control={control}
            label={t('field.tokenName')}
            options={tokenNameOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('field.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label={t('field.blockchain')}
            options={blockchainOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="txTimeFrom"
            control={control}
            label={t('field.txTimeFrom')}
          />
          <FormDatePicker
            name="txTimeTo"
            control={control}
            label={t('field.txTimeTo')}
          />
          <FormField
            name="txHash"
            label={t('field.txHash')}
            register={register('txHash')}
            placeholder={t('field.txHash')}
          />
          <div className="flex items-end gap-2 pb-1">
            <Button
              type="button"
              onClick={() =>
                handleExport({
                  exportType: 1,
                  moduleType: 10,
                  auditTrailDownloadReqVO: formToFilters(queryValues),
                })
              }
              disabled={exportMutation.isPending}
            >
              {t('action.export')}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('filter.query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('filter.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('list.title')}
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
            }}
          />
        </div>
      </div>
    </div>
  );
}
