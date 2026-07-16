'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';

import {
  Button,
  CopyableEllipsisText,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import { ChartOfAccountsStatusTag } from '@myorg/modules/chart-of-accounts/ui';
import {
  useChartOfAccountsListQuery,
  useCurrencyListQuery,
  type ChartOfAccountsItem,
  type ChartOfAccountsListFilters,
  type ChartOfAccountsListParams,
  type CurrencyOption,
} from '@myorg/modules/chart-of-accounts/data-access';
import {
  CHART_OF_ACCOUNTS_PERMISSIONS,
  DEFAULT_ACTIVE_STATUS_CODE,
  DEFAULT_INACTIVE_STATUS_CODE,
  DEFAULT_PAGE_SIZE,
  FIXED_TOKEN_TYPES,
  normalizeCurrencyCode,
  normalizeTextValue,
  resolveStatusCode,
  resolveStatusCodes,
  type ChartOfAccountsStatusFilter,
} from '@myorg/modules/chart-of-accounts/util';

import { getFinancialBookMetaByBookId } from './financial-book-meta';

/** 详情 tab 取值，与操作跳转一一对应。 */
type DetailTab = 'basic-information' | 'chart-of-accounts' | 'eod-statements';

/** “全部”占位值（Radix Select 不允许空字符串 value，故用 `'all'`）。 */
const ALL_VALUE = 'all';

/**
 * react-hook-form 筛选表单形状。
 * 文本空串 = 无筛选；下拉 `'all'` = 无筛选；日期为 `YYYY-MM-DD` 字符串。
 */
interface ChartOfAccountsFilterForm {
  financialBookName?: string;
  bookId?: string;
  reserveAssetName?: string;
  currency?: string;
  tokenType?: string;
  createdOnFrom?: string;
  createdOnTo?: string;
  status?: string;
}

const EMPTY_FORM: ChartOfAccountsFilterForm = {
  financialBookName: '',
  bookId: '',
  reserveAssetName: '',
  currency: ALL_VALUE,
  tokenType: ALL_VALUE,
  createdOnFrom: '',
  createdOnTo: '',
  status: ALL_VALUE,
};

/** 将表单值转换为后端筛选条件（纯函数，便于单测）。 */
function formToFilters(
  form: ChartOfAccountsFilterForm,
  activeStatusCode: number,
  inactiveStatusCode: number
): ChartOfAccountsListFilters {
  const statusValue =
    form.status && form.status !== ALL_VALUE
      ? (form.status as ChartOfAccountsStatusFilter)
      : undefined;

  return {
    bookName: normalizeTextValue(form.financialBookName),
    bookNo: normalizeTextValue(form.bookId),
    reserveAssetName: normalizeTextValue(form.reserveAssetName),
    currencyCode:
      form.currency && form.currency !== ALL_VALUE ? form.currency : undefined,
    tokenType:
      form.tokenType && form.tokenType !== ALL_VALUE
        ? Number(form.tokenType)
        : undefined,
    status: resolveStatusCode(statusValue, activeStatusCode, inactiveStatusCode),
    createTimeStart: form.createdOnFrom
      ? startOfDay(parseISO(form.createdOnFrom)).getTime()
      : undefined,
    createTimeEnd: form.createdOnTo
      ? endOfDay(parseISO(form.createdOnTo)).getTime()
      : undefined,
  };
}

// ── EOD 截止时间格式化（迁移自源项目 src/lib/financial/date-time.ts） ──
const EMPTY_DISPLAY = '--';

function formatOffsetMinutes(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

function getUtcOffsetLabel(timeZone?: string | null, date = new Date()): string | undefined {
  const normalizedTimeZone = timeZone?.trim();
  if (!normalizedTimeZone) {
    return undefined;
  }

  try {
    const localDate = new Date(
      date.toLocaleString('en-US', { timeZone: normalizedTimeZone })
    );
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMinutes = Math.round(
      (localDate.getTime() - utcDate.getTime()) / 60000
    );

    if (!Number.isFinite(offsetMinutes)) {
      return undefined;
    }

    return formatOffsetMinutes(offsetMinutes);
  } catch {
    return undefined;
  }
}

function formatEodCutoffTime(
  value?: string | number | null,
  timeZone?: string | null
): string {
  const text =
    value === undefined || value === null ? '' : String(value).trim();
  const displayValue = text || EMPTY_DISPLAY;
  if (displayValue === EMPTY_DISPLAY) {
    return displayValue;
  }

  const utcOffsetLabel = getUtcOffsetLabel(timeZone || undefined);
  return utcOffsetLabel ? `${displayValue} (${utcOffsetLabel})` : displayValue;
}

/**
 * ChartOfAccountsListPage — 复杂筛选 + 服务端分页 + 操作菜单。
 *
 * 迁移自源项目 `td-manage` 的 `src/pages/financial/chart-of-accounts/index.tsx`，
 * 关键逻辑保留：状态码自适应、货币下拉回退（接口失败用列表数据去重）、
 * 操作菜单按权限聚合 Detail / Edit / View Statements，跳转详情对应 tab。
 */
export function ChartOfAccountsListPage() {
  const t = useTranslations('modules.chart-of-accounts');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开，兼容权限未接入场景（等价源项目非 TDManage 环境）。 */
  const hasPermission = React.useCallback(
    (uuid: string) => authPermissions.size === 0 || authPermissions.has(uuid),
    [authPermissions]
  );

  const { register, control, handleSubmit, reset } =
    useForm<ChartOfAccountsFilterForm>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<ChartOfAccountsFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const { data: currencyList } = useCurrencyListQuery();

  // 状态码自适应（源项目核心逻辑）：用 state 承载 active/inactive 码，
  // effect 监听 rows 推断环境体系（20/30 vs 1/0），变化时更新。
  // 收敛保证：用户未选 status 时 filters 内容不变 → queryKey 不变 → 不重发；
  // 推断结果稳定后 next === current，effect 不再更新。
  const [statusCodes, setStatusCodes] = React.useState({
    active: DEFAULT_ACTIVE_STATUS_CODE,
    inactive: DEFAULT_INACTIVE_STATUS_CODE,
  });

  const params = React.useMemo<ChartOfAccountsListParams>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues, statusCodes.active, statusCodes.inactive),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues, statusCodes]
  );

  const listResult = useChartOfAccountsListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;

  React.useEffect(() => {
    const next = resolveStatusCodes(rows);
    if (
      next.active !== statusCodes.active ||
      next.inactive !== statusCodes.inactive
    ) {
      setStatusCodes(next);
    }
  }, [rows, statusCodes.active, statusCodes.inactive]);

  const tokenTypeLabelMap = React.useMemo(
    () =>
      new Map<number, string>(
        FIXED_TOKEN_TYPES.map((tokenType) => [
          tokenType,
          t(`tokenType.${tokenType}`),
        ])
      ),
    [t]
  );

  const tokenTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...FIXED_TOKEN_TYPES.map((tokenType) => ({
        value: String(tokenType),
        label: t(`tokenType.${tokenType}`),
      })),
    ],
    [t]
  );

  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: 'active', label: t('status.active') },
      { value: 'inactive', label: t('status.inactive') },
    ],
    [t]
  );

  // 货币下拉：优先公共接口，失败 / 为空时回退到列表数据去重（保留源项目回退逻辑）。
  const currencyOptions = React.useMemo(() => {
    if (Array.isArray(currencyList) && currencyList.length > 0) {
      const codes = Array.from(
        new Set(
          currencyList
            .map((item: CurrencyOption) =>
              normalizeCurrencyCode(item.key) ?? normalizeCurrencyCode(item.value)
            )
            .filter((item): item is string => Boolean(item))
        )
      );

      if (codes.length > 0) {
        return codes.map((currencyCode) => ({
          label: currencyCode,
          value: currencyCode,
        }));
      }
    }

    return Array.from(
      new Set(
        rows
          .map((item) => normalizeCurrencyCode(item.currencyCode))
          .filter((item): item is string => Boolean(item))
      )
    ).map((currencyCode) => ({ label: currencyCode, value: currencyCode }));
  }, [currencyList, rows]);

  const goToDetail = React.useCallback(
    (record: ChartOfAccountsItem, tab: DetailTab) => {
      const meta = getFinancialBookMetaByBookId(record.bookNo);
      const query = new URLSearchParams({
        id: meta.id,
        financeBookId: String(record.financeBookId ?? ''),
        bookNo: record.bookNo,
        tab,
      });
      router.push(`/chart-of-accounts/view?${query.toString()}`);
    },
    [router]
  );

  const columns = React.useMemo<ColumnDef<ChartOfAccountsItem>[]>(
    () => [
      {
        accessorKey: 'bookName',
        header: t('field.bookName'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.bookName} maxWidth={220} />
        ),
      },
      {
        accessorKey: 'bookNo',
        header: t('field.bookNo'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.bookNo} maxWidth={130} />
        ),
      },
      {
        accessorKey: 'reserveAssetName',
        header: t('field.reserveAssetName'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.reserveAssetName}
            maxWidth={190}
          />
        ),
      },
      {
        accessorKey: 'currencyCode',
        header: t('field.currency'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.currencyCode}
            copyable={false}
            maxWidth={70}
          />
        ),
      },
      {
        accessorKey: 'eodCutoffTime',
        header: t('field.eodCutoffTime'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={formatEodCutoffTime(
              row.original.eodCutoffTime,
              row.original.timeZone
            )}
            copyable={false}
            maxWidth={140}
          />
        ),
      },
      {
        accessorKey: 'lastEodPostingRun',
        header: t('field.lastEodPostingRun'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.lastEodPostingRun}
            copyable={false}
            maxWidth={240}
          />
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('field.tokenType'),
        cell: ({ row }) => {
          const { tokenType } = row.original;
          if (tokenType === undefined || tokenType === null) {
            return <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>;
          }
          return (
            <span>
              {tokenTypeLabelMap.get(tokenType) ?? String(tokenType)}
            </span>
          );
        },
      },
      {
        accessorKey: 'tokens',
        header: t('field.tokens'),
        cell: ({ row }) => {
          const tokenNames = (row.original.tokens ?? [])
            .map((item) => item.tokenName)
            .filter((item): item is string => Boolean(item));

          return (
            <CopyableEllipsisText
              value={tokenNames.length ? tokenNames.join(', ') : undefined}
              maxWidth={300}
            />
          );
        },
      },
      {
        id: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const { status, statusName } = row.original;
          const isActive =
            status === statusCodes.active ||
            (statusName ?? '').toLowerCase() === 'active';
          const isInactive =
            status === statusCodes.inactive ||
            (statusName ?? '').toLowerCase() === 'inactive';

          const tone = isActive
            ? 'active'
            : isInactive
              ? 'inactive'
              : 'default';

          const label = isActive
            ? t('status.active')
            : isInactive
              ? t('status.inactive')
              : statusName ||
                (status === undefined || status === null
                  ? EMPTY_DISPLAY
                  : String(status));

          return <ChartOfAccountsStatusTag tone={tone} label={label} />;
        },
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const record = row.original;
          const actionItems: { key: string; label: string; onClick: () => void }[] = [];

          if (hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.Edit)) {
            actionItems.push({
              key: 'edit',
              label: t('action.edit'),
              onClick: () => goToDetail(record, 'chart-of-accounts'),
            });
          }
          if (hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.ViewStatements)) {
            actionItems.push({
              key: 'view-statements',
              label: t('action.viewStatements'),
              onClick: () => goToDetail(record, 'eod-statements'),
            });
          }
          if (hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.Detail)) {
            actionItems.push({
              key: 'detail',
              label: t('action.detail'),
              onClick: () => goToDetail(record, 'basic-information'),
            });
          }

          if (actionItems.length === 0) {
            return (
              <div className="flex justify-center text-muted-foreground">
                {EMPTY_DISPLAY}
              </div>
            );
          }

          return (
            <div className="flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('field.actions')}>
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actionItems.map((item) => (
                    <DropdownMenuItem key={item.key} onClick={item.onClick}>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, statusCodes, tokenTypeLabelMap, hasPermission, goToDetail]
  );

  const onSubmit = React.useCallback((form: ChartOfAccountsFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryValues(form);
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  const isLoading = listResult.isLoading || listResult.isFetching;

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">{t('filter.title')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="financialBookName"
            label={t('field.bookName')}
            register={register('financialBookName')}
            placeholder={t('placeholder.bookName')}
          />
          <FormField
            name="bookId"
            label={t('field.bookNo')}
            register={register('bookId')}
            placeholder={t('placeholder.bookNo')}
          />
          <FormField
            name="reserveAssetName"
            label={t('field.reserveAssetName')}
            register={register('reserveAssetName')}
            placeholder={t('placeholder.reserveAssetName')}
          />
          <FormSelect
            name="currency"
            control={control}
            label={t('field.currency')}
            options={[{ value: ALL_VALUE, label: t('filter.all') }, ...currencyOptions]}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('field.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="createdOnFrom"
            control={control}
            label={t('field.createdOnFrom')}
          />
          <FormDatePicker
            name="createdOnTo"
            control={control}
            label={t('field.createdOnTo')}
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
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('records')}
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
