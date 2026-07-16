'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  DataTable,
  Input,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useChangeReserveAssetStatusMutation,
  useCurrencyListQuery,
  useReserveAssetListQuery,
  type AssetCategory,
  type ReserveAssetListItem,
  type ReserveAssetListQuery,
} from '@myorg/modules/pledge/data-access';
import {
  ALL_VALUE,
  applyBookStatusFilter,
  BOOK_STATUS_OPTIONS,
  BOOK_STATUS_PAGE_SIZE,
  getBookStatus,
  getReserveAssetRowActions,
  PLEDGE_PERMISSIONS,
  RESERVE_STATUS_COLOR,
  RESERVE_STATUS_FILTER,
} from '@myorg/modules/pledge/util';
import { ReserveAssetDrawer, type DrawerState } from './reserve-asset-drawer';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * DataTable 契约要求行带 `id: string`。源列表行以 reserveAccountId 为 key，
 * 在 select 层补出 id 字段（不动 data-access model，避免污染其他页面）。
 */
interface ReserveAssetRow extends ReserveAssetListItem {
  id: string;
  /** 前端推导的账本状态（configured / not_setup）。 */
  bookStatus: ReturnType<typeof getBookStatus>;
}

interface ReserveAssetFilterForm {
  accountName: string;
  currency: string;
  bookStatus: string;
  createTimeStart: string;
  createTimeEnd: string;
  status: string;
}

const EMPTY_FILTER: ReserveAssetFilterForm = {
  accountName: '',
  currency: ALL_VALUE,
  bookStatus: ALL_VALUE,
  createTimeStart: '',
  createTimeEnd: '',
  status: ALL_VALUE,
};

/** 资产类别预览列（Popconfirm 内嵌表格）的列定义数据源。 */
const PREVIEW_EMPTY = '--';

