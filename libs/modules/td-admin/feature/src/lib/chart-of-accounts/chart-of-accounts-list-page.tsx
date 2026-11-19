'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  Card,
  DataTable,
} from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import {
  useChartOfAccountsListQuery,
  useCurrencyListQuery,
  type ChartOfAccountsItem,
  type ChartOfAccountsListParams,
  type CurrencyOption,
} from '@myorg/modules/td-admin/data-access';
import {
  CHART_OF_ACCOUNTS_PERMISSIONS,
  DEFAULT_ACTIVE_STATUS_CODE,
  DEFAULT_INACTIVE_STATUS_CODE,
  DEFAULT_PAGE_SIZE,
  FIXED_TOKEN_TYPES,
  normalizeCurrencyCode,
  resolveStatusCodes,
} from '@myorg/modules/td-admin/data-access';

import { getFinancialBookMetaByBookId } from './financial-book-meta';
import { QueryForm } from '../query-form';
import { buildFinancialBookColumns, type DetailTab } from './financial-book-columns';

import { ALL_VALUE, EMPTY_FORM, formToFilters, type ChartOfAccountsFilterForm } from './financial-book-filters';

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
  const { permissions: authPermissions } = useAuth();
  const hasPermission = React.useCallback(
    (uuid: string) => authPermissions.has(uuid),
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
    setStatusCodes((current) => {
      const next = resolveStatusCodes(rows, current);
      return next.active === current.active && next.inactive === current.inactive
        ? current
        : next;
    });
  }, [rows]);

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
        bookName: record.bookName,
        tab,
      });
      router.push(`/accounting/chart-of-accounts/view?${query.toString()}`);
    },
    [router]
  );

  const canSeeActions =
    hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.Edit) ||
    hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.ViewStatements) ||
    hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.Detail);

  const columns = React.useMemo(
    () => buildFinancialBookColumns({ t, statusCodes, tokenTypeLabelMap, hasPermission, goToDetail, canSeeActions }),
    [
      t,
      statusCodes,
      tokenTypeLabelMap,
      hasPermission,
      goToDetail,
      canSeeActions,
    ],
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
      <form onSubmit={handleSubmit(onSubmit)}>
        <QueryForm
          queryType="submit"
          fields={[
            <FormField
              key="financialBookName"
              name="financialBookName"
              label={t('field.bookName')}
              register={register('financialBookName')}
              placeholder={t('placeholder.bookName')}
            />,
            <FormSelect
              key="status"
              name="status"
              control={control}
              label={t('field.status')}
              options={statusOptions}
              placeholder={t('filter.all')}
            />,
            <FormDateRangePicker
              key="createdOn"
              startName="createdOnFrom"
              endName="createdOnTo"
              control={control}
              label={t('field.createdOn')}
            />,
          ]}
          advancedFields={[
            <FormField
              key="bookId"
              name="bookId"
              label={t('field.bookId')}
              register={register('bookId')}
              placeholder={t('placeholder.bookNo')}
            />,
            <FormField
              key="reserveAssetName"
              name="reserveAssetName"
              label={t('field.reserveAssetName')}
              register={register('reserveAssetName')}
              placeholder={t('placeholder.reserveAssetName')}
            />,
            <FormSelect
              key="currency"
              name="currency"
              control={control}
              label={t('field.currency')}
              options={[{ value: ALL_VALUE, label: t('filter.all') }, ...currencyOptions]}
              placeholder={t('filter.all')}
            />,
            <FormSelect
              key="tokenType"
              name="tokenType"
              control={control}
              label={t('field.tokenType')}
              options={tokenTypeOptions}
              placeholder={t('filter.all')}
            />,
          ]}
          onReset={onReset}
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>

      <Card><div className="border-b px-6 py-3 text-sm font-semibold">
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
            onPageSizeChange: (size) =>
              setPagination({ pageNum: 1, pageSize: size }),
          }}
        />
      </div></Card>
    </div>
  );
}
