'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import {
  Button,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { PermissionGuard } from '@myorg/shared/util-auth';
import {
  useAccrualRecordListQuery,
  useBlockchainListQuery,
  useFundListQuery,
  useStablecoinSearchesQuery,
  type AccrualListFilters,
  type AccrualRecordItem,
  type SingleApplyPreviewItem,
} from '@myorg/modules/mmf/data-access';
import { MmfStatusBadge } from '@myorg/modules/mmf/ui';
import {
  ACCRUAL_STATUS_OPTIONS,
  ACCRUAL_STATUS_PENDING_APPLY,
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  MMF_PERMISSIONS,
} from '@myorg/modules/mmf/util';
import {
  AccrualApplyModal,
  type AccrualApplyModalProps,
} from './accrual-apply-modal';

const DATE_FMT = 'YYYY-MM-DD';

/**
 * reSet 的本地等价：value >= 0 → 千分位 + 2 位小数；否则 '--'。
 * 迁移自 td-manage libs/utils 的 reSet（len=2 默认）。
 *
 * 与 accrual-apply-modal / settlement-list-page 的 reSet 保持同款语义，
 * 便于后续抽到 util（暂不抽，遵循 Rule 2：单一用途内联）。
 */
function reSet(
  value: string | number | undefined | null,
  symbol?: string,
): string {
  if (value == null || Number.isNaN(Number(value)) || Number(value) < 0) {
    return symbol ? `${EMPTY_DISPLAY} ${symbol}` : EMPTY_DISPLAY;
  }
  const formatted = Number(value).toFixed(2)
    .replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
  return symbol ? `${formatted} ${symbol}` : formatted;
}

// ── 筛选表单 ──
interface AccrualFilterForm {
  accrualTimeFrom: string;
  accrualTimeTo: string;
  ruleId: string;
  tokenId: string;
  blockchainId: string;
  status: string;
}

const EMPTY_FILTER: AccrualFilterForm = {
  accrualTimeFrom: '',
  accrualTimeTo: '',
  ruleId: ALL_VALUE,
  tokenId: ALL_VALUE,
  blockchainId: ALL_VALUE,
  status: ALL_VALUE,
};

function formToFilters(f: AccrualFilterForm): AccrualListFilters {
  return {
    accrualTimeStartDate: f.accrualTimeFrom
      ? startOfDay(parseISO(f.accrualTimeFrom)).getTime()
      : undefined,
    accrualTimeEndDate: f.accrualTimeTo
      ? endOfDay(parseISO(f.accrualTimeTo)).getTime()
      : undefined,
    ruleId: f.ruleId !== ALL_VALUE ? f.ruleId : undefined,
    tokenId: f.tokenId !== ALL_VALUE ? f.tokenId : undefined,
    blockchainId: f.blockchainId !== ALL_VALUE ? f.blockchainId : undefined,
    status: f.status !== ALL_VALUE ? Number(f.status) : undefined,
  };
}

/**
 * AccrualListPage — 分红计提列表页。
 *
 * 迁移自 td-manage src/pages/mmf/accrual/index.tsx（628 行，含两个申报 Modal）。
 * 本文件承载列表筛选 + 表格 + 行操作 + 顶部「批量申报」按钮；
 * 两个申报 Modal 已拆至 `accrual-apply-modal.tsx`（T9），通过 props 接入。
 *
 * 5 个筛选条件：计提时间范围 / 基金 / 币种（stablecoin）/ 链（blockchain，status===1 可选）/ 状态。
 * - 币种下拉数据源 `useStablecoinSearchesQuery`
 * - 链下拉数据源 `useBlockchainListQuery`，`status !== 1` 的选项 `disabled`（源码语义：不可选）
 * - 状态下拉 `ACCRUAL_STATUS_OPTIONS`（5/10/35）
 *
 * 行操作：
 * - 「申报」仅在 `status === ACCRUAL_STATUS_PENDING_APPLY(5)` 时可用 → 弹单条确认 Modal，
 *   受 `ACCRUAL_SINGLE_APPLY_BTN` 权限码控制
 * - 「查看」跳 `/mmf/accrual/${id}?billCode=${billCode}`，受 `ACCRUAL_VIEW_BTN` 控制
 *
 * 顶部「批量申报」按钮受 `ACCRUAL_BATCH_APPLY_BTN` 控制，打开批量申报 Modal，
 * 默认基金 ruleId 取 `fundList[0].ruleId`（回填 Modal 查询表单）。
 *
 * 状态色用 ACCRUAL_STATUS_COLOR（via MmfStatusBadge kind="accrual"）。
 */
