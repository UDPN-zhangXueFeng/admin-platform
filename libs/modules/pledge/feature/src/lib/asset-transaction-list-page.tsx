'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Button, DataTable, Input } from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useAssetCategoryListQuery,
  useCurrencyListQuery,
  useReserveAssetTxListQuery,
  type ReserveAssetTxn,
  type ReserveAssetTxnListQuery,
} from '@myorg/modules/pledge/data-access';
import {
  ALL_VALUE,
  ASSET_TXN_STATUS_COLOR,
  ASSET_TXN_STATUS_FILTER,
  PLEDGE_PERMISSIONS,
  TRANSACTION_DIRECTION_FILTER,
} from '@myorg/modules/pledge/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const EMPTY_DISPLAY = '--';

/**
 * DataTable 契约要求行带 `id: string`。源列表行以 reserveOrderId 为业务主键，
 * 在页面层补出 id 字段（源 rowKey 写的是 reserveAccountId，但 model 行主键是
 * reserveOrderId，view-asset-transactions 亦以 reserveOrderId 为 id，此处对齐之）。
 */
interface AssetTxnRow extends ReserveAssetTxn {
  id: string;
}

interface AssetTxnListFilterForm {
  /** Transaction Ref No.（源 orderSerialNumber）。 */
  orderSerialNumber: string;
  /** Asset Name（源 assetName）。 */
  assetName: string;
  /** Currency（ALL_VALUE 或币种 value）。 */
  currency: string;
  /** Asset Category（ALL_VALUE 或 assetCategoryName）。 */
  assetCategoryName: string;
  /** Transaction Type（ALL_VALUE 或方向数字字符串 1/2/3）。 */
  transactionDirection: string;
  /** Created Date 起（源 startQueryTime）。 */
  startQueryTime: string;
  /** Created Date 止（源 endQueryTime）。 */
  endQueryTime: string;
  /** Status（ALL_VALUE 或状态数字字符串 5/10/15/35）。 */
  status: string;
}

const EMPTY_FILTER: AssetTxnListFilterForm = {
  orderSerialNumber: '',
  assetName: '',
  currency: ALL_VALUE,
  assetCategoryName: ALL_VALUE,
  transactionDirection: ALL_VALUE,
  startQueryTime: '',
  endQueryTime: '',
  status: ALL_VALUE,
};

