'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import { Card, DataTable } from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import { useTokenTypesQuery } from '@myorg/modules/td-admin/data-access';
import {
  useBlockchainListQuery,
  useJournalListQuery,
  useStablecoinSearchesQuery,
  type JournalEntry,
  type JournalListFilters,
  type JournalListParams,
} from '@myorg/modules/td-admin/data-access/lib/journal-entries-new';
import { QueryForm } from '../query-form';
import { JournalFilterSelect } from './journal-filter-select';
import { useJournalListColumns } from './journal-entries-new-columns';
import { JournalPagination } from './journal-pagination';
import {
  ALL_VALUE,
  FIXED_TOKEN_TYPES,
  DEFAULT_PAGE_SIZE,
  canViewJournalDetails,
  TRANSACTION_TYPE_VALUES,
  normalizeTextValue,
} from './journal-entries-new.constants';
/**
 * react-hook-form 筛选表单形状。
 *
 * 文本空串 = 无筛选；下拉 `'all'` = 无筛选；日期为 `YYYY-MM-DD` 字符串。
 * 对应源项目 `JournalEntriesFilterValues`。
 */
interface JournalFilterForm {
  tokenName: string;
  tokenType: string;
  from: string;
  to: string;
  transactionType: string;
  blockchainId: string;
  transactionTimeFrom: string;
  transactionTimeTo: string;
  transactionHash: string;
}

const EMPTY_FORM: JournalFilterForm = {
  tokenName: ALL_VALUE,
  tokenType: ALL_VALUE,
  from: '',
  to: '',
  transactionType: ALL_VALUE,
  blockchainId: ALL_VALUE,
  transactionTimeFrom: '',
  transactionTimeTo: '',
  transactionHash: '',
};

/** 将表单值转换为后端筛选条件（纯函数，便于单测；对应源项目 `buildJournalListReqData`）。 */
function formToFilters(form: JournalFilterForm): JournalListFilters {
  return {
    fromAddress: normalizeTextValue(form.from),
    toAddress: normalizeTextValue(form.to),
    tokenName: form.tokenName !== ALL_VALUE ? normalizeTextValue(form.tokenName) : undefined,
    tokenType:
      form.tokenType && form.tokenType !== ALL_VALUE
        ? Number(form.tokenType)
        : undefined,
    txType:
      form.transactionType && form.transactionType !== ALL_VALUE
        ? Number(form.transactionType)
        : undefined,
    txHash: normalizeTextValue(form.transactionHash),
    startTime: form.transactionTimeFrom
      ? startOfDay(parseISO(form.transactionTimeFrom)).getTime()
      : undefined,
    endTime: form.transactionTimeTo
      ? endOfDay(parseISO(form.transactionTimeTo)).getTime()
      : undefined,
    blockchainId:
      form.blockchainId && form.blockchainId !== ALL_VALUE
        ? Number(form.blockchainId)
        : undefined,
  };
}