export function AccrualListPage() {
  const t = useTranslations('modules.mmf');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<AccrualFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<AccrualFilterForm>(EMPTY_FILTER);
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
  const listResult = useAccrualRecordListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // ── 下拉数据源 ──
  const fundListQuery = useFundListQuery();
  const stablecoinSearches = useStablecoinSearchesQuery();
  const blockchainList = useBlockchainListQuery();

  const fundOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(fundListQuery.data ?? []).map((f) => ({
        value: String(f.ruleId ?? ''),
        label: f.fundName ?? '',
      })),
    ],
    [t, fundListQuery.data],
  );
  const tokenOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(stablecoinSearches.data ?? []).map((s) => ({
        value: String(s.stablecoinId ?? ''),
        label: s.name ?? '',
      })),
    ],
    [t, stablecoinSearches.data],
  );
  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...ACCRUAL_STATUS_OPTIONS.map((o) => ({
        value: String(o.value),
        label: t(o.labelKey),
      })),
    ],
    [t],
  );
  // 链选项：status===1 可选，否则 disabled（FormSelect 不支持 per-option disabled，
  // 故用原生 Radix Select + SelectItem disabled 渲染，对齐源码语义）。
  const blockchainOptions = React.useMemo(
    () =>
      (blockchainList.data ?? []).map((b) => ({
        value: String(b.key ?? ''),
        label: b.value ?? '',
        disabled: b.status !== 1,
      })),
    [blockchainList.data],
  );

  // ── 申报 Modal 状态 ──
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [singleOpen, setSingleOpen] = React.useState(false);
  const [currentData, setCurrentData] =
    React.useState<SingleApplyPreviewItem | null>(null);

  // 批量申报默认基金 ruleId（fundList[0].ruleId），fundList 未加载时为 undefined。
  const defaultRuleId = fundListQuery.data?.[0]?.ruleId;

  const openSingleApply = React.useCallback((row: AccrualRecordItem) => {
    setCurrentData({
      fundName: row.fundName,
      accrualDate: row.accrualDate,
      dividendMethod: row.dividendMethod,
      accrualUnits: row.accrualUnits,
      totalWalletBalance: row.totalWalletBalance,
      totalWallets: row.totalWallets,
      tokenSymbol: row.tokenSymbol,
      ruleId: row.ruleId,
      accrualRecordId: row.accrualRecordId,
    });
    setSingleOpen(true);
  }, []);

  const applyModalProps: AccrualApplyModalProps = React.useMemo(
    () => ({
      batchOpen,
      singleOpen,
      defaultRuleId,
      currentData,
      onBatchOpenChange: setBatchOpen,
      onSingleOpenChange: setSingleOpen,
    }),
    [batchOpen, singleOpen, defaultRuleId, currentData],
  );

  const columns = React.useMemo<ColumnDef<AccrualRecordItem>[]>(
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
        accessorKey: 'accrualDate',
        header: t('field.accrualDate'),
        cell: ({ row }) => (
          <span>
            {row.original.accrualDate
              ? formatDate(row.original.accrualDate, DATE_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'fundName',
        header: t('field.fundName'),
        cell: ({ row }) => (
          <span>{row.original.fundName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenName',
        header: t('field.tokenSymbol'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('field.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'accrualUnits',
        header: t('field.accrualUnits'),
        cell: ({ row }) => (
          <span>
            {reSet(row.original.accrualUnits, row.original.tokenSymbol)}
          </span>
        ),
      },
      {
        accessorKey: 'totalWalletBalance',
        header: t('field.totalWalletBalance'),
        cell: ({ row }) => (
          <span>
            {reSet(row.original.totalWalletBalance, row.original.tokenSymbol)}
          </span>
        ),
      },
      {
        accessorKey: 'totalWallets',
        header: t('field.totalWallets'),
        cell: ({ row }) => (
          <span>{row.original.totalWallets ?? EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <MmfStatusBadge kind="accrual" status={row.original.status} />
        ),
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-3">
              {r.status === ACCRUAL_STATUS_PENDING_APPLY ? (
                <PermissionGuard
                  permission={MMF_PERMISSIONS.ACCRUAL_SINGLE_APPLY_BTN}
                >
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => openSingleApply(r)}
                  >
                    {t('action.apply')}
                  </Button>
                </PermissionGuard>
              ) : null}
              <PermissionGuard permission={MMF_PERMISSIONS.ACCRUAL_VIEW_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => {
                    const id = r.accrualRecordId ?? '';
                    const billCode = r.billCode ?? '';
                    router.push(
                      `/mmf/accrual/${id}${
                        billCode ? `?billCode=${encodeURIComponent(billCode)}` : ''
                      }`,
                    );
                  }}
                >
                  {t('action.view')}
                </Button>
              </PermissionGuard>
            </div>
          );
        },
      },
    ],
    [t, router, pagination.pageNum, pagination.pageSize, openSingleApply],
  );

  const onSubmit = React.useCallback((f: AccrualFilterForm) => {
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
          <FormDatePicker
            name="accrualTimeFrom"
            control={control}
            label={t('field.accrualTimeFrom')}
          />
          <FormDatePicker
            name="accrualTimeTo"
            control={control}
            label={t('field.accrualTimeTo')}
          />
          <FormSelect
            name="ruleId"
            control={control}
            label={t('field.fundName')}
            options={fundOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="tokenId"
            control={control}
            label={t('field.tokenSymbol')}
            options={tokenOptions}
            placeholder={t('filter.all')}
          />
          {/* 链：per-option disabled（status!==1）需绕过 FormSelect，
              用原生 Radix Select + SelectItem disabled。 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.blockchain')}</label>
            <Controller
              control={control}
              name="blockchainId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('filter.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t('filter.all')}</SelectItem>
                    {blockchainOptions.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.disabled}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <FormSelect
            name="status"
            control={control}
            label={t('field.status')}
            options={statusOptions}
            placeholder={t('filter.all')}
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
            {t('accrual.list.title')}
          </div>
          <div className="flex gap-2">
            <PermissionGuard
              permission={MMF_PERMISSIONS.ACCRUAL_BATCH_APPLY_BTN}
            >
              <Button onClick={() => setBatchOpen(true)}>
                {t('action.batchApply')}
              </Button>
            </PermissionGuard>
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

      <AccrualApplyModal {...applyModalProps} />
    </div>
  );
}
