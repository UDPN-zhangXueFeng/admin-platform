'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useAssetCategoryListQuery,
  useReserveAssetTxListQuery,
  type ReserveAssetTxn,
} from '@myorg/modules/pledge/data-access';
import { ALL_VALUE, ASSET_TXN_STATUS_COLOR } from '@myorg/modules/pledge/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const EMPTY_DISPLAY = '--';
const TAB_PAGE_SIZE = 6;

/**
 * ViewAssetTransactions — 详情页 Asset Transactions Tab 组件。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/view-asset-transactions.tsx（224 行）。
 *
 * 接口：
 * - `reserve/asset/manage/tx/searches`（`useReserveAssetTxListQuery`，pageNum 分页）。
 * - `reserve/asset/manage/category/list`（`useAssetCategoryListQuery`，分类下拉）。
 *
 * 硬约束：
 * - props.reserveAccountId 缺失时不请求。
 * - 分类下拉：query 层已过滤 null，再 filter `assetCategoryName` 非空（源 `.filter(name => name.length > 0)`）。
 *   All 用 ALL_VALUE='all'（Radix Select 禁止空串 value）；提交时 `category === ALL_VALUE` 转空串。
 * - 分页字段 pageNum（data-access 已组装到 body.page）。
 * - status Tag：color 走 ASSET_TXN_STATUS_COLOR，文案 i18n txnStatus.${status}。
 *   orange → amber 系（txnStatusToneClass），对齐 list-page statusToneClass 思路。
 * - transactionDirection：1=Inflow，其余=Outflow（源 `=== 1 ? 'Inflow' : 'Outflow'`）。
 */
export interface ViewAssetTransactionsProps {
  /** 储备资产 ID（详情页 query.id）。 */
  reserveAccountId: number;
}

interface AssetTxnFilterForm {
  /** 资产类别（ALL_VALUE='all' 或类别名）。 */
  category: string;
}

const EMPTY_FILTER: AssetTxnFilterForm = { category: ALL_VALUE };

interface AssetTxnRow extends ReserveAssetTxn {
  /** DataTable 契约要求 id: string。 */
  id: string;
}

export function ViewAssetTransactions({
  reserveAccountId,
}: ViewAssetTransactionsProps): React.JSX.Element {
  const t = useTranslations('modules.pledge');

  const { control, handleSubmit, reset } = useForm<AssetTxnFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<AssetTxnFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: TAB_PAGE_SIZE,
  });

  // 资产类别下拉（category/list）。query 层已过滤 null，再 filter assetCategoryName 非空。
  const categoryQuery = useAssetCategoryListQuery({ reserveAccountId });
  const categoryOptions = React.useMemo(() => {
    const list = categoryQuery.data ?? [];
    const opts = list
      .map((it) => String(it.assetCategoryName ?? '').trim())
      .filter((name) => name.length > 0)
      .map((name) => ({ label: name, value: name }));
    return [{ label: t('filter.all'), value: ALL_VALUE }, ...opts];
  }, [categoryQuery.data, t]);

  // 查询参数。category=ALL_VALUE 时传空串（源 current.category ?? ''）。
  const params = React.useMemo(
    () => ({
      reserveAccountId,
      assetCategoryName:
        queryValues.category && queryValues.category !== ALL_VALUE
          ? queryValues.category
          : undefined,
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
    }),
    [reserveAccountId, queryValues.category, pagination],
  );

  const result = useReserveAssetTxListQuery(params);
  const rowsRaw = result.data?.rows ?? [];
  const total = result.data?.page?.total ?? 0;
  const isLoading = result.isLoading || result.isFetching;

  // 行映射：补 id（DataTable 契约），保留原始字段供列渲染。
  const rows = React.useMemo<AssetTxnRow[]>(
    () =>
      rowsRaw.map((item) => ({
        ...item,
        id: String(item.reserveOrderId ?? ''),
      })),
    [rowsRaw],
  );

  const columns = React.useMemo<ColumnDef<AssetTxnRow>[]>(
    () => [
      {
        // No.：当前页序号（pageNum-1)*pageSize + index + 1（源 key 计算）。
        id: 'no',
        header: t('assetTxn.no'),
        cell: ({ row }) => (
          <span>
            {(pagination.pageNum - 1) * pagination.pageSize + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: 'assetCategoryName',
        header: t('assetTxn.category'),
        cell: ({ row }) => (
          <span>{row.original.assetCategoryName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'type',
        header: t('assetTxn.type'),
        cell: ({ row }) => (
          <span>
            {row.original.transactionDirection === 1 ? 'Inflow' : 'Outflow'}
          </span>
        ),
      },
      {
        id: 'value',
        header: t('assetTxn.value'),
        cell: ({ row }) => (
          <span>
            {`${Number(row.original.transactionAmount || 0)} ${String(
              row.original.currency || row.original.unit || '',
            )}`.trim()}
          </span>
        ),
      },
      {
        accessorKey: 'createdName',
        header: t('assetTxn.createdBy'),
        cell: ({ row }) => (
          <span>{row.original.createdName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createdTime',
        header: t('assetTxn.createdOn'),
        cell: ({ row }) => {
          const { createdTime } = row.original;
          return (
            <span>
              {createdTime
                ? formatDate(Number(createdTime), DATETIME_FMT)
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        // 状态 Tag：color 走 ASSET_TXN_STATUS_COLOR，文案 i18n txnStatus。
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === undefined || status === null) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          const color =
            ASSET_TXN_STATUS_COLOR[
              status as keyof typeof ASSET_TXN_STATUS_COLOR
            ] ?? 'default';
          const toneClass = txnStatusToneClass(color);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}
            >
              {t(`txnStatus.${status}`)}
            </span>
          );
        },
      },
    ],
    [t, pagination.pageNum, pagination.pageSize],
  );

  const onSubmit = React.useCallback((f: AssetTxnFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: TAB_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="category"
            control={control}
            label={t('assetTxn.category')}
            options={categoryOptions}
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
        <div className="px-6 py-3" />
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

export default ViewAssetTransactions;

/**
 * 交易状态 Tag 颜色 → Tailwind 类名。
 * ASSET_TXN_STATUS_COLOR 取值：orange / error / success。
 * orange → amber 系（blue/red/green 已在 list-page statusToneClass，此处独立覆盖 orange）。
 */
function txnStatusToneClass(color: string): string {
  switch (color) {
    case 'orange':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'success':
      return 'border-green-200 bg-green-50 text-green-700';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600';
  }
}
