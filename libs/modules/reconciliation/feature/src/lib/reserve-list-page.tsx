'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  DataTable,
  type DataTablePagination,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import {
  useReserveAssetListQuery,
  type ReserveAssetListReqVo,
  type ReserveAssetSummaryRespVo,
  type TokenBrief,
} from '@myorg/modules/reconciliation/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FIELD_VALUE,
  RECONCILIATION_PERMISSIONS,
  formatCurrencyValue,
  formatTimestamp,
} from '@myorg/modules/reconciliation/util';
import { ReconciliationSection } from '@myorg/modules/reconciliation/ui';

// ── 常量 ──────────────────────────────────────────────────────────────────────

/** “全部”占位值（Radix Select 禁空串 value，见 real-time-list-page 同名常量）。 */
const ALL_VALUE = 'all';

// ── 表单值类型 ──────────────────────────────────────────────────────────────────

interface FilterFormValues {
  reserveAssetName: string;
  financeBookName: string;
  /** 源 financeBookId 输入项（R3：目标复用 bookNo 文案，字段名沿用 financeBookId）。 */
  financeBookId: string;
  currencySymbol: string;
  lastReconciliationDateStart: string;
  lastReconciliationDateEnd: string;
}

const EMPTY_FORM: FilterFormValues = {
  reserveAssetName: '',
  financeBookName: '',
  financeBookId: '',
  currencySymbol: ALL_VALUE,
  lastReconciliationDateStart: '',
  lastReconciliationDateEnd: '',
};

// ── 关联 Token 渲染（迁移自源 reserve/index.tsx Tokens 列） ────────────────────

function renderAssociatedTokens(tokens?: TokenBrief[]): string {
  const list = tokens ?? [];
  if (list.length === 0) return EMPTY_FIELD_VALUE;

  const shown = list.slice(0, 2).map((i) => i.tokenName).filter(Boolean);
  if (shown.length === 0) return EMPTY_FIELD_VALUE;

  const more = list.length - shown.length;
  return more > 0 ? `${shown.join(', ')} +${more} more` : shown.join(', ');
}

// ── 页面组件 ─────────────────────────────────────────────────────────────────────

/**
 * ReserveListPage — 储备资产对账列表页。
 *
 * 迁移自 td-manage `reconciliation/reserve/index.tsx`（183 行）。
 *
 * - 5 项筛选：reserveAssetName / financeBookName / financeBookId(=bookNo 文案) /
 *   currencySymbol(Select) / lastReconciliationDate 范围（RangePicker 拆 Start-End）。
 * - 9 列汇总：reserveAccountName/assetValue/financeBookName/bookNo/currencySymbol/
 *   Tokens(associatedTokens 截断)/lastReconciliationTime/matched/exceptions，
 *   统计列着色（绿/红）。
 * - action 仅 Details（源 PostToSuspense 被注释掉，挂账入口在详情页内），
 *   跳详情页带 `tab=list`。
 * - 服务端分页（pageNum）+ keepPreviousData 平滑翻页。
 */