export function JournalEntriesNewListPage() {
  const t = useTranslations('modules.journal-entries-new');
  const router = useRouter();
  const { permissions } = useAuth();
  const canViewDetails = canViewJournalDetails(process.env.NEXT_PUBLIC_SYS_ENV, permissions);

  const { register, control, handleSubmit, reset } =
    useForm<JournalFilterForm>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<JournalFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const { data: stablecoinList } = useStablecoinSearchesQuery();
  const { data: blockchainList } = useBlockchainListQuery();
  const { data: tokenTypes } = useTokenTypesQuery();

  const params = React.useMemo<JournalListParams>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues]
  );

  const { data, error, isError, isLoading, isFetching, refetch } = useJournalListQuery(params);
  const rows = isError ? [] : data?.rows ?? [];
  const total = isError ? 0 : data?.page?.total ?? 0;

  const tokenNameOptions = React.useMemo(() => {
    const names = (stablecoinList ?? [])
      .map((item) => item.name)
      .filter((name): name is string => Boolean(name));
    const unique = Array.from(new Set(names));
    return [
      { value: ALL_VALUE, label: t('filter.all') },
      ...unique.map((name) => ({ value: name, label: name })),
    ];
  }, [stablecoinList, t]);

  const tokenTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(tokenTypes ?? []).flatMap(({ tokenTypeId, tokenTypeName, status }) =>
        FIXED_TOKEN_TYPES.some((id) => id === Number(tokenTypeId)) && tokenTypeName
          ? [{ value: String(tokenTypeId), label: tokenTypeName, disabled: status === 0 }]
          : []
      ),
    ],
    [t, tokenTypes]
  );

  const transactionTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...TRANSACTION_TYPE_VALUES.map((value) => ({
        value: String(value),
        label: t(`transactionType.${value}`),
      })),
    ],
    [t]
  );

  const blockchainOptions = React.useMemo(() => {
    const items = (blockchainList ?? [])
      .filter((item) => item.key != null && Number.isFinite(Number(item.key)))
      .map((item) => ({
        value: String(item.key),
        label: item.value || String(item.key),
        disabled: item.status === 1 ? false : true,
      }));
    return [{ value: ALL_VALUE, label: t('filter.all') }, ...items];
  }, [blockchainList, t]);

  const viewDetails = React.useCallback((record: JournalEntry) => {
    router.push(`/accounting/journal-entries-new/view?tdTxId=${encodeURIComponent(record.tdTxId)}`);
  }, [router]);
  const columns = useJournalListColumns(canViewDetails ? viewDetails : undefined);

  const onSubmit = React.useCallback((form: JournalFilterForm) => {
    if (params.pageNum === 1 && JSON.stringify(params.filters) === JSON.stringify(formToFilters(form))) {
      void refetch();
    }
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryValues(form);
  }, [params, refetch]);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
    if (params.pageNum === 1 && !Object.values(params.filters).some((value) => value !== undefined)) {
      void refetch();
    }
  }, [params, refetch, reset]);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <QueryForm
          queryType="submit"
          fields={[
            <JournalFilterSelect
              key="tokenName"
              name="tokenName"
              control={control}
              label={t('field.tokenName')}
              options={tokenNameOptions}
              clearLabel={t('filter.clearToken')}
            />,
            <FormField
              key="transactionHash"
              name="transactionHash"
              label={t('field.transactionHash')}
              register={register('transactionHash')}
              placeholder={t('placeholder.transactionHash')}
            />,
            <FormDateRangePicker
              key="transactionTime"
              startName="transactionTimeFrom"
              endName="transactionTimeTo"
              control={control}
              label={t('field.transactionTime')}
            />,
          ]}
          advancedFields={[
            <JournalFilterSelect
              key="tokenType"
              name="tokenType"
              control={control}
              label={t('field.tokenType')}
              options={tokenTypeOptions}
            />,
            <FormField
              key="from"
              name="from"
              label={t('field.from')}
              register={register('from')}
              placeholder={t('placeholder.address')}
            />,
            <FormField
              key="to"
              name="to"
              label={t('field.to')}
              register={register('to')}
              placeholder={t('placeholder.address')}
            />,
            <FormSelect
              key="transactionType"
              name="transactionType"
              control={control}
              label={t('field.transactionType')}
              options={transactionTypeOptions}
              placeholder={t('filter.all')}
            />,
            <JournalFilterSelect
              key="blockchainId"
              name="blockchainId"
              control={control}
              label={t('field.blockchain')}
              options={blockchainOptions}
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
        {isError && <p role="alert" className="mb-3 text-sm text-destructive">{error.message}</p>}
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading || isFetching}
          emptyMessage={t('empty')}
        />
        <JournalPagination
          page={pagination.pageNum}
          pageSize={pagination.pageSize}
          total={total}
          visible={rows.length}
          disabled={isFetching}
          onPageChange={(pageNum) => setPagination((prev) => ({ ...prev, pageNum }))}
        />
      </div></Card>
    </div>
  );
}
