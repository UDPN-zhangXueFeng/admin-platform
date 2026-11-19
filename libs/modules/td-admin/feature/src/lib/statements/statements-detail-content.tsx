'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { Button, Card, cardSurfaceClass, CopyableEllipsisText, DataTable, PageHeader } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { FormDateRangePicker, FormSelect } from '@myorg/shared/ui-forms';
import { formatAdminTimestamp } from '../format-admin-time';
import { QueryForm } from '../query-form';
import { createRowActionsColumn } from '../row-actions';
import { Controller, useForm } from 'react-hook-form';
import { getPermissionEmails, useAllExportTaskListQuery, useBlockchainListQuery, useDeleteExportTaskMutation, useExportRuleDetailQuery, useMyExportTaskListQuery, type CreateExportTaskDTO, type ExportTaskListFilters } from '@myorg/modules/td-admin/data-access';
import { downloadExportFile } from '@myorg/modules/td-admin/data-access/lib/statements';
import { useCreateExportTaskMutation, useStablecoinSearchesQuery } from '@myorg/modules/td-admin/data-access/lib/statements';
import type { ExportTask } from '@myorg/modules/td-admin/data-access/lib/statements';
import {
  ALL_VALUE,
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
} from '.';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 任务/文件列表筛选表单（规则详情 + 我的导出共用字段超集）。 */
interface TaskFilterForm {
  tokenId: string;
  blockchainId: string;
  fileId: string;
  filterTxTimeFrom: string;
  filterTxTimeTo: string;
  filterCreateTimeFrom: string;
  filterCreateTimeTo: string;
  exportState: string;
}

const EMPTY_TASK_FILTER: TaskFilterForm = {
  tokenId: ALL_VALUE,
  blockchainId: ALL_VALUE,
  fileId: '',
  filterTxTimeFrom: '',
  filterTxTimeTo: '',
  filterCreateTimeFrom: '',
  filterCreateTimeTo: '',
  exportState: ALL_VALUE,
};

/** 表单值 → 任务列表 filters（空值不下发，日期转 start/end of day 毫秒）。 */
function taskFormToFilters(f: TaskFilterForm): ExportTaskListFilters {
  return {
    tokenId: f.tokenId !== ALL_VALUE ? f.tokenId : undefined,
    blockchainId: f.blockchainId !== ALL_VALUE ? f.blockchainId : undefined,
    fileId: f.fileId.trim() || undefined,
    txStartTime: f.filterTxTimeFrom
      ? startOfDay(parseISO(f.filterTxTimeFrom)).getTime()
      : undefined,
    txEndTime: f.filterTxTimeTo
      ? endOfDay(parseISO(f.filterTxTimeTo)).getTime()
      : undefined,
    createStartTime: f.filterCreateTimeFrom
      ? startOfDay(parseISO(f.filterCreateTimeFrom)).getTime()
      : undefined,
    createEndTime: f.filterCreateTimeTo
      ? endOfDay(parseISO(f.filterCreateTimeTo)).getTime()
      : undefined,
    exportState: f.exportState !== ALL_VALUE ? Number(f.exportState) : undefined,
  };
}

/** Stablecoin 下拉 label："name (abbr)"（迁移自源 export/index 下拉文案）。 */
function tokenOptionLabel(name?: string, abbreviation?: string): string {
  if (!name) return '';
  return abbreviation ? `${name} (${abbreviation})` : name;
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
          {
            accessorKey: 'walletAddress',
            header: t('field.walletAddress'),
            cell: ({ row }: { row: { original: ExportTask } }) => (
              <span>{row.original.walletAddress || EMPTY_DISPLAY}</span>
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
          {formatAdminTimestamp(row.original.startTime)} - {formatAdminTimestamp(row.original.endTime)}
        </span>
      ),
    },
    {
      accessorKey: 'exportTime',
      header: t('field.exportTime'),
      cell: ({ row }) => <span>{formatAdminTimestamp(row.original.exportTime)}</span>,
    },
    {
      accessorKey: 'exportState',
      header: t('field.exportState'),
      cell: ({ row }) => (
        <StatusBadge meta={EXPORT_STATUS_META[row.original.exportState ?? 0]} />
      ),
    },
    {
      id: 'proofHash',
      header: t('field.proofHash'),
      cell: ({ row }) =>
        row.original.proofHash ? (
          <CopyableEllipsisText value={row.original.proofHash} />
        ) : (
          <span>{EMPTY_DISPLAY}</span>
        ),
    },
    {
      accessorKey: 'proofTime',
      header: t('field.proofTime'),
      cell: ({ row }) => <span>{formatAdminTimestamp(row.original.proofTime)}</span>,
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
    // 无 Details 类操作：Download/Delete 折叠进 ⋮ 菜单
    createRowActionsColumn<ExportTask>({
      menu: (task) => [
        ...(task.exportState === EXPORT_STATE_SUCCESS
          ? [{ label: t('action.download'), onClick: () => onDownload(task) }]
          : []),
        { label: t('action.delete'), destructive: true, onClick: () => onDelete(task) },
      ],
    }),
  ];
}

