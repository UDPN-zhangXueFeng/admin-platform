'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Button, DataTable } from '@myorg/shared/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { PermissionGuard } from '@myorg/shared/util-auth';
import {
  useBlockchainListQuery,
  useDeploymentListQuery,
  useStablecoinSearchesQuery,
  useTokenTypeListQuery,
  type DeploymentListFilters,
  type DeploymentRecordItem,
} from '@myorg/modules/blockchain/data-access';
import {
  ALL_VALUE,
  BLOCKCHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  DEPLOYMENT_TYPE_LABEL_KEY_PREFIX,
  DEPLOYMENT_TYPE_OPTIONS,
  EMPTY_DISPLAY,
  TOKEN_TYPE_LABEL_KEY_PREFIX,
} from '@myorg/modules/blockchain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 状态列写死 success（源码 deployment/index.tsx:147-152 遗留：
 * render: () => <Tag color="success">{t('token_task_status_10')}</Tag>，
 * 不论实际 state 值，永远显示成功态）。见迁移文档第 8 章「已知限制」。
 */
function StatusSuccessBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      {label}
    </span>
  );
}

interface DeploymentFilterForm {
  /** 稳定币（Token）ID。空串 = 全部。 */
  tdId: string;
  /** tokenType id。空串 = 全部。 */
  tokenType: string;
  /** 链 ID。空串 = 全部；status!==1 的链选项 disabled。 */
  blockchainId: string;
  /** 包名（模糊）。 */
  packageName: string;
  /** 类型（1/5）。空串 = 全部。 */
  type: string;
  /** 部署时间起。 */
  startDeploymentTime: string;
  /** 部署时间止。 */
  endDeploymentTime: string;
}

const EMPTY_FILTER: DeploymentFilterForm = {
  tdId: ALL_VALUE,
  tokenType: ALL_VALUE,
  blockchainId: ALL_VALUE,
  packageName: '',
  type: ALL_VALUE,
  startDeploymentTime: '',
  endDeploymentTime: '',
};

function formToFilters(f: DeploymentFilterForm): DeploymentListFilters {
  return {
    tdId: f.tdId !== ALL_VALUE ? f.tdId : undefined,
    tokenType: f.tokenType !== ALL_VALUE ? f.tokenType : undefined,
    blockchainId: f.blockchainId !== ALL_VALUE ? f.blockchainId : undefined,
    packageName: f.packageName || undefined,
    type: f.type !== ALL_VALUE ? Number(f.type) : undefined,
    startDeploymentTime: f.startDeploymentTime
      ? startOfDay(parseISO(f.startDeploymentTime)).getTime()
      : undefined,
    endDeploymentTime: f.endDeploymentTime
      ? endOfDay(parseISO(f.endDeploymentTime)).getTime()
      : undefined,
  };
}

/**
 * DeploymentListPage — 合约部署记录列表页。
 *
 * 迁移自 td-manage src/pages/blockchain/deployment/index.tsx（193 行）。
 * useCustomTable → react-hook-form + DataTable。
 *
 * 6 个筛选条件：稳定币 / tokenType / 链（status===1 可选，否则 disabled）/
 * 包名 / 类型（1/5）/ 部署时间范围。
 *
 * 硬约束（本模块特有）：
 * - 列表请求体分页字段为 pageNum（非 page），对齐 RBAC/sys 域后端（文档 3.1）。
 * - tokenType 列文案走 i18n `token_type_${n}` 拼接，type 列走 `type_${n}`。
 * - 状态列写死 success（源码遗留，见上方 StatusSuccessBadge 注释）。
 * - 行「查看」受 DEPLOYMENT_VIEW_BTN 权限码控制，跳详情带 recordId。
 */