/** 金额千分位格式化（对齐源 reSet：Intl 分组 + 两位小数，不加货币符号）。 */
function formatBalance(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0.00';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Drawer 状态：pl-5 抽出的独立 Drawer 组件定义（type:'new'|'edit', record?）。 */

/**
 * ReserveAssetListPage — 储备资产列表页（pledge 模块最复杂页面）。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/index.tsx（714 行）。
 * useCustomTable（含 customFetch bookStatus 前端过滤）→ react-hook-form + DataTable。
 *
 * 核心难点：
 * 1. **bookStatus 前端过滤**（等价源 customFetch）：后端无 bookStatus 字段，前端按
 *    financeBookId 推导。筛选 bookStatus ≠ ALL_VALUE 时：请求 pageSize=1000 全量 →
 *    每行 getBookStatus 推导 → filter 命中 → 按当前 pageNum/pageSize 重算 slice，
 *    且 total = filteredRows.length（否则分页器条数对不上）。
 *    未筛选时走后端正常分页。详见 useFilteredRows。
 * 2. **状态机行操作**：status 10/15 → [Details]；20 → [AddAssetCategory, Edit,
 *    Deactivate(AlertDialog), Details, NewTransaction]；50 → […, Activate, …]。
 *    Deactivate→changeReserveAssetStatus(50) / Activate→(20)，成功 invalidate 列表。
 * 3. **资产类别列 AlertDialog 预览**：弹窗内嵌预览表（filter assetTypeName 非空），
 *    More 跳详情。
 * 4. **bookStatus 列 configured 外链** `/financial/chart-of-accounts/view`。
 *
 * 歧义 9 结论：源码 setNewTransaction(true) 有对应渲染入口（<Drawer open={newTransaction}>），
 * 它就是 Add/Edit Drawer 的 open 状态（命名误导，实非"新建交易"Drawer）。
 * 此处还原为统一 Drawer state（type:'new'|'edit'），Drawer 表单逻辑由 pl-5 实现。
 */
export function ReserveAssetListPage(): React.JSX.Element {
  const t = useTranslations('modules.pledge');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<ReserveAssetFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<ReserveAssetFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: 10,
  });

  // Drawer 预留（pl-5 接入完整表单：Currency/Name + Checkbox.Group vs Cash Input + name→id 映射）
  const [drawerState, setDrawerState] = React.useState<DrawerState | null>(null);

  // ── 下拉数据源 ──
  // Currency：筛选下拉。新增模式下默认 Cash 的资产类别 id 由 pl-5 Drawer 内取（useAssetCategoryListQuery）。
  const currencyQuery = useCurrencyListQuery();

  const currencyOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(currencyQuery.data ?? [])
        .filter((c) => !!c.value)
        .map((c) => ({ value: String(c.value), label: c.key ?? '' })),
    ],
    [t, currencyQuery.data],
  );

  const bookStatusOptions = React.useMemo(
    () =>
      BOOK_STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label:
          o.value === 'not_setup'
            ? t('bookStatus.not_setup')
            : o.value === 'configured'
              ? t('bookStatus.configured')
              : t('filter.all'),
      })),
    [t],
  );

  const statusOptions = React.useMemo(
    () =>
      RESERVE_STATUS_FILTER.map((o) => ({
        value: o.value,
        label:
          o.value === ALL_VALUE ? t('filter.all') : t(`status.${o.value}`),
      })),
    [t],
  );

  // ── 构造查询参数 + bookStatus 全量拉取标记 ──
  // bookStatus 是前端伪状态，后端不存。筛选时拉全量（pageSize=1000）做前端过滤。
  const isBookStatusFiltering = queryValues.bookStatus !== ALL_VALUE;
  const requestParams = React.useMemo<ReserveAssetListQuery>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: isBookStatusFiltering
        ? BOOK_STATUS_PAGE_SIZE
        : pagination.pageSize,
      accountName: queryValues.accountName || undefined,
      currency:
        queryValues.currency !== ALL_VALUE ? queryValues.currency : undefined,
      // bookStatus 透传到 API data（后端忽略），页面层据此判断是否全量拉取。
      bookStatus:
        queryValues.bookStatus !== ALL_VALUE ? queryValues.bookStatus : undefined,
      status:
        queryValues.status !== ALL_VALUE
          ? Number(queryValues.status)
          : undefined,
      createTimeStart: queryValues.createTimeStart
        ? startOfDay(parseISO(queryValues.createTimeStart)).getTime()
        : undefined,
      createTimeEnd: queryValues.createTimeEnd
        ? endOfDay(parseISO(queryValues.createTimeEnd)).getTime()
        : undefined,
    }),
    [pagination.pageNum, pagination.pageSize, queryValues, isBookStatusFiltering],
  );

  const listResult = useReserveAssetListQuery(requestParams);
  const changeStatusMutation = useChangeReserveAssetStatusMutation();

  // ── 核心难点①：bookStatus 前端过滤（等价源 customFetch）──
  // 全量行补 bookStatus（getBookStatus(financeBookId)）+ id（DataTable 契约）。
  const allRows: ReserveAssetRow[] = React.useMemo(
    () =>
      (listResult.data?.rows ?? []).map((row) => ({
        ...row,
        id: String(row.reserveAccountId ?? ''),
        bookStatus: getBookStatus(row.financeBookId),
      })),
    [listResult.data?.rows],
  );

  // 三步：①拉全量（已在 requestParams 设 pageSize=1000）→ ②filter 命中 → ③重算 slice/total。
  // 纯函数 applyBookStatusFilter 已抽到 util 层并单测守护（过滤态 total=filteredRows.length）。
  const { displayRows, total } = React.useMemo(
    () =>
      applyBookStatusFilter(
        allRows,
        isBookStatusFiltering ? queryValues.bookStatus : undefined,
        pagination.pageNum,
        pagination.pageSize,
        listResult.data?.page?.total ?? 0,
        // 提取器：行已补 bookStatus 字段（allRows useMemo 里 getBookStatus 推导）。
        (row) => row.bookStatus,
      ),
    [
      allRows,
      isBookStatusFiltering,
      queryValues.bookStatus,
      pagination.pageNum,
      pagination.pageSize,
      listResult.data?.page?.total,
    ],
  );

  const isLoading = listResult.isLoading || listResult.isFetching;

  // ── 行操作：状态机分支 ──
  const handleRowAction = React.useCallback(
    (row: ReserveAssetRow, key: string) => {
      const reserveAccountId = row.reserveAccountId ?? 0;
      switch (key) {
        case 'AddAssetCategory':
          router.push({
            pathname: '/pledge/reserve-asset-list/create',
            query: {
              currency: row.currency ?? '',
              reserveAssetName: row.accountName ?? '',
              reserveAccountId: String(reserveAccountId),
            },
          });
          break;
        case 'NewTransaction':
          router.push({
            pathname: '/pledge/asset-transaction/create',
            query: { reserveAccountId: String(reserveAccountId), type: 'asset' },
          });
          break;
        case 'Edit':
          // 触发 pl-5 Drawer 编辑态（含资产类别 Checkbox.Group + name→id 映射）。
          setDrawerState({ type: 'edit', record: row });
          break;
        case 'View':
          router.push({
            pathname: '/pledge/reserve-asset-list/view',
            query: { id: String(reserveAccountId) },
          });
          break;
      }
    },
    [router],
  );

  const handleStatusChange = React.useCallback(
    (row: ReserveAssetRow, targetStatus: number) => {
      changeStatusMutation.mutate(
        { reserveAccountId: row.reserveAccountId ?? 0, status: targetStatus },
        {
          onSuccess: () => toast.success(t('operateSuccess')),
          onError: () => toast.error(t('operateSuccess')),
        },
      );
    },
    [changeStatusMutation, t],
  );

  // Drawer 处理器（pl-5 接入完整表单提交：addReserveAsset 默认 Cash / editReserveAsset name→id 映射）。
  const onAdd = React.useCallback(() => {
    setDrawerState({ type: 'new' });
  }, []);
  const onDrawerClose = React.useCallback(() => setDrawerState(null), []);

  // ── 列定义 ──
  const columns = React.useMemo<ColumnDef<ReserveAssetRow>[]>(
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
        accessorKey: 'accountName',
        header: t('field.accountName'),
        cell: ({ row }) => (
          <span>{row.original.accountName || PREVIEW_EMPTY}</span>
        ),
      },
      {
        accessorKey: 'currency',
        header: t('field.currency'),
      },
      {
        accessorKey: 'balance',
        header: t('field.assetValue'),
        cell: ({ row }) => (
          <span>{`${formatBalance(row.original.balance)} ${row.original.currency ?? ''}`}</span>
        ),
      },
      // 资产类别列：AlertDialog 预览（内嵌表） + More 跳详情。
      {
        id: 'assetCategories',
        header: t('field.assetCategories'),
        cell: ({ row }) => {
          const r = row.original;
          const previewRows = (r.categorieList ?? []).filter(
            (c) => !!c?.assetTypeName,
          );
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-indigo-500 underline" type="button">
                  {r.categorieCount ?? 0}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('field.assetCategories')}</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="max-h-80 overflow-auto">
                      {previewRows.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="py-1 pr-4">
                                {t('field.assetCategories')}
                              </th>
                              <th className="py-1 pr-4">
                                {t('field.assetValue')}
                              </th>
                              <th className="py-1">Share of Total Reserve</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((c: AssetCategory) => (
                              <tr key={c.assetTypeId} className="border-b">
                                <td className="py-1 pr-4">
                                  {c.assetTypeName}
                                </td>
                                <td className="py-1 pr-4">
                                  {`${formatBalance(c.assetBalance)} ${c.currency ?? ''}`}
                                </td>
                                <td className="py-1">{`${Number(c.proportion ?? 0)}%`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span>{t('empty')}</span>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      router.push({
                        pathname: '/pledge/reserve-asset-list/view',
                        query: { id: String(r.reserveAccountId ?? '') },
                      })
                    }
                  >
                    {t('action.more')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        },
      },
      {
        accessorKey: 'tokenCount',
        header: t('field.tokenCount'),
      },
      // bookStatus 列：configured 态外链跳 chart-of-accounts。
      {
        id: 'bookStatus',
        header: t('field.bookStatus'),
        cell: ({ row }) => {
          const r = row.original;
          const isConfigured = r.bookStatus === 'configured';
          return (
            <span className="inline-flex items-center gap-1">
              <span>
                {isConfigured
                  ? t('bookStatus.configured')
                  : t('bookStatus.not_setup')}
              </span>
              {isConfigured ? (
                <button
                  type="button"
                  className="inline-flex border-0 bg-transparent p-0 text-[#1677ff]"
                  onClick={() =>
                    router.push({
                      pathname: '/financial/chart-of-accounts/view',
                      query: {
                        financeBookId: String(r.financeBookId ?? ''),
                        tab: 'basic-information',
                      },
                    })
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'createTime',
        header: t('field.createTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(Number(row.original.createTime), DATETIME_FMT)
              : PREVIEW_EMPTY}
          </span>
        ),
      },
      // 状态 Tag：color 走 RESERVE_STATUS_COLOR，文案 i18n。
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === undefined || status === null) {
            return <span>{PREVIEW_EMPTY}</span>;
          }
          const color =
            RESERVE_STATUS_COLOR[status as keyof typeof RESERVE_STATUS_COLOR] ??
            'default';
          const toneClass = statusToneClass(color);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}
            >
              {t(`status.${status}`)}
            </span>
          );
        },
      },
      // 行操作：状态机分支（10/15→Details；20→Add/Edit/Deactivate/Details/Txn；50→Add/Edit/Activate/Details/Txn）。
      // actions 数组来自纯函数 getReserveAssetRowActions(status)（util 层单测守护）。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          const actions = getReserveAssetRowActions(r.status);
          return (
            <div className="flex flex-wrap gap-3">
              {actions.includes('AddAssetCategory') ? (
                <PermissionGuard
                  permission={PLEDGE_PERMISSIONS.addAssetCategory}
                >
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => handleRowAction(r, 'AddAssetCategory')}
                  >
                    {t('action.addAssetCategory')}
                  </Button>
                </PermissionGuard>
              ) : null}
              {actions.includes('Edit') ? (
                <PermissionGuard permission={PLEDGE_PERMISSIONS.reserveAssetEdit}>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => handleRowAction(r, 'Edit')}
                  >
                    {t('action.edit')}
                  </Button>
                </PermissionGuard>
              ) : null}
              {/* Deactivate / Activate：AlertDialog 二次确认，confimStr 含 {accountName}（ICU 单花括号）。 */}
              {actions.includes('Deactivate') ? (
                <PermissionGuard
                  permission={PLEDGE_PERMISSIONS.deactivate}
                >
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="link" className="h-auto p-0">
                        {t('action.deactivate')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('confirmDeactivate', {
                            accountName: r.accountName ?? '',
                          })}
                        </AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleStatusChange(r, 50)}
                        >
                          {t('action.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </PermissionGuard>
              ) : null}
              {actions.includes('Activate') ? (
                <PermissionGuard permission={PLEDGE_PERMISSIONS.activate}>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="link" className="h-auto p-0">
                        {t('action.activate')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('confirmActivate', {
                            accountName: r.accountName ?? '',
                          })}
                        </AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleStatusChange(r, 20)}
                        >
                          {t('action.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </PermissionGuard>
              ) : null}
              <PermissionGuard
                permission={PLEDGE_PERMISSIONS.reserveAssetDetails}
              >
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => handleRowAction(r, 'View')}
                >
                  {t('action.details')}
                </Button>
              </PermissionGuard>
              {actions.includes('NewTransaction') ? (
                <PermissionGuard
                  permission={PLEDGE_PERMISSIONS.newTransactionRow}
                >
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => handleRowAction(r, 'NewTransaction')}
                  >
                    {t('action.newTransaction')}
                  </Button>
                </PermissionGuard>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      t,
      router,
      pagination.pageNum,
      pagination.pageSize,
      handleRowAction,
      handleStatusChange,
    ],
  );

  const onSubmit = React.useCallback((f: ReserveAssetFilterForm) => {
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
            name="accountName"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="reserve-accountName"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('field.accountName')}
                </label>
                <Input
                  id="reserve-accountName"
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
            name="bookStatus"
            control={control}
            label={t('field.bookStatus')}
            options={bookStatusOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="createTimeStart"
            control={control}
            label={t('field.createTime')}
          />
          <FormDatePicker
            name="createTimeEnd"
            control={control}
            label={t('field.createTime')}
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
        <div className="flex justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{t('title')}</div>
          <PermissionGuard permission={PLEDGE_PERMISSIONS.reserveAssetAdd}>
            <Button onClick={onAdd}>{t('action.add')}</Button>
          </PermissionGuard>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={displayRows}
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

      {/* 新增/编辑 Drawer（pl-5 抽出独立组件：new 态 Cash 默认 / edit 态 Checkbox + name→id 映射）。 */}
      <ReserveAssetDrawer
        open={drawerState !== null}
        drawerState={drawerState}
        onClose={onDrawerClose}
        onSuccess={() => {
          // mutation 成功已 invalidate reserveAsset 域缓存，列表自动刷新；
          // 此处仅作为成功后的额外钩子预留（当前无需额外操作）。
        }}
      />
    </div>
  );
}

/**
 * 状态 Tag 颜色 → Tailwind 类名（对齐 statements statusToneClass 思路）。
 * 源 antd Tag color 取自 i18n pledge_status_color_${status}（processing/error/success/gray）。
 */
function statusToneClass(color: string): string {
  switch (color) {
    case 'processing':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'success':
      return 'border-green-200 bg-green-50 text-green-700';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600';
  }
}

export default ReserveAssetListPage;