/** 规则详情 + 历史文件列表（view.tsx）。props 传 exportRuleIdRaw（shell 读 searchParams）。 */
export function StatementsViewPage({
  exportRuleIdRaw,
}: {
  exportRuleIdRaw?: string | null;
}) {
  const t = useTranslations('modules.statements');
  const tc = useTranslations('common');
  const router = useRouter();
  const exportRuleId = parseId(exportRuleIdRaw);
  const { data: detail, isLoading } = useExportRuleDetailQuery(exportRuleId);

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const {
    control: filterControl,
    register: filterRegister,
    handleSubmit: handleFilterSubmit,
    reset: resetFilterForm,
  } = useForm<TaskFilterForm>({ defaultValues: EMPTY_TASK_FILTER });
  const [queryFilters, setQueryFilters] =
    React.useState<TaskFilterForm>(EMPTY_TASK_FILTER);
  const taskParams = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: {
        exportRuleId: exportRuleId ?? 0,
        ...taskFormToFilters(queryFilters),
      } as ExportTaskListFilters,
    }),
    [pagination.pageNum, pagination.pageSize, exportRuleId, queryFilters],
  );
  const taskList = useAllExportTaskListQuery(taskParams);
  const rows = taskList.data?.rows ?? [];
  const total = taskList.data?.page?.total ?? 0;
  const deleteMutation = useDeleteExportTaskMutation();

  const handleDownload = (task: ExportTask) => {
    downloadExportFile(task.busId ?? '', task.busType ?? '').catch(() =>
      toast.error(tc('common_task_status_40')),
    );
  };
  const handleDelete = (task: ExportTask) => {
    if (!window.confirm(t('confirmDelete', { taskName: task.fileId ?? '' })))
      return;
    deleteMutation.mutate(
      { exportTaskId: task.exportTaskId ?? 0 },
      {
        onSuccess: () => toast.success(t('operateSuccess')),
        onError: () => toast.error(tc('common_task_status_40')),
      },
    );
  };

  const columns = React.useMemo(
    () =>
      taskColumns(t, pagination, handleDownload, handleDelete, false),
    [t, pagination, handleDownload, handleDelete],
  );

  const exportStateOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...Object.keys(EXPORT_STATUS_META).map((state) => ({
        value: state,
        label: t(EXPORT_STATUS_META[Number(state)].labelKey),
      })),
    ],
    [t],
  );

  const onFilterSubmit = (values: TaskFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryFilters(values);
  };
  const onFilterReset = () => {
    resetFilterForm(EMPTY_TASK_FILTER);
    setQueryFilters(EMPTY_TASK_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  };

  if (!exportRuleId) {
    return (
      <Card className="space-y-4 p-6">
        <PageHeader
          backLabel={t('action.back')}
          onBack={() => router.back()}
          title={t('detail.title')}
        />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </Card>
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
        { key: 'createTime', label: t('field.createTime'), value: <span>{formatAdminTimestamp(detail.createTime)}</span> },
        { key: 'status', label: t('field.status'), value: <StatusBadge meta={RULE_STATUS_META[detail.status ?? 0]} /> },
      ]
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b px-6 py-4">
          <PageHeader
            backLabel={t('action.back')}
            onBack={() => router.back()}
            title={t('detail.title')}
          />
        </div>
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
      </Card>

      <form onSubmit={handleFilterSubmit(onFilterSubmit)}>
        <QueryForm
          fields={[
            <div key="fileId" className="space-y-1.5">
              <label className="text-sm font-medium">{t('field.fileId')}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                {...filterRegister('fileId')}
              />
            </div>,
            <FormDateRangePicker
              key="filterTxTime"
              startName="filterTxTimeFrom"
              endName="filterTxTimeTo"
              control={filterControl}
              label={t('field.txTime')}
            />,
            <FormSelect
              key="exportState"
              name="exportState"
              control={filterControl}
              label={t('field.exportState')}
              options={exportStateOptions}
              placeholder={t('filter.all')}
            />,
          ]}
          advancedFields={[
            <FormDateRangePicker
              key="filterCreateTime"
              startName="filterCreateTimeFrom"
              endName="filterCreateTimeTo"
              control={filterControl}
              label={t('field.createTime')}
            />,
          ]}
          onReset={onFilterReset}
          queryType="submit"
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>

      <Card>
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
              onPageSizeChange: (size) => setPagination({ pageNum: 1, pageSize: size }),
            }}
          />
        </div>
      </Card>
    </div>
  );
}