/** 金额千分位格式化（对齐源 reSet：Intl 分组 + 两位小数，不加货币符号）。 */
function formatBalance(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0.00';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * AssetTransactionListPage — 储备资产交易列表页（pledge 子模块 A 的 list）。
 *
 * 迁移自 td-manage src/pages/pledge/asset-transaction/index.tsx（270 行）。
 * useCustomTable → react-hook-form 筛选 + DataTable + TanStack Query。
 *
 * 与详情页 Asset Transactions Tab（view-asset-transactions.tsx）共用
 * `useReserveAssetTxListQuery`（reserve/asset/manage/tx/searches），差异：
 * - 列表页是**全局交易列表**，不传 reserveAccountId（model 该字段已改可选）。
 * - 列表页筛选 7 项（Tab 仅 1 项资产类别）；列表页有顶部 New/Import/Adjustment 按钮 + 行 Details。
 *
 * 关键点：
 * 1. **筛选 7 项**：RefNo / 资产名（Input）；币种（currency/list，filter value 非空）；
 *    资产类别（category/list，filter assetCategoryName 非空）；交易类型（TRANSACTION_DIRECTION_FILTER，
 *    源 0=All → 页面归一为 ALL_VALUE，提交 `===ALL_VALUE` 转 undefined）；创建时间（起止两个
 *    FormDatePicker，源 RangePicker 用 "-" 拆分 startQueryTime/endQueryTime）；状态
 *    （ASSET_TXN_STATUS_FILTER，0=All → ALL_VALUE）。
 * 2. **行操作 Details**：跳 `/approval-manage/view?busCode=save_reserve_asset_transaction&id=<taskId>`，
 *    taskId 为 null 时按钮 disabled。⚠️ approval-manage 模块本批未迁移，该路由可能 404。
 * 3. **顶部按钮**：New（权限 newTransaction）跳 `/pledge/asset-transaction/create`
 *    （⚠️ 用 `/create` 非 `/edit`——registry/manifest 的 asset-transaction 子模块只有通用 key `create`，
 *    源 `/edit` 已映射为 `create`，见 module-manifest.ts）；Import（权限 importTransactions）/Adjustment
 *    （权限 adjustment，源 disabled=true）为占位按钮。
 * 4. **状态 Tag**：color 走 ASSET_TXN_STATUS_COLOR，toneClass 用 txnStatusToneClass（orange→amber），
 *    文案 i18n txnStatus.${status}。对齐 view-asset-transactions 写法。
 */
export function AssetTransactionListPage(): React.JSX.Element {
  const t = useTranslations('modules.pledge');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<AssetTxnListFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<AssetTxnListFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: 10,
  });

  // ── 下拉数据源 ──
  const currencyQuery = useCurrencyListQuery();
  const currencyOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(currencyQuery.data ?? [])
        .filter((c) => c.value !== null && c.value !== undefined && c.value !== '')
        .map((c) => ({ value: String(c.value), label: c.key ?? '' })),
    ],
    [t, currencyQuery.data],
  );

  // 资产类别下拉：列表页不绑 reserveAccountId（全局），filter assetCategoryName 非空。
  // 源 buildAssetCategoryOptions 取 label=assetCategoryName、value=assetCategoryName。
  const categoryQuery = useAssetCategoryListQuery();
  const categoryOptions = React.useMemo(() => {
    const list = categoryQuery.data ?? [];
    const opts = list
      .map((it) => String(it.assetCategoryName ?? '').trim())
      .filter((name) => name.length > 0)
      .map((name) => ({ label: name, value: name }));
    return [{ value: ALL_VALUE, label: t('filter.all') }, ...opts];
  }, [categoryQuery.data, t]);

  // 交易类型下拉：源 TRANSACTION_DIRECTION_FILTER（0=All/1/2/3）。0 归一为 ALL_VALUE，
  // 与其他 Select 的 All 统一（提交时 ===ALL_VALUE → undefined）。
  const directionOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...TRANSACTION_DIRECTION_FILTER.filter((o) => o.value !== 0).map((o) => ({
        value: String(o.value),
        label:
          o.value === 1
            ? t('assetTxnList.direction.inflow')
            : o.value === 2
              ? t('assetTxnList.direction.outflow')
              : t('assetTxnList.direction.refund'),
      })),
    ],
    [t],
  );

  const statusOptions = React.useMemo(
    () =>
      ASSET_TXN_STATUS_FILTER.map((o) => ({
        value: o.value,
        label: o.value === ALL_VALUE ? t('filter.all') : t(`txnStatus.${o.value}`),
      })),
    [t],
  );

  // ── 构造查询参数 ── 全局列表不传 reserveAccountId（model 已可选）。
  const requestParams = React.useMemo<ReserveAssetTxnListQuery>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      orderSerialNumber: queryValues.orderSerialNumber || undefined,
      assetName: queryValues.assetName || undefined,
      currency:
        queryValues.currency !== ALL_VALUE ? queryValues.currency : undefined,
      assetCategoryName:
        queryValues.assetCategoryName !== ALL_VALUE
          ? queryValues.assetCategoryName
          : undefined,
      transactionDirection:
        queryValues.transactionDirection !== ALL_VALUE
          ? Number(queryValues.transactionDirection)
          : undefined,
      startQueryTime: queryValues.startQueryTime
        ? startOfDay(parseISO(queryValues.startQueryTime)).getTime()
        : undefined,
      endQueryTime: queryValues.endQueryTime
        ? endOfDay(parseISO(queryValues.endQueryTime)).getTime()
        : undefined,
      status:
        queryValues.status !== ALL_VALUE ? Number(queryValues.status) : undefined,
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );

  const listResult = useReserveAssetTxListQuery(requestParams);

  // 行映射：补 id（DataTable 契约），reserveOrderId 为业务主键。
  const rows = React.useMemo<AssetTxnRow[]>(
    () =>
      (listResult.data?.rows ?? []).map((item) => ({
        ...item,
        id: String(item.reserveOrderId ?? ''),
      })),
    [listResult.data?.rows],
  );
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // ── 行操作 Details ── ⚠️ approval-manage 本批未迁移，可能 404。
  const handleDetails = React.useCallback(
    (row: AssetTxnRow) => {
      router.push({
        pathname: '/approval-manage/view',
        query: {
          busCode: 'save_reserve_asset_transaction',
          id: String(row.taskId ?? ''),
        },
      });
    },
    [router],
  );

  // ── 顶部 New ── 跳 /pledge/asset-transaction/create（registry 通用 key create，非 /edit）。
  const handleNew = React.useCallback(() => {
    router.push({ pathname: '/pledge/asset-transaction/create' });
  }, [router]);

  // ── 列定义 ──
  const columns = React.useMemo<ColumnDef<AssetTxnRow>[]>(
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
        accessorKey: 'orderSerialNumber',
        header: t('assetTxnList.transactionRefNo'),
        cell: ({ row }) => (
          <span>{row.original.orderSerialNumber || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'assetName',
        header: t('assetTxnList.assetName'),
        cell: ({ row }) => (
          <span>{row.original.assetName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'currency',
        header: t('field.currency'),
        cell: ({ row }) => (
          <span>{row.original.currency || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'assetCategoryName',
        header: t('assetTxnList.assetCategory'),
        cell: ({ row }) => (
          <span>{row.original.assetCategoryName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'transactionDirection',
        header: t('assetTxnList.transactionType'),
        cell: ({ row }) => {
          const dir = row.original.transactionDirection;
          const text =
            dir === 1
              ? t('assetTxnList.direction.inflow')
              : dir === 2
                ? t('assetTxnList.direction.outflow')
                : dir === 3
                  ? t('assetTxnList.direction.refund')
                  : EMPTY_DISPLAY;
          return <span>{text}</span>;
        },
      },
      {
        id: 'transactionAmount',
        header: t('assetTxnList.transactionAmount'),
        cell: ({ row }) => {
          const r = row.original;
          const unit = r.unit || r.currency || '';
          return (
            <span>{`${formatBalance(r.transactionAmount)} ${unit}`.trim()}</span>
          );
        },
      },
      {
        accessorKey: 'createdName',
        header: t('assetTxnList.createdBy'),
        cell: ({ row }) => (
          <span>{row.original.createdName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createdTime',
        header: t('assetTxnList.createdOn'),
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
      // 状态 Tag：color 走 ASSET_TXN_STATUS_COLOR，文案 i18n txnStatus。
      {
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
      // 行操作：Details（taskId 为 null 时 disabled）。⚠️ 跳 approval-manage 可能 404。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          const disabled = r.taskId === null || r.taskId === undefined;
          return (
            <PermissionGuard permission={PLEDGE_PERMISSIONS.txnDetails}>
              <Button
                variant="link"
                className="h-auto p-0"
                disabled={disabled}
                onClick={() => handleDetails(r)}
              >
                {t('action.details')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, pagination.pageNum, pagination.pageSize, handleDetails],
  );

  const onSubmit = React.useCallback((f: AssetTxnListFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: 10 });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Controller
            control={control}
            name="orderSerialNumber"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="atxn-orderSerialNumber"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('assetTxnList.transactionRefNo')}
                </label>
                <Input
                  id="atxn-orderSerialNumber"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </div>
            )}
          />
          <Controller
            control={control}
            name="assetName"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="atxn-assetName"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('assetTxnList.assetName')}
                </label>
                <Input
                  id="atxn-assetName"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </div>
            )}
          />
          <FormSelect
            name="currency"
            control={control}
            label={t('field.currency')}
            options={currencyOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="assetCategoryName"
            control={control}
            label={t('assetTxnList.assetCategory')}
            options={categoryOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="transactionDirection"
            control={control}
            label={t('assetTxnList.transactionType')}
            options={directionOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="startQueryTime"
            control={control}
            label={t('assetTxnList.createdOn')}
          />
          <FormDatePicker
            name="endQueryTime"
            control={control}
            label={t('assetTxnList.createdOn')}
          />
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3">
          <div className="text-sm font-semibold">{t('assetTxnList.title')}</div>
          <div className="flex flex-wrap gap-2">
            <PermissionGuard permission={PLEDGE_PERMISSIONS.newTransaction}>
              <Button onClick={handleNew}>{t('assetTxnList.newTransaction')}</Button>
            </PermissionGuard>
            <PermissionGuard permission={PLEDGE_PERMISSIONS.importTransactions}>
              <Button variant="outline" onClick={() => undefined}>
                {t('assetTxnList.importTransactions')}
              </Button>
            </PermissionGuard>
            <PermissionGuard permission={PLEDGE_PERMISSIONS.adjustment}>
              <Button variant="outline" disabled onClick={() => undefined}>
                {t('assetTxnList.adjustment')}
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
    </div>
  );
}

export default AssetTransactionListPage;

/**
 * 交易状态 Tag 颜色 → Tailwind 类名。
 * ASSET_TXN_STATUS_COLOR 取值：orange / error / success。
 * orange → amber 系（与 view-asset-transactions.tsx 的 txnStatusToneClass 完全一致）。
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