export function DeploymentListPage() {
  const t = useTranslations('modules.blockchain');
  const router = useRouter();

  const { control, register, handleSubmit, reset } =
    useForm<DeploymentFilterForm>({
      defaultValues: EMPTY_FILTER,
    });
  const [queryValues, setQueryValues] =
    React.useState<DeploymentFilterForm>(EMPTY_FILTER);
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
  const listResult = useDeploymentListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // ── 下拉数据源 ──
  const stablecoinSearches = useStablecoinSearchesQuery();
  const blockchainList = useBlockchainListQuery();
  const tokenTypeList = useTokenTypeListQuery();

  const stablecoinOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(stablecoinSearches.data ?? []).map((s) => ({
        value: String(s.stablecoinId ?? ''),
        label: s.name ?? '',
      })),
    ],
    [t, stablecoinSearches.data],
  );

  const tokenTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(tokenTypeList.data ?? []).map((tt) => ({
        value: String(tt.tokenTypeId ?? ''),
        label: tt.tokenTypeName ?? '',
      })),
    ],
    [t, tokenTypeList.data],
  );

  const typeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...DEPLOYMENT_TYPE_OPTIONS.map((o) => ({
        value: String(o.value),
        label: t(o.labelKey),
      })),
    ],
    [t],
  );

  // 链选项：ALL_VALUE + 全部链（status!==1 的单项 disabled，对齐源码语义）。
  const blockchainOptions = React.useMemo(
    () => blockchainList.data ?? [],
    [blockchainList.data],
  );

  const columns = React.useMemo<ColumnDef<DeploymentRecordItem>[]>(
    () => [
      {
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>
            {(pagination.pageNum - 1) * pagination.pageSize + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: 'tdName',
        header: t('field.stablecoin'),
        cell: ({ row }) => (
          <span>{row.original.tdName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('field.tokenType'),
        cell: ({ row }) => {
          const n = row.original.tokenType;
          return n == null ? (
            <span>{EMPTY_DISPLAY}</span>
          ) : (
            <span>{t(`${TOKEN_TYPE_LABEL_KEY_PREFIX}${Number(n)}`)}</span>
          );
        },
      },
      {
        accessorKey: 'packageName',
        header: t('field.packageName'),
        cell: ({ row }) => (
          <span>{row.original.packageName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'packageVersion',
        header: t('field.version'),
        cell: ({ row }) => (
          <span>{row.original.packageVersion || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'type',
        header: t('field.type'),
        cell: ({ row }) => {
          const n = row.original.type;
          return n == null ? (
            <span>{EMPTY_DISPLAY}</span>
          ) : (
            <span>{t(`${DEPLOYMENT_TYPE_LABEL_KEY_PREFIX}${Number(n)}`)}</span>
          );
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
        accessorKey: 'deployTime',
        header: t('field.deployTime'),
        cell: ({ row }) => (
          <span>
            {row.original.deployTime
              ? formatDate(row.original.deployTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'state',
        header: t('field.status'),
        // 写死 success（源码遗留：只展示成功部署记录）。
        cell: () => <StatusSuccessBadge label={t('token_task_status_10')} />,
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <PermissionGuard
              permission={BLOCKCHAIN_PERMISSIONS.DEPLOYMENT_VIEW_BTN}
            >
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/blockchain/deployment/view?recordId=${r.recordId ?? ''}`,
                  )
                }
              >
                {t('action.view')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, router, pagination.pageNum, pagination.pageSize],
  );

  const onSubmit = React.useCallback((f: DeploymentFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="tdId"
            control={control}
            label={t('field.stablecoin')}
            options={stablecoinOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('field.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('filter.all')}
          />
          {/*
            链下拉：status!==1 的链单项 disabled（源码 deployment/index.tsx
            options.disabled: el.status === 1 ? false : true）。
            FormSelect 不透传单项 disabled，故手写 Controller + Select/SelectItem。
          */}
          <Controller
            control={control}
            name="blockchainId"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="select-blockchainId"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('field.blockchain')}
                </label>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="select-blockchainId">
                    <SelectValue placeholder={t('filter.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t('filter.all')}</SelectItem>
                    {blockchainOptions.map((b) => (
                      <SelectItem
                        key={b.key}
                        value={String(b.key ?? '')}
                        disabled={b.status !== 1}
                      >
                        {b.value ?? ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <FormField
            name="packageName"
            label={t('field.packageName')}
            register={register('packageName')}
            placeholder={t('field.packageName')}
          />
          <FormSelect
            name="type"
            control={control}
            label={t('field.type')}
            options={typeOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="startDeploymentTime"
            control={control}
            label={t('field.deploymentDate')}
          />
          <FormDatePicker
            name="endDeploymentTime"
            control={control}
            label={t('field.deploymentDate')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('filter.query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('filter.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">
            {t('deployment.title')}
          </div>
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
              onPageChange: (p) =>
                setPagination((prev) => ({ ...prev, pageNum: p })),
            }}
          />
        </div>
      </div>
    </div>
  );
}