interface ExportFormValues {
  tokenId: string;
  walletAddress: string;
  exportType: string;
  txTimeFrom: string;
  txTimeTo: string;
  txTypes: number[];
  notifyEmail: string;
  selectAllUsers: boolean;
}

const EMPTY_EXPORT_FORM: ExportFormValues = {
  tokenId: '',
  walletAddress: '',
  exportType: '0',
  txTimeFrom: '',
  txTimeTo: '',
  txTypes: [],
  notifyEmail: '',
  selectAllUsers: false,
};

/** 我的导出 + 导出表单（export.tsx）。 */
export function StatementsExportPage() {
  const t = useTranslations('modules.statements');
  const tc = useTranslations('common');
  const router = useRouter();
  const stablecoinSearches = useStablecoinSearchesQuery();
  const blockchainList = useBlockchainListQuery();
  const createMutation = useCreateExportTaskMutation();
  const [txTypeOptions, setTxTypeOptions] = React.useState<number[]>([]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState,
    setError,
    clearErrors,
  } = useForm<ExportFormValues>({ defaultValues: EMPTY_EXPORT_FORM });
  const {
    control: filterControl,
    register: filterRegister,
    handleSubmit: handleFilterSubmit,
    reset: resetFilterForm,
  } = useForm<TaskFilterForm>({ defaultValues: EMPTY_TASK_FILTER });
  const [queryFilters, setQueryFilters] =
    React.useState<TaskFilterForm>(EMPTY_TASK_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const listParams = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: {
        moduleType: 5,
        ...taskFormToFilters(queryFilters),
      } as ExportTaskListFilters,
    }),
    [pagination.pageNum, pagination.pageSize, queryFilters],
  );
  const listResult = useMyExportTaskListQuery(listParams);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const deleteMutation = useDeleteExportTaskMutation();

  const tokenOptions = React.useMemo(
    () =>
      (stablecoinSearches.data ?? []).map((s) => ({
        value: String(s.stablecoinId ?? ''),
        label: tokenOptionLabel(s.name, s.blockchainNameAbbreviation),
      })),
    [stablecoinSearches.data],
  );
  const tokenFilterOptions = React.useMemo(
    () => [{ value: ALL_VALUE, label: t('filter.all') }, ...tokenOptions],
    [t, tokenOptions],
  );
  const blockchainFilterOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(blockchainList.data ?? [])
        .filter((b) => b.status === 1)
        .map((b) => ({
          value: String(b.key ?? ''),
          label: b.value ?? '',
        })),
    ],
    [t, blockchainList.data],
  );
  const exportStateOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...Object.keys(EXPORT_STATUS_META).map((state) => ({
        value: state,
        label: t(EXPORT_STATUS_META[Number(state)].labelKey),
      })),
    ],
    [t],
  );

  const handleDownload = (task: ExportTask) => {
    downloadExportFile(task.busId ?? '', task.busType ?? '').catch(() =>
      toast.error(tc('common_task_status_40')),
    );
  };
  const handleDelete = (task: ExportTask) => {
    if (!window.confirm(t('confirmDelete', { taskName: task.fileId ?? '' })))
      return;
    deleteMutation.mutate(
      { exportTaskId: task.exportTaskId ?? 0 },
      {
        onSuccess: () => toast.success(t('operateSuccess')),
        onError: () => toast.error(tc('common_task_status_40')),
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
    clearErrors('txTypes');
  };
  const onSubmit = (v: ExportFormValues) => {
    clearErrors(['txTimeFrom', 'txTypes']);
    let invalid = false;
    if (!v.txTimeFrom || !v.txTimeTo) {
      setError('txTimeFrom', {
        type: 'required',
        message: t('validation.required'),
      });
      invalid = true;
    }
    if (!v.txTypes.length) {
      setError('txTypes', {
        type: 'required',
        message: t('validation.required'),
      });
      invalid = true;
    }
    if (invalid) return;

    const dto: CreateExportTaskDTO = {
      exportType: Number(v.exportType),
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
      onError: () => toast.error(tc('common_task_status_40')),
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
  const onResetExportForm = () => {
    reset(EMPTY_EXPORT_FORM);
    setTxTypeOptions([]);
  };
  const onFilterSubmit = (values: TaskFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryFilters(values);
  };
  const onFilterReset = () => {
    resetFilterForm(EMPTY_TASK_FILTER);
    setQueryFilters(EMPTY_TASK_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        backLabel={t('action.back')}
        onBack={() => router.back()}
        title={t('title')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className={cn(cardSurfaceClass, 'p-6')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.tokenName')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="tokenId"
              rules={{ required: t('validation.required') }}
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
            {formState.errors.tokenId ? (
              <p className="text-xs text-red-500">
                {formState.errors.tokenId.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.walletAddress')}</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              {...register('walletAddress', { maxLength: 50 })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.exportType')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              {...register('exportType', { required: t('validation.required') })}
            >
              <option value="0">Excel</option>
            </select>
            {formState.errors.exportType ? (
              <p className="text-xs text-red-500">
                {formState.errors.exportType.message}
              </p>
            ) : null}
          </div>
          <FormDateRangePicker
            startName="txTimeFrom"
            endName="txTimeTo"
            control={control}
            label={t('field.txTime')}
            required
            error={formState.errors.txTimeFrom?.message}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.txTypes')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
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
                      clearErrors('txTypes');
                    }}
                  />
                  {t(`txType.${tx}`)}
                </label>
              ))}
            </div>
            {formState.errors.txTypes ? (
              <p className="text-xs text-red-500">
                {formState.errors.txTypes.message}
              </p>
            ) : null}
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
          <Button type="button" variant="outline" onClick={onResetExportForm}>
            {t('filter.reset')}
          </Button>
        </div>
      </form>

      <form onSubmit={handleFilterSubmit(onFilterSubmit)}>
        <QueryForm
          fields={[
            <FormSelect
              key="tokenId"
              name="tokenId"
              control={filterControl}
              label={t('field.tokenName')}
              options={tokenFilterOptions}
              placeholder={t('filter.all')}
            />,
            <FormSelect
              key="blockchainId"
              name="blockchainId"
              control={filterControl}
              label={t('field.blockchain')}
              options={blockchainFilterOptions}
              placeholder={t('filter.all')}
            />,
            <FormSelect
              key="exportState"
              name="exportState"
              control={filterControl}
              label={t('field.exportState')}
              options={exportStateOptions}
              placeholder={t('filter.all')}
            />,
          ]}
          advancedFields={[
            <div key="fileId" className="space-y-1.5">
              <label className="text-sm font-medium">{t('field.fileId')}</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                {...filterRegister('fileId')}
              />
            </div>,
            <FormDateRangePicker
              key="filterTxTime"
              startName="filterTxTimeFrom"
              endName="filterTxTimeTo"
              control={filterControl}
              label={t('field.txTime')}
            />,
            <FormDateRangePicker
              key="filterCreateTime"
              startName="filterCreateTimeFrom"
              endName="filterCreateTimeTo"
              control={filterControl}
              label={t('field.createTime')}
            />,
          ]}
          onReset={onFilterReset}
          queryType="submit"
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>

      <Card>
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
              onPageSizeChange: (size) => setPagination({ pageNum: 1, pageSize: size }),
            }}
          />
        </div>
      </Card>
    </div>
  );
}
