'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Button, Card, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import {
  FormDateRangePicker,
  FormField,
  FormSelect,
} from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import {
  useCurrencyListQuery,
  useTokenTypeListQuery,
  useNormalizationBooksQuery,
  type NormalizationBook,
  type NormalizationBookListFilters,
  type NormalizationBookListParams,
} from '@myorg/modules/td-admin/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  FIXED_TOKEN_TYPES,
  canViewMappingRules,
  formatAssetValue,
  formatDateTime,
  resolveBookListStatusMeta,
  statusToneClass,
} from '.';
import { ALL_VALUE } from './tx-event-config.constants';
import { QueryForm } from '../query-form';

interface NormalizationBookFilterForm {
  financialBookName: string;
  currency: string;
  tokenType: string;
  createdFrom: string;
  createdTo: string;
}

const EMPTY_FORM: NormalizationBookFilterForm = {
  financialBookName: '',
  currency: ALL_VALUE,
  tokenType: ALL_VALUE,
  createdFrom: '',
  createdTo: '',
};

function formToFilters(
  form: NormalizationBookFilterForm
): NormalizationBookListFilters {
  return {
    financialBookName: form.financialBookName.trim() || undefined,
    currencyCode: form.currency === ALL_VALUE ? undefined : form.currency,
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

export function TxEventConfigListPage() {
  const t = useTranslations('modules.transaction-event-configuration');
  const router = useRouter();
  const { permissions } = useAuth();
  const canConfigureMappingRules = canViewMappingRules(permissions);

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
  const { data: currencies, error: currencyError } = useCurrencyListQuery();
  const { data: tokenTypes, error: tokenTypeError } = useTokenTypeListQuery();
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const tokenTypeById = React.useMemo(
    () => new Map(tokenTypes?.map((option) => [Number(option.tokenTypeId), option])),
    [tokenTypes]
  );
  const tokenTypeOptions = [
    { value: ALL_VALUE, label: t('filter.all') },
    ...FIXED_TOKEN_TYPES.flatMap((id) => {
      const option = tokenTypeById.get(id);
      return option ? [{
        value: String(id),
        label: option.tokenTypeName?.trim() || t(`tokenType.${id}`),
        disabled: Number(option.status) === 0,
      }] : [];
    }),
  ];
  const currencyOptions = [
    { value: ALL_VALUE, label: t('filter.all') },
    ...Array.from(new Set((currencies ?? []).map(({ key, value }) => (value || key || '').trim()).filter(Boolean)))
      .sort()
      .map((code) => ({ value: code, label: code })),
  ];
  const columns = React.useMemo<ColumnDef<NormalizationBook>[]>(
    () => [
      {
        accessorKey: 'bookName',
        header: t('field.bookName'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.bookName || EMPTY_DISPLAY} copyLabel={t('copy')} />
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
          return <span>{tokenTypeById.get(Number(tt))?.tokenTypeName?.trim() || (known ? t(`tokenType.${tt}`) : EMPTY_DISPLAY)}</span>;
        },
      },
      {
        accessorKey: 'reserveAssetName',
        header: t('field.reserveAsset'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.reserveAssetName || EMPTY_DISPLAY} copyLabel={t('copy')} />
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
            row.original.status ?? tokenTypeById.get(Number(row.original.tokenType))?.status,
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
        enableSorting: false,
        meta: { overflow: 'none', stickyRight: true },
        cell: ({ row }) => canConfigureMappingRules && row.original.financeBookId
          ? (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => router.push(`/accounting/transaction-event-configuration/mapping-rule?id=${row.original.financeBookId}`)}>
                {t('action.configureMappingRules')}
              </Button>
            )
          : EMPTY_DISPLAY,
      },
    ],
    [t, canConfigureMappingRules, router, tokenTypeById]
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
              key="tokenType"
              name="tokenType"
              control={control}
              label={t('field.tokenType')}
              options={tokenTypeOptions}
              placeholder={t('filter.all')}
            />,
            <FormDateRangePicker
              key="createdOn"
              startName="createdFrom"
              endName="createdTo"
              control={control}
              label={t('field.createdOn')}
            />,
            <FormSelect
              key="currency"
              name="currency"
              control={control}
              label={t('field.currency')}
              options={currencyOptions}
              placeholder={t('filter.all')}
            />,
          ]}
          onReset={onReset}
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>
      {[listResult.error, currencyError, tokenTypeError].filter((error) => error !== null).map((error, index) => (
        <p key={index} role="alert" className="text-sm text-destructive">{error?.message}</p>
      ))}
      <Card>
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
              summary: t('resultRange', { start: rows.length ? (pagination.pageNum - 1) * pagination.pageSize + 1 : 0, end: (pagination.pageNum - 1) * pagination.pageSize + rows.length, total }),
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
            }}
          />
        </div>
      </Card>
    </div>
  );
}
