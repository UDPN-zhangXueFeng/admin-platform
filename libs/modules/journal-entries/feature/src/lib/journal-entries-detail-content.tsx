'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useBillTxListQuery,
  useCreateBillExportTaskMutation,
  type BillTxItem,
  type BillTxListFilters,
} from '@myorg/modules/journal-entries/data-access';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  getTxTypesByTokenType,
  resolveLendingTypeMessageKey,
  resolveTxTypeMessageKey,
} from '@myorg/modules/journal-entries/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatTime(ts?: number): string {
  return ts ? formatDate(ts, DATETIME_FMT) : EMPTY_DISPLAY;
}

interface TxFilterForm {
  traceId: string;
  txType: string;
  timeFrom: string;
  timeTo: string;
}

const EMPTY_FILTER: TxFilterForm = {
  traceId: '',
  txType: ALL_VALUE,
  timeFrom: '',
  timeTo: '',
};

function formToFilters(
  f: TxFilterForm,
  ruleId: number,
): BillTxListFilters {
  return {
    ruleId,
    traceId: f.traceId.trim() || undefined,
    txType: f.txType !== ALL_VALUE ? Number(f.txType) : undefined,
    startTime: f.timeFrom
      ? startOfDay(parseISO(f.timeFrom)).getTime()
      : undefined,
    endTime: f.timeTo ? endOfDay(parseISO(f.timeTo)).getTime() : undefined,
  };
}

/** 记账规则详情（view.tsx）—— 账本交易列表 + 导出。props 由 shell 从 searchParams 传入。 */
export function JournalEntriesView({
  ruleIdRaw,
  tokenTypeRaw,
}: {
  ruleIdRaw?: string | null;
  tokenTypeRaw?: string | null;
}) {
  const t = useTranslations('modules.journal-entries');
  const router = useRouter();
  const ruleId = parseId(ruleIdRaw);
  const tokenType = tokenTypeRaw ? Number(tokenTypeRaw) : undefined;

  const { control, register, handleSubmit, reset } = useForm<TxFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<TxFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues, ruleId ?? 0),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues, ruleId],
  );
  const listResult = useBillTxListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;

  const exportMutation = useCreateBillExportTaskMutation();

  const txTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...getTxTypesByTokenType(tokenType).map((tx) => ({
        value: String(tx),
        label: t(resolveTxTypeMessageKey(tx) ?? ''),
      })),
    ],
    [t, tokenType],
  );

  const handleExport = () => {
    exportMutation.mutate(
      {
        exportType: 0,
        moduleType: 1,
        billTxListReqVO: formToFilters(queryValues, ruleId ?? 0),
      },
      {
        onSuccess: () => toast.success(t('action.export')),
        onError: () => toast.error(t('action.export')),
      },
    );
  };

  const columns = React.useMemo<ColumnDef<BillTxItem>[]>(
    () => [
      {
        accessorKey: 'traceId',
        header: t('field.traceId'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.traceId ?? ''} />
        ),
      },
      {
        accessorKey: 'dateTime',
        header: t('field.dateTime'),
        cell: ({ row }) => <span>{formatTime(row.original.dateTime)}</span>,
      },
      {
        accessorKey: 'txType',
        header: t('field.txType'),
        cell: ({ row }) => {
          const k = resolveTxTypeMessageKey(row.original.txType);
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
        accessorKey: 'subjectCode',
        header: t('field.subjectCode'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.subjectCode ?? ''} />
        ),
      },
      {
        accessorKey: 'subjectTitle',
        header: t('field.subjectTitle'),
        cell: ({ row }) => (
          <span>{row.original.subjectTitle || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'particularsAccount',
        header: t('field.particularsAccount'),
        cell: ({ row }) => {
          const txKey = resolveTxTypeMessageKey(row.original.txType);
          return (
            <span>
              {row.original.particularsAccount
                ? `${txKey ? t(txKey) : ''} ${row.original.stablecoinName ?? ''} (${row.original.particularsAccount})`.trim()
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        id: 'debit',
        header: t(resolveLendingTypeMessageKey(1) ?? ''),
        cell: ({ row }) => (
          <span>
            {row.original.loanType === 1
              ? String(row.original.txAmount ?? '')
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'credit',
        header: t(resolveLendingTypeMessageKey(2) ?? ''),
        cell: ({ row }) => (
          <span>
            {row.original.loanType === 2
              ? String(row.original.txAmount ?? '')
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => (
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              router.push(
                `/transaction-flow/stablecoin?txHash=${row.original.txHash}`,
              )
            }
          >
            {t('action.view')}
          </Button>
        ),
      },
    ],
    [t, router],
  );

  if (!ruleId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.title')}</p>
      </div>
    );
  }

  const onSubmit = (f: TxFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="traceId"
            label={t('field.traceId')}
            register={register('traceId')}
            placeholder={t('field.traceId')}
          />
          <FormSelect
            name="txType"
            control={control}
            label={t('field.txType')}
            options={txTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="timeFrom"
            control={control}
            label={t('field.dateTime')}
          />
          <FormDatePicker name="timeTo" control={control} label="" />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('filter.query')}</Button>
          <Button type="button" variant="outline" onClick={() => reset(EMPTY_FILTER)}>
            {t('filter.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{t('detail.title')}</div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            {t('action.export')}
          </Button>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={listResult.isLoading || listResult.isFetching}
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

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