export function ReserveListPage() {
  const t = useTranslations('modules.reconciliation');
  const router = useRouter();
  const { permissions } = useAuth();
  const canView =
    permissions.size === 0 || permissions.has(RECONCILIATION_PERMISSIONS.VIEW);

  // ── 筛选表单 ──────────────────────────────────────────────────────────────
  const { register, control, handleSubmit, reset } =
    useForm<FilterFormValues>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<FilterFormValues>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ── 查询参数 ──────────────────────────────────────────────────────────────
  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: {
        reserveAssetName: queryValues.reserveAssetName || undefined,
        financeBookName: queryValues.financeBookName || undefined,
        bookNo: queryValues.financeBookId || undefined,
        currencySymbol:
          queryValues.currencySymbol &&
          queryValues.currencySymbol !== ALL_VALUE
            ? queryValues.currencySymbol
            : undefined,
        lastReconciliationDateStart:
          queryValues.lastReconciliationDateStart || undefined,
        lastReconciliationDateEnd:
          queryValues.lastReconciliationDateEnd || undefined,
      } satisfies ReserveAssetListReqVo,
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );

  const result = useReserveAssetListQuery(params);
  const rows = result.data?.rows ?? [];
  const total = result.data?.page?.total ?? 0;
  const isLoading = result.isLoading || result.isFetching;

  // ── 币种下拉：仅“全部”（目标无通用币种 hook；后端汇总行 currencySymbol
  //    不作列表筛选回显来源，与 real-time 不同，保持源 Select + 通用 currencyOptions
  //    语义占位，待通用 hook 接入后替换） ────────────────────────────────────
  const currencyOptions = React.useMemo(
    () => [{ value: ALL_VALUE, label: t('PUB_All') }],
    [t],
  );

  // ── 列定义 ────────────────────────────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<ReserveAssetSummaryRespVo>[]>(
    () => [
      {
        accessorKey: 'reserveAccountName',
        header: t('reconciliation_0201'),
        cell: ({ row }) => (
          <span>{row.original.reserveAccountName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'assetValue',
        header: t('reconciliation_0203'),
        cell: ({ row }) => (
          <span>{formatCurrencyValue(row.original.assetValue)}</span>
        ),
      },
      {
        accessorKey: 'financeBookName',
        header: t('reconciliation_0077'),
        cell: ({ row }) => (
          <span>{row.original.financeBookName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'bookNo',
        header: t('reconciliation_0048'),
        cell: ({ row }) => (
          <span>{row.original.bookNo || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'currencySymbol',
        header: t('reconciliation_0032'),
        cell: ({ row }) => (
          <span>{row.original.currencySymbol || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        id: 'associatedTokens',
        header: t('reconciliation_0205'),
        cell: ({ row }) => (
          <span>{renderAssociatedTokens(row.original.associatedTokens)}</span>
        ),
      },
      {
        accessorKey: 'lastReconciliationTime',
        header: t('reconciliation_0076'),
        cell: ({ row }) => (
          <span>{formatTimestamp(row.original.lastReconciliationTime)}</span>
        ),
      },
      {
        accessorKey: 'matchedCount',
        header: t('reconciliation_0073'),
        cell: ({ row }) => (
          <span className="font-semibold text-[#52c41a]">
            {row.original.matchedCount ?? 0}
          </span>
        ),
      },
      {
        accessorKey: 'exceptionsCount',
        header: t('reconciliation_0204'),
        cell: ({ row }) => (
          <span className="font-semibold text-[#f5222d]">
            {row.original.exceptionsCount ?? 0}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Detail'),
        cell: ({ row }) => {
          if (!canView) {
            return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
          }
          return (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/reconciliation/reserve/view?id=${row.original.reserveAccountId}&tab=list`,
                )
              }
            >
              {t('PUB_Detail')}
            </Button>
          );
        },
      },
    ],
    [t, canView, router],
  );

  const tablePagination = React.useMemo<DataTablePagination>(
    () => ({
      page: pagination.pageNum,
      pageSize: pagination.pageSize,
      total,
      onPageChange: (page) =>
        setPagination((prev) => ({ ...prev, pageNum: page })),
    }),
    [pagination.pageNum, pagination.pageSize, total],
  );

  // ── 查询/重置 ─────────────────────────────────────────────────────────────
  const onSubmit = handleSubmit((data) => {
    setQueryValues(data);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  });

  const onReset = () => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ReconciliationSection
        title={t('reconciliation_0206')}
        description={t('reconciliation_0200') ?? ''}
      >
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <FormField
            name="reserveAssetName"
            label={t('reconciliation_0201')}
            register={register('reserveAssetName')}
            placeholder={t('reconciliation_0201')}
          />
          <FormField
            name="financeBookName"
            label={t('reconciliation_0077')}
            register={register('financeBookName')}
            placeholder={t('reconciliation_0077')}
          />
          <FormField
            name="financeBookId"
            label={t('reconciliation_0048')}
            register={register('financeBookId')}
            placeholder={t('reconciliation_0048')}
          />
          <FormSelect
            name="currencySymbol"
            control={control}
            label={t('reconciliation_0032')}
            options={currencyOptions}
            placeholder={t('PUB_All')}
          />
          <FormDatePicker
            name="lastReconciliationDateStart"
            control={control}
            label={t('reconciliation_0071')}
          />
          <FormDatePicker
            name="lastReconciliationDateEnd"
            control={control}
            label={t('reconciliation_0071')}
          />
          <div className="flex items-end gap-2">
            <Button type="submit">{t('PUB_Query')}</Button>
            <Button type="button" variant="outline" onClick={onReset}>
              {t('PUB_Reset')}
            </Button>
          </div>
        </form>
      </ReconciliationSection>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('common_no_data')}
        pagination={tablePagination}
      />
    </div>
  );
}
