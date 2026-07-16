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
  useNormalizationBooksQuery,
  type NormalizationBook,
  type NormalizationBookListFilters,
  type NormalizationBookListParams,
} from '@myorg/modules/transaction-event-configuration/data-access';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  FIXED_TOKEN_TYPES,
  TX_EVENT_CONFIG_PERMISSIONS,
  formatAssetValue,
  formatDateTime,
  resolveBookListStatusMeta,
  statusToneClass,
} from '@myorg/modules/transaction-event-configuration/util';

/**
 * react-hook-form 筛选表单形状。
 * 文本空串 = 无筛选；下拉 `'all'` = 无筛选；日期为 `YYYY-MM-DD` 字符串。
 */
interface NormalizationBookFilterForm {
  financialBookName: string;
  currency: string;
  tokenType: string;
  createdFrom: string;
  createdTo: string;
}

const EMPTY_FORM: NormalizationBookFilterForm = {
  financialBookName: '',
  currency: '',
  tokenType: ALL_VALUE,
  createdFrom: '',
  createdTo: '',
};

/** 将表单值转换为后端筛选条件（纯函数）。 */
function formToFilters(
  form: NormalizationBookFilterForm
): NormalizationBookListFilters {
  return {
    financialBookName: form.financialBookName.trim() || undefined,
    currencyCode: form.currency.trim() || undefined,
    tokenType:
      form.tokenType && form.tokenType !== ALL_VALUE
        ? Number(form.tokenType)
        : undefined,
    startDate: form.createdFrom
      ? startOfDay(parseISO(form.createdFrom)).getTime()
      : undefined,
    endDate: form.createdTo
      ? endOfDay(parseISO(form.createdTo)).getTime()
      : undefined,
  };
}

/**
 * TxEventConfigListPage — Normalization Book 列表页。
 *
 * 迁移自 td-manage `pages/financial/transaction-event-configuration/index.tsx`（587 行）。
 * 保留：多维筛选（bookName / tokenType / currency / 创建日期范围）、服务端分页、
 * 状态 badge 自适应（active / inactive）、操作列 Configure Mapping Rules。
 */
export function TxEventConfigListPage() {
  const t = useTranslations('modules.transaction-event-configuration');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开，兼容权限未接入场景。 */
  const canConfigureMappingRules =
    authPermissions.size === 0 ||
    authPermissions.has(TX_EVENT_CONFIG_PERMISSIONS.ViewMappingRules);

  const { register, control, handleSubmit, reset } =
    useForm<NormalizationBookFilterForm>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<NormalizationBookFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo<NormalizationBookListParams>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues]
  );

  const listResult = useNormalizationBooksQuery(params);
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

  const columns = React.useMemo<ColumnDef<NormalizationBook>[]>(
    () => [
      {
        accessorKey: 'bookName',
        header: t('field.bookName'),
        cell: ({ row }) => (
          <span>{row.original.bookName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('field.tokenType'),
        cell: ({ row }) => {
          const tt = row.original.tokenType;
          const known =
            tt !== undefined &&
            (FIXED_TOKEN_TYPES as readonly number[]).includes(tt);
          return <span>{known ? t(`tokenType.${tt}`) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'reserveAssetName',
        header: t('field.reserveAsset'),
        cell: ({ row }) => (
          <span>{row.original.reserveAssetName || EMPTY_DISPLAY}</span>
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
        accessorKey: 'assetValue',
        header: t('field.assetValue'),
        cell: ({ row }) => (
          <span>{formatAssetValue(row.original.assetValue)}</span>
        ),
      },
      {
        id: 'tokens',
        header: t('field.tokens'),
        cell: ({ row }) => {
          const names = (row.original.tokens ?? [])
            .map((token) => token.tokenName)
            .filter((name): name is string => Boolean(name));
          return <span>{names.length ? names.join(', ') : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'createdOn',
        header: t('field.createdOn'),
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.createdOn)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const meta = resolveBookListStatusMeta(
            row.original.status,
            row.original.statusName
          );
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
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
          canConfigureMappingRules ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/transaction-event-configuration/mapping-rule?id=${row.original.financeBookId ?? ''}`
                )
              }
            >
              {t('action.configureMappingRules')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
          ),
      },
    ],
    [t, canConfigureMappingRules, router]
  );

  const onSubmit = React.useCallback((form: NormalizationBookFilterForm) => {
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
          <FormSelect
            name="tokenType"
            control={control}
            label={t('field.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormField
            name="currency"
            label={t('field.currency')}
            register={register('currency')}
            placeholder={t('placeholder.currency')}
          />
          <FormDatePicker
            name="createdFrom"
            control={control}
            label={t('field.createdFrom')}
          />
          <FormDatePicker
            name="createdTo"
            control={control}
            label={t('field.createdTo')}
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
