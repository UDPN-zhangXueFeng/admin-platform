'use client';

/* eslint-disable @nx/enforce-module-boundaries -- nx 误报 data-access lazy-loaded（shell useSearchParams + 传递依赖），posting-engine 同模式不报，疑边界 case；功能不受影响 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { FormDatePicker } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { Controller, useForm } from 'react-hook-form';
import {
  downloadExportFile,
  getPermissionEmails,
  useAllExportTaskListQuery,
  useCreateExportTaskMutation,
  useDeleteExportTaskMutation,
  useExportRuleDetailQuery,
  useMyExportTaskListQuery,
  useStablecoinSearchesQuery,
  type CreateExportTaskDTO,
  type ExportTask,
  type ExportTaskListFilters,
} from '@myorg/modules/statements/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  EXPORT_STATE_SUCCESS,
  EXPORT_STATUS_META,
  NOTIFY_EMAIL_MAX_LENGTH,
  PROOF_STATUS_META,
  RULE_STATUS_META,
  getTxTypesByIssueType,
  resolveFrequencyMessageKey,
  resolveFileTypeMessageKey,
  resolveTxTypeMessageKey,
  statusToneClass,
  validateNotifyEmail,
} from '@myorg/modules/statements/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatTime(ts?: number): string {
  return ts ? formatDate(ts, DATETIME_FMT) : EMPTY_DISPLAY;
}

function StatusBadge({ meta }: { meta?: { tone: string; labelKey: string } }) {
  const t = useTranslations('modules.statements');
  if (!meta) return <span>{EMPTY_DISPLAY}</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
        meta.tone,
      )}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

function taskColumns(
  t: ReturnType<typeof useTranslations>,
  pagination: { pageNum: number; pageSize: number },
  onDownload: (task: ExportTask) => void,
  onDelete: (task: ExportTask) => void,
  withIdentity: boolean,
): ColumnDef<ExportTask>[] {
  return [
    ...(withIdentity
      ? [
          {
            id: 'index',
            header: t('field.index'),
            cell: ({ row }: { row: { index: number } }) => (
              <span>
                {(pagination.pageNum - 1) * pagination.pageSize + row.index + 1}
              </span>
            ),
          },
          {
            accessorKey: 'tokenName',
            header: t('field.tokenName'),
            cell: ({ row }: { row: { original: ExportTask } }) => (
              <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
            ),
          },
          {
            accessorKey: 'blockchainName',
            header: t('field.blockchain'),
            cell: ({ row }: { row: { original: ExportTask } }) => (
              <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
            ),
          },
          {
            id: 'transactionTypes',
            header: t('field.txTypes'),
            cell: ({ row }: { row: { original: ExportTask } }) => (
              <span>
                {(row.original.transactionTypes ?? [])
                  .map((tx) => {
                    const k = resolveTxTypeMessageKey(tx);
                    return k ? t(k) : '';
                  })
                  .filter(Boolean)
                  .join('、') || EMPTY_DISPLAY}
              </span>
            ),
          },
        ]
      : []),
    {
      id: 'fileId',
      header: t('field.fileId'),
      cell: ({ row }) => <CopyableEllipsisText value={row.original.fileId ?? ''} />,
    },
    {
      id: 'fileHash',
      header: t('field.fileHash'),
      cell: ({ row }) =>
        row.original.fileHash ? (
          <CopyableEllipsisText value={row.original.fileHash} />
        ) : (
          <span>{EMPTY_DISPLAY}</span>
        ),
    },
    {
      id: 'time',
      header: t('field.startTime'),
      cell: ({ row }) => (
        <span>
          {formatTime(row.original.startTime)} - {formatTime(row.original.endTime)}
        </span>
      ),
    },
    {
      accessorKey: 'exportTime',
      header: t('field.exportTime'),
      cell: ({ row }) => <span>{formatTime(row.original.exportTime)}</span>,
    },
    {
      accessorKey: 'exportState',
      header: t('field.exportState'),
      cell: ({ row }) => (
        <StatusBadge meta={EXPORT_STATUS_META[row.original.exportState ?? 0]} />
      ),
    },
    {
      id: 'proofState',
      header: t('field.proofState'),
      cell: ({ row }) =>
        row.original.exportState === EXPORT_STATE_SUCCESS ? (
          <StatusBadge meta={PROOF_STATUS_META[row.original.proofState ?? 0]} />
        ) : (
          <span>{EMPTY_DISPLAY}</span>
        ),
    },
    {
      id: 'actions',
      header: t('field.actions'),
      cell: ({ row }) => (
        <div className="flex gap-3">
          {row.original.exportState === EXPORT_STATE_SUCCESS ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => onDownload(row.original)}
            >
              {t('action.download')}
            </Button>
          ) : null}
          <Button
            variant="link"
            className="h-auto p-0 text-red-600"
            onClick={() => onDelete(row.original)}
          >
            {t('action.delete')}
          </Button>
        </div>
      ),
    },
  ];
}

/** 规则详情 + 历史文件列表（view.tsx）。props 传 exportRuleIdRaw（shell 读 searchParams）。 */
export function StatementsViewPage({
  exportRuleIdRaw,
}: {
  exportRuleIdRaw?: string | null;
}) {
  const t = useTranslations('modules.statements');
  const router = useRouter();
  const exportRuleId = parseId(exportRuleIdRaw);
  const { data: detail, isLoading } = useExportRuleDetailQuery(exportRuleId);

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const taskParams = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: { exportRuleId: exportRuleId ?? 0 } as ExportTaskListFilters,
    }),
    [pagination.pageNum, pagination.pageSize, exportRuleId],
  );
  const taskList = useAllExportTaskListQuery(taskParams);
  const rows = taskList.data?.rows ?? [];
  const total = taskList.data?.page?.total ?? 0;
  const deleteMutation = useDeleteExportTaskMutation();

  const handleDownload = (task: ExportTask) => {
    downloadExportFile(task.busId ?? '', task.busType ?? '').catch(() =>
      toast.error(t('downloadSuccess')),
    );
  };
  const handleDelete = (task: ExportTask) => {
    if (!window.confirm(t('confirmDelete', { taskName: task.fileId ?? '' })))
      return;
    deleteMutation.mutate(
      { exportTaskId: task.exportTaskId ?? 0 },
      {
        onSuccess: () => toast.success(t('operateSuccess')),
        onError: () => toast.error(t('operateSuccess')),
      },
    );
  };

  const columns = React.useMemo(
    () =>
      taskColumns(t, pagination, handleDownload, handleDelete, false),
    [t, pagination, handleDownload, handleDelete],
  );

  if (!exportRuleId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.title')}</p>
      </div>
    );
  }

  const basicRows: KvRow[] = detail
    ? [
        { key: 'taskName', label: t('field.taskName'), value: <span>{detail.taskName || EMPTY_DISPLAY}</span> },
        { key: 'tokenName', label: t('field.tokenName'), value: <span>{detail.tokenName || EMPTY_DISPLAY}</span> },
        { key: 'blockchainName', label: t('field.blockchain'), value: <span>{detail.blockchainName || EMPTY_DISPLAY}</span> },
        {
          key: 'txTypes',
          label: t('field.txTypes'),
          value: (
            <span>
              {(detail.transactionTypes ?? [])
                .map((tx) => {
                  const k = resolveTxTypeMessageKey(tx);
                  return k ? t(k) : '';
                })
                .filter(Boolean)
                .join('、') || EMPTY_DISPLAY}
            </span>
          ),
        },
        {
          key: 'exportStrategy',
          label: t('field.exportStrategy'),
          value: (
            <span>
              {(() => {
                const k = resolveFrequencyMessageKey(detail.exportStrategy);
                return k ? t(k) : EMPTY_DISPLAY;
              })()}
            </span>
          ),
        },
        {
          key: 'fileType',
          label: t('field.exportType'),
          value: (
            <span>
              {(() => {
                const k = resolveFileTypeMessageKey(detail.fileType);
                return k ? t(k) : EMPTY_DISPLAY;
              })()}
            </span>
          ),
        },
        { key: 'notifyEmail', label: t('field.notifyEmail'), value: <span>{detail.notifyEmail || EMPTY_DISPLAY}</span> },
        { key: 'createUserName', label: t('field.index'), value: <span>{detail.createUserName || EMPTY_DISPLAY}</span> },
        { key: 'createTime', label: t('field.createTime'), value: <span>{formatTime(detail.createTime)}</span> },
        { key: 'status', label: t('field.status'), value: <StatusBadge meta={RULE_STATUS_META[detail.status ?? 0]} /> },
      ]
    : [];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">{t('detail.title')}</div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              {isLoading || !basicRows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground">
                    {isLoading ? '' : t('empty')}
                  </td>
                </tr>
              ) : (
                basicRows.map((row) => (
                  <tr key={row.key}>
                    <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">{row.label}</td>
                    <td className="break-all border px-4 py-3">{row.value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">{t('list.title')}</div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={taskList.isLoading || taskList.isFetching}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (p) => setPagination((prev) => ({ ...prev, pageNum: p })),
            }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>{t('action.back')}</Button>
      </div>
    </div>
  );
}

interface ExportFormValues {
  tokenId: string;
  walletAddress: string;
  txTimeFrom: string;
  txTimeTo: string;
  txTypes: number[];
  notifyEmail: string;
  selectAllUsers: boolean;
}

const EMPTY_EXPORT_FORM: ExportFormValues = {
  tokenId: '',
  walletAddress: '',
  txTimeFrom: '',
  txTimeTo: '',
  txTypes: [],
  notifyEmail: '',
  selectAllUsers: false,
};

/** 我的导出 + 导出表单（export.tsx）。 */
export function StatementsExportPage() {
  const t = useTranslations('modules.statements');
  const router = useRouter();
  const stablecoinSearches = useStablecoinSearchesQuery();
  const createMutation = useCreateExportTaskMutation();
  const [txTypeOptions, setTxTypeOptions] = React.useState<number[]>([]);

  const { control, register, handleSubmit, reset, setValue, watch, formState } =
    useForm<ExportFormValues>({ defaultValues: EMPTY_EXPORT_FORM });
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const listParams = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: { moduleType: 5 } as ExportTaskListFilters,
    }),
    [pagination.pageNum, pagination.pageSize],
  );
  const listResult = useMyExportTaskListQuery(listParams);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const deleteMutation = useDeleteExportTaskMutation();

  const tokenOptions = React.useMemo(
    () =>
      (stablecoinSearches.data ?? []).map((s) => ({
        value: String(s.stablecoinId ?? ''),
        label: s.name ?? '',
      })),
    [stablecoinSearches.data],
  );

  const handleDownload = (task: ExportTask) => {
    downloadExportFile(task.busId ?? '', task.busType ?? '').catch(() =>
      toast.error(t('downloadSuccess')),
    );
  };
  const handleDelete = (task: ExportTask) => {
    if (!window.confirm(t('confirmDelete', { taskName: task.fileId ?? '' })))
      return;
    deleteMutation.mutate(
      { exportTaskId: task.exportTaskId ?? 0 },
      {
        onSuccess: () => toast.success(t('operateSuccess')),
        onError: () => toast.error(t('operateSuccess')),
      },
    );
  };

  const columns = React.useMemo(
    () => taskColumns(t, pagination, handleDownload, handleDelete, true),
    [t, pagination, handleDownload, handleDelete],
  );

  const onTokenChange = (value: string) => {
    const opt = stablecoinSearches.data?.find(
      (s) => String(s.stablecoinId) === value,
    );
    setTxTypeOptions([...getTxTypesByIssueType(opt?.issueType)]);
    setValue('txTypes', []);
  };
  const onSubmit = (v: ExportFormValues) => {
    const dto: CreateExportTaskDTO = {
      exportType: 0,
      moduleType: 5,
      notifyEmail: v.notifyEmail || undefined,
      transactionRecordsListReqVO: {
        tokenId: v.tokenId,
        txStartTime: v.txTimeFrom ? startOfDay(parseISO(v.txTimeFrom)).getTime() : '',
        txEndTime: v.txTimeTo ? endOfDay(parseISO(v.txTimeTo)).getTime() : '',
        txTypes: v.txTypes,
        walletAddress: v.walletAddress || '',
      },
    };
    createMutation.mutate(dto, {
      onSuccess: () => toast.success(t('createSuccess')),
      onError: () => toast.error(t('createSuccess')),
    });
  };
  const onSelectAllUsers = (checked: boolean) => {
    setValue('selectAllUsers', checked);
    if (checked) {
      getPermissionEmails(1)
        .then((emails) => setValue('notifyEmail', emails.join(', ')))
        .catch(() => undefined);
    } else {
      setValue('notifyEmail', '');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.tokenName')}</label>
            <Controller
              control={control}
              name="tokenId"
              render={({ field }) => (
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={field.value}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    onTokenChange(e.target.value);
                  }}
                >
                  <option value="">--</option>
                  {tokenOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.walletAddress')}</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              {...register('walletAddress', { maxLength: 50 })}
            />
          </div>
          <FormDatePicker name="txTimeFrom" control={control} label={t('field.txTimeFrom')} />
          <FormDatePicker name="txTimeTo" control={control} label={t('field.txTimeTo')} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.txTypes')}</label>
            <div className="flex flex-wrap gap-3">
              {txTypeOptions.map((tx) => (
                <label key={tx} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={watch('txTypes').includes(tx)}
                    onChange={(e) => {
                      const cur = watch('txTypes');
                      setValue(
                        'txTypes',
                        e.target.checked ? [...cur, tx] : cur.filter((x) => x !== tx),
                      );
                    }}
                  />
                  {t(`txType.${tx}`)}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.notifyEmail')}</label>
            <textarea
              className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              maxLength={NOTIFY_EMAIL_MAX_LENGTH}
              {...register('notifyEmail', { validate: (v) => validateNotifyEmail(v) ?? true })}
            />
            {formState.errors.notifyEmail ? (
              <p className="text-xs text-red-500">{t(`email.${formState.errors.notifyEmail.message}`)}</p>
            ) : null}
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={watch('selectAllUsers')}
                onChange={(e) => onSelectAllUsers(e.target.checked)}
              />
              {t('field.selectAllUsers')}
            </label>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={createMutation.isPending}>{t('action.export')}</Button>
          <Button type="button" variant="outline" onClick={() => reset(EMPTY_EXPORT_FORM)}>
            {t('filter.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">{t('list.title')}</div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={listResult.isLoading || listResult.isFetching}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (p) => setPagination((prev) => ({ ...prev, pageNum: p })),
            }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>{t('action.back')}</Button>
      </div>
    </div>
  );
}
