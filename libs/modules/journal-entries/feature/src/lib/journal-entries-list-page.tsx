'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useBillRuleListQuery,
  useBlockchainListQuery,
  useCurrencyListQuery,
  useOperateBillRuleMutation,
  useStablecoinSearchesQuery,
  type BillRule,
  type BillRuleListFilters,
} from '@myorg/modules/journal-entries/data-access';
import {
  ALL_VALUE,
  BILL_OPERATE_DISABLE,
  BILL_OPERATE_ENABLE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  RULE_STATE_ACTIVE,
  RULE_STATE_INACTIVE,
  RULE_STATUS_META,
  TD_TOKEN_TYPE_VALUES,
  resolveTokenTypeMessageKey,
  statusToneClass,
} from '@myorg/modules/journal-entries/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

interface RuleFilterForm {
  ledgerName: string;
  stablecoinId: string;
  tokenType: string;
  currencySymbol: string;
  blockchainId: string;
  createTimeFrom: string;
  createTimeTo: string;
  state: string;
}

const EMPTY_FILTER: RuleFilterForm = {
  ledgerName: '',
  stablecoinId: ALL_VALUE,
  tokenType: ALL_VALUE,
  currencySymbol: ALL_VALUE,
  blockchainId: ALL_VALUE,
  createTimeFrom: '',
  createTimeTo: '',
  state: ALL_VALUE,
};

function formToFilters(f: RuleFilterForm): BillRuleListFilters {
  return {
    ledgerName: f.ledgerName.trim() || undefined,
    stablecoinId: f.stablecoinId !== ALL_VALUE ? f.stablecoinId : undefined,
    tokenType: f.tokenType !== ALL_VALUE ? Number(f.tokenType) : undefined,
    currencySymbol: f.currencySymbol !== ALL_VALUE ? f.currencySymbol : undefined,
    blockchainId: f.blockchainId !== ALL_VALUE ? f.blockchainId : undefined,
    createStartTime: f.createTimeFrom
      ? startOfDay(parseISO(f.createTimeFrom)).getTime()
      : undefined,
    createEndTime: f.createTimeTo
      ? endOfDay(parseISO(f.createTimeTo)).getTime()
      : undefined,
    state: f.state !== ALL_VALUE ? f.state : undefined,
  };
}

/**
 * JournalEntriesListPage — 记账规则列表页。
 *
 * 迁移自 td-manage src/pages/financial/journal-entries/index.tsx（294 行）。
 * useCustomTable → RHF + DataTable。保留：7 维筛选 + 9 列 + View/Disable/Enable + Add。
 */
export function JournalEntriesListPage() {
  const t = useTranslations('modules.journal-entries');
  const router = useRouter();

  const { control, register, handleSubmit, reset } = useForm<RuleFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<RuleFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useBillRuleListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const stablecoinSearches = useStablecoinSearchesQuery();
  const blockchainList = useBlockchainListQuery();
  const currencyList = useCurrencyListQuery();
  const operateMutation = useOperateBillRuleMutation();

  const stablecoinOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(stablecoinSearches.data ?? []).map((s) => ({
        value: String(s.stablecoinId ?? ''),
        label: s.name ?? '',
      })),
    ],
    [t, stablecoinSearches.data],
  );
  const tokenTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...TD_TOKEN_TYPE_VALUES.map((v) => ({
        value: String(v),
        label: t(`tokenType.${v}`),
      })),
    ],
    [t],
  );
  const currencyOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(currencyList.data ?? []).map((c) => ({
        value: c.key ?? '',
        label: c.value ?? '',
      })),
    ],
    [t, currencyList.data],
  );
  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(blockchainList.data ?? []).map((b) => ({
        value: String(b.key ?? ''),
        label: b.value ?? '',
      })),
    ],
    [t, blockchainList.data],
  );
  const stateOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: String(RULE_STATE_ACTIVE), label: t('status.active') },
      { value: String(RULE_STATE_INACTIVE), label: t('status.inactive') },
    ],
    [t],
  );

  const handleOperate = React.useCallback(
    (rule: BillRule, state: number, confirmKey: string) => {
      if (!window.confirm(t(confirmKey, { tokenName: rule.tokenName ?? '' })))
        return;
      operateMutation.mutate(
        { ruleId: rule.ruleId ?? 0, state },
        {
          onSuccess: () => toast.success(t('operateSuccess')),
          onError: () => toast.error(t('operateSuccess')),
        },
      );
    },
    [operateMutation, t],
  );

  const columns = React.useMemo<ColumnDef<BillRule>[]>(
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
        accessorKey: 'ledgerName',
        header: t('field.ledgerName'),
        cell: ({ row }) => (
          <span>{row.original.ledgerName || EMPTY_DISPLAY}</span>
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
          const k = resolveTokenTypeMessageKey(row.original.tokenType);
          return <span>{k ? t(k) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'blockchainName',
        header: t('field.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'currencySymbol',
        header: t('field.currency'),
        cell: ({ row }) => (
          <span>{row.original.currencySymbol || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'usPrice',
        header: t('field.price'),
        cell: ({ row }) => (
          <span>
            {row.original.usPrice != null
              ? `1 ${row.original.tokenSymbol ?? ''} = ${row.original.usPrice} ${row.original.currencySymbol ?? ''}`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('field.createTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'state',
        header: t('field.status'),
        cell: ({ row }) => {
          const meta = RULE_STATUS_META[row.original.state ?? 0];
          return meta ? (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
                meta.tone,
              )}`}
            >
              {t(meta.labelKey)}
            </span>
          ) : (
            <span>{EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-3">
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/journal-entries/view?id=${r.ruleId}&type=${r.tokenType ?? ''}`,
                  )
                }
              >
                {t('action.view')}
              </Button>
              {r.state === RULE_STATE_ACTIVE ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    handleOperate(r, BILL_OPERATE_DISABLE, 'confirmDisable')
                  }
                >
                  {t('action.disable')}
                </Button>
              ) : null}
              {r.state === RULE_STATE_INACTIVE ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    handleOperate(r, BILL_OPERATE_ENABLE, 'confirmEnable')
                  }
                >
                  {t('action.enable')}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, router, pagination.pageNum, pagination.pageSize, handleOperate],
  );

  const onSubmit = React.useCallback((f: RuleFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="ledgerName"
            label={t('field.ledgerName')}
            register={register('ledgerName')}
            placeholder={t('field.ledgerName')}
          />
          <FormSelect
            name="stablecoinId"
            control={control}
            label={t('field.tokenName')}
            options={stablecoinOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('field.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="currencySymbol"
            control={control}
            label={t('field.currency')}
            options={currencyOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label={t('field.blockchain')}
            options={blockchainOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="state"
            control={control}
            label={t('field.status')}
            options={stateOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="createTimeFrom"
            control={control}
            label={t('field.createTimeFrom')}
          />
          <FormDatePicker
            name="createTimeTo"
            control={control}
            label={t('field.createTimeTo')}
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
          <div className="text-sm font-semibold">{t('list.title')}</div>
          <Button onClick={() => router.push('/journal-entries/create')}>
            {t('action.add')}
          </Button>
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
