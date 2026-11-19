'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import { Card, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import {
  usePostingBooksQuery,
  useTokenTypeOptionsQuery,
  type PostingBook,
  type PostingBookListFilters,
  type PostingBookListParams,
} from '@myorg/modules/td-admin/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  FIXED_TOKEN_TYPES,
  POSTING_ENGINE_PERMISSIONS,
  POSTING_ENGINE_PATH,
  ALL_VALUE,
  paginationRange,
} from './posting-engine.constants';
import { PostingStatusBadge } from './posting-status-badge';
import { QueryForm } from '../query-form';
import { createRowActionsColumn } from '../row-actions';

/**
 * react-hook-form 筛选表单形状。
 *
 * 文本空串 = 无筛选；下拉 `'all'` = 无筛选；日期为 `YYYY-MM-DD` 字符串。
 */
interface PostingBookFilterForm {
  financialBookName: string;
  currencyCode: string;
  tokenType: string;
  lastRuleUpdateFrom: string;
  lastRuleUpdateTo: string;
}

const EMPTY_FORM: PostingBookFilterForm = {
  financialBookName: '',
  currencyCode: '',
  tokenType: ALL_VALUE,
  lastRuleUpdateFrom: '',
  lastRuleUpdateTo: '',
};

/** 将表单值转换为后端筛选条件（纯函数）。 */
function formToFilters(form: PostingBookFilterForm): PostingBookListFilters {
  return {
    financialBookName: form.financialBookName.trim() || undefined,
    currencyCode: form.currencyCode === ALL_VALUE ? undefined : form.currencyCode.trim() || undefined,
    tokenType:
      form.tokenType && form.tokenType !== ALL_VALUE
        ? Number(form.tokenType)
        : undefined,
    startDate: form.lastRuleUpdateFrom
      ? startOfDay(parseISO(form.lastRuleUpdateFrom)).getTime()
      : undefined,
    endDate: form.lastRuleUpdateTo
      ? endOfDay(parseISO(form.lastRuleUpdateTo)).getTime()
      : undefined,
  };
}

/**
 * PostingEngineListPage — 过账账本列表页。
 *
 * 迁移自 td-manage `src/pages/financial/posting-engine/index.tsx`（492 行）。
 * 保留：多维筛选（bookName / currency / tokenType / lastRuleUpdate 日期范围）、
 * 服务端分页、操作列（Detail / Mapping Rules，均进入账本详情页，后者带 tab 参数）、
 * 状态 badge 自适应。
 */
export function PostingEngineListPage() {
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const { permissions } = useAuth();
  const canViewDetails = permissions.has(POSTING_ENGINE_PERMISSIONS.Details);
  const canViewRules = permissions.has(POSTING_ENGINE_PERMISSIONS.MappingRules);

  const { register, control, handleSubmit, reset, watch } =
    useForm<PostingBookFilterForm>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<PostingBookFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo<PostingBookListParams>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues]
  );

  const listResult = usePostingBooksQuery(params);
  const rows = listResult.isError ? [] : listResult.data?.rows ?? [];
  const total = listResult.isError ? 0 : listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const { data: tokenTypes } = useTokenTypeOptionsQuery();
  const filteredTokenTypes = React.useMemo(() => (tokenTypes ?? []).flatMap((item) => {
    const id = Number(item.tokenTypeId);
    return FIXED_TOKEN_TYPES.some((type) => type === id) && item.tokenTypeName
      ? [{ value: String(id), label: item.tokenTypeName, disabled: Number(item.status) === 0 }]
      : [];
  }), [tokenTypes]);
  const tokenTypeOptions = [{ value: ALL_VALUE, label: t('filter.all') }, ...filteredTokenTypes];
  const selectedCurrency = watch('currencyCode').trim();
  const currencyOptions = React.useMemo(() => {
    const currencies = new Set(
      rows
        .map((row) => row.currencyCode?.trim())
        .filter((value): value is string => Boolean(value && value !== EMPTY_DISPLAY))
    );
    if (selectedCurrency && selectedCurrency !== ALL_VALUE) {
      currencies.add(selectedCurrency);
    }
    return [
      { value: ALL_VALUE, label: t('filter.all') },
      ...Array.from(currencies)
        .sort()
        .map((currency) => ({ value: currency, label: currency })),
    ];
  }, [rows, selectedCurrency, t]);


  const columns = React.useMemo<ColumnDef<PostingBook>[]>(
    () => [
      {
        accessorKey: 'bookName',
        header: t('field.bookName'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.bookName} copyLabel={t('copy')} showCopyIcon />
        ),
      },
      {
        accessorKey: 'bookNo',
        header: t('field.bookNo'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.bookNo} copyLabel={t('copy')} showCopyIcon />
        ),
      },
      {
        accessorKey: 'currencyCode',
        header: t('field.currency'),
        cell: ({ row }) => (
          <span>{row.original.currencyCode || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('field.tokenType'),
        cell: ({ row }) => {
          return filteredTokenTypes.find(({ value }) => value === String(row.original.tokenType))?.label
            ?? EMPTY_DISPLAY;
        },
      },
      {
        id: 'tokenCount',
        header: t('field.tokenCount'),
        cell: ({ row }) => (
          <span>{row.original.tokens?.length ?? 0}</span>
        ),
      },
      {
        accessorKey: 'totalEvents',
        header: t('field.totalEvents'),
        cell: ({ row }) => row.original.totalEvents ?? 0,
      },
      {
        accessorKey: 'configured',
        header: t('field.configured'),
        cell: ({ row }) => row.original.configured ?? 0,
      },
      {
        accessorKey: 'lastRuleUpdate',
        header: t('field.lastRuleUpdate'),
        cell: ({ row }) => (
          <span>{row.original.lastRuleUpdate || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => <PostingStatusBadge scope="book" status={row.original.status} statusName={row.original.statusName} />,
      },
      canViewDetails || canViewRules
        ? createRowActionsColumn<PostingBook>({
            header: t('field.actions'),
            detail: canViewDetails ? {
              label: t('action.detail'),
              onClick: (row) => router.push(`${POSTING_ENGINE_PATH}/book?id=${row.financeBookId}`),
            } : undefined,
            menu: canViewRules ? () => [{
              label: t('action.mappingRules'),
              onClick: (row) => router.push(`${POSTING_ENGINE_PATH}/book?id=${row.financeBookId}&tab=posting-engine-matrix`),
            }] : undefined,
          })
        : { ...createRowActionsColumn<PostingBook>({ header: t('field.actions') }), cell: () => EMPTY_DISPLAY },
    ],
    [t, canViewDetails, canViewRules, router, filteredTokenTypes]
  );

  const onSubmit = React.useCallback((form: PostingBookFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryValues(form);
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

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
              key="currencyCode"
              name="currencyCode"
              control={control}
              label={t('field.currency')}
              options={currencyOptions}
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
          advancedFields={[
            <FormDateRangePicker
              key="lastRuleUpdate"
              startName="lastRuleUpdateFrom"
              endName="lastRuleUpdateTo"
              control={control}
              label={t('field.lastRuleUpdate')}
            />,
          ]}
          onReset={onReset}
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>

      <Card>
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('records')}
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={listResult.isError ? t('loadError') : t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
              summary: t('pagination.range', paginationRange(pagination.pageNum, total)),
            }}
          />
        </div>
      </Card>
    </div>
  );
}
