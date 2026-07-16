'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import {
  usePostingBooksQuery,
  type PostingBook,
  type PostingBookListFilters,
  type PostingBookListParams,
} from '@myorg/modules/posting-engine/data-access';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  FIXED_TOKEN_TYPES,
  POSTING_ENGINE_PERMISSIONS,
  postingStatusToneClass,
  resolvePostingStatusMeta,
  resolveTokenTypeMessageKey,
} from '@myorg/modules/posting-engine/util';

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
    currencyCode: form.currencyCode.trim() || undefined,
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
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开，兼容权限未接入场景。 */
  const canViewDetails =
    authPermissions.size === 0 ||
    authPermissions.has(POSTING_ENGINE_PERMISSIONS.Detail);

  const { register, control, handleSubmit, reset } =
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
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

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

  const columns = React.useMemo<ColumnDef<PostingBook>[]>(
    () => [
      {
        accessorKey: 'bookName',
        header: t('field.bookName'),
        cell: ({ row }) => (
          <span>{row.original.bookName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'bookNo',
        header: t('field.bookNo'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.bookNo || EMPTY_DISPLAY}
          </span>
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
          const key = resolveTokenTypeMessageKey(row.original.tokenType);
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        id: 'tokenCount',
        header: t('field.tokenCount'),
        cell: ({ row }) => (
          <span>{row.original.tokens?.length ?? EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'totalEvents',
        header: t('field.totalEvents'),
        cell: ({ row }) => (
          <span>
            {row.original.totalEvents === undefined ||
            row.original.totalEvents === null
              ? EMPTY_DISPLAY
              : row.original.totalEvents}
          </span>
        ),
      },
      {
        accessorKey: 'configured',
        header: t('field.configured'),
        cell: ({ row }) => (
          <span>
            {row.original.configured === undefined ||
            row.original.configured === null
              ? EMPTY_DISPLAY
              : row.original.configured}
          </span>
        ),
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
        cell: ({ row }) => {
          const meta = resolvePostingStatusMeta(row.original.status);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${postingStatusToneClass(
                meta.tone
              )}`}
            >
              {t(meta.labelKey)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) =>
          canViewDetails ? (
            <div className="flex gap-3">
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/posting-engine/book?id=${row.original.financeBookId ?? ''}`
                  )
                }
              >
                {t('action.detail')}
              </Button>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/posting-engine/book?id=${row.original.financeBookId ?? ''}&tab=posting-engine-matrix`
                  )
                }
              >
                {t('action.mappingRules')}
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
          ),
      },
    ],
    [t, canViewDetails, router]
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
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">{t('filter.title')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="financialBookName"
            label={t('field.bookName')}
            register={register('financialBookName')}
            placeholder={t('placeholder.bookName')}
          />
          <FormField
            name="currencyCode"
            label={t('field.currency')}
            register={register('currencyCode')}
            placeholder={t('placeholder.currency')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('field.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="lastRuleUpdateFrom"
            control={control}
            label={t('field.lastRuleUpdateFrom')}
          />
          <FormDatePicker
            name="lastRuleUpdateTo"
            control={control}
            label={t('field.lastRuleUpdateTo')}
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
