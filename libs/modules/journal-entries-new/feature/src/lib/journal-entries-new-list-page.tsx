'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { useAuth } from '@myorg/shared/util-auth';

import { JournalTxHashCell } from '@myorg/modules/journal-entries-new/ui';
import {
  useBlockchainListQuery,
  useJournalListQuery,
  useStablecoinSearchesQuery,
  type JournalEntry,
  type JournalListFilters,
  type JournalListParams,
} from '@myorg/modules/journal-entries-new/data-access';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  FIXED_TOKEN_TYPES,
  JOURNAL_DATETIME_FORMAT,
  JOURNAL_ENTRIES_PERMISSIONS,
  TRANSACTION_TYPE_VALUES,
  normalizeTextValue,
  resolveTokenTypeMessageKey,
  resolveTxTypeMessageKey,
} from '@myorg/modules/journal-entries-new/util';

const EMPTY_DISPLAY = '--';

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
  const fromText = (value: string, allValue = ALL_VALUE) =>
    value && value !== allValue ? value : undefined;

  return {
    fromAddress: normalizeTextValue(form.from),
    toAddress: normalizeTextValue(form.to),
    tokenName: fromText(form.tokenName) || undefined,
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

/**
 * 金额 + 货币码组合展示（源项目 `formatTxAmount`）。
 * 无金额 → '--'；无货币码 → 纯金额；否则 `${amount} ${currencyCode}`。
 */
function formatTxAmount(
  amount?: string | number,
  currencyCode?: string
): string {
  if (amount === null || amount === undefined || amount === '') {
    return EMPTY_DISPLAY;
  }
  if (!currencyCode) {
    return String(amount);
  }
  return `${amount} ${currencyCode}`;
}

/**
 * JournalEntriesNewListPage — 筛选 + 服务端分页 + antd→DataTable 迁移。
 *
 * 迁移自源项目 `td-manage` 的 `src/pages/financial/journal-entries-new/index.tsx`，
 * 关键逻辑保留：多维筛选（token/type/from/to/txType/blockchain/time/hash）、
 * 服务端分页、详情按钮按权限（TDManage UUID）门控。
 */
export function JournalEntriesNewListPage() {
  const t = useTranslations('modules.journal-entries-new');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开，兼容权限未接入场景（等价源项目非 TDManage 环境）。 */
  const canViewDetails =
    authPermissions.size === 0 ||
    authPermissions.has(JOURNAL_ENTRIES_PERMISSIONS.Detail);

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

  const params = React.useMemo<JournalListParams>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues]
  );

  const listResult = useJournalListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

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
      ...FIXED_TOKEN_TYPES.map((tokenType) => ({
        value: String(tokenType),
        label: t(`tokenType.${tokenType}`),
      })),
    ],
    [t]
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
      .filter((item) => item.key !== undefined && item.key !== null)
      .map((item) => ({
        value: String(item.key),
        label: item.value || String(item.key),
        disabled: item.status === 1 ? false : true,
      }));
    return [{ value: ALL_VALUE, label: t('filter.all') }, ...items];
  }, [blockchainList, t]);

  const columns = React.useMemo<ColumnDef<JournalEntry>[]>(
    () => [
      {
        accessorKey: 'fromAddress',
        header: t('field.from'),
        cell: ({ row }) => (
          <JournalTxHashCell value={row.original.fromAddress} copyLabel={t('copy')} />
        ),
      },
      {
        accessorKey: 'toAddress',
        header: t('field.to'),
        cell: ({ row }) => (
          <JournalTxHashCell value={row.original.toAddress} copyLabel={t('copy')} />
        ),
      },
      {
        accessorKey: 'tokenName',
        header: t('field.tokenName'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
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
        accessorKey: 'blockchain',
        header: t('field.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchain || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'txType',
        header: t('field.transactionType'),
        cell: ({ row }) => {
          const key = resolveTxTypeMessageKey(row.original.txType);
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'transactionAmount',
        header: t('field.transactionAmount'),
        cell: ({ row }) => (
          <span>
            {formatTxAmount(
              row.original.transactionAmount,
              row.original.currencyCode
            )}
          </span>
        ),
      },
      {
        accessorKey: 'transactionTime',
        header: t('field.transactionTime'),
        cell: ({ row }) => {
          const ts = row.original.transactionTime;
          if (!ts) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{formatDate(ts, JOURNAL_DATETIME_FORMAT)}</span>;
        },
      },
      {
        accessorKey: 'txHash',
        header: t('field.transactionHash'),
        cell: ({ row }) => (
          <JournalTxHashCell value={row.original.txHash} copyLabel={t('copy')} />
        ),
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) =>
          canViewDetails ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/journal-entries-new/view?tdTxId=${row.original.tdTxId}`
                )
              }
            >
              {t('action.detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
          ),
      },
    ],
    [t, canViewDetails, router]
  );

  const onSubmit = React.useCallback((form: JournalFilterForm) => {
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormSelect
            name="tokenName"
            control={control}
            label={t('field.tokenName')}
            options={tokenNameOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('field.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormField
            name="from"
            label={t('field.from')}
            register={register('from')}
            placeholder={t('placeholder.address')}
          />
          <FormField
            name="to"
            label={t('field.to')}
            register={register('to')}
            placeholder={t('placeholder.address')}
          />
          <FormSelect
            name="transactionType"
            control={control}
            label={t('field.transactionType')}
            options={transactionTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label={t('field.blockchain')}
            options={blockchainOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="transactionTimeFrom"
            control={control}
            label={t('field.transactionTimeFrom')}
          />
          <FormDatePicker
            name="transactionTimeTo"
            control={control}
            label={t('field.transactionTimeTo')}
          />
          <FormField
            name="transactionHash"
            label={t('field.transactionHash')}
            register={register('transactionHash')}
            placeholder={t('placeholder.transactionHash')}
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
