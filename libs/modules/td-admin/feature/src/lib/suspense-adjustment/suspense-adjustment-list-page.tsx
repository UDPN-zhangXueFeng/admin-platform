'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';

import { Card, CopyableEllipsisText, DataTable, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';

import {
  useSuspenseAdjustmentListQuery,
  type SuspenseAdjustmentListItem,
  type SuspenseAdjustmentListQuery,
} from '@myorg/modules/td-admin/data-access';
import {
  CLEAR_STATUS_MAP,
  CLEAR_STATUS_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  formatAmount,
  getAgeTagTone,
  textOrDash,
} from '@myorg/modules/td-admin/data-access';
import type { ClearStatus, SourceType } from '@myorg/modules/td-admin/data-access';
import { SuspenseStatusBadge } from '.';
import { QueryForm } from '../query-form';
import { createRowActionsColumn } from '../row-actions';

const ALL = 'ALL';
const PAGE_SIZE = 10;

/**
 * react-hook-form 筛选表单形状。
 * 文本空串 = 无筛选；下拉 'ALL' = 无筛选；日期为 YYYY-MM-DD 字符串。
 */
interface SuspenseAdjustmentFilterForm {
  postingDateFrom: string;
  postingDateTo: string;
  suspenseTxnId: string;
  transactionId: string;
  sourceType: string;
  status: string;
}

const EMPTY_FORM: SuspenseAdjustmentFilterForm = {
  postingDateFrom: '',
  postingDateTo: '',
  suspenseTxnId: '',
  transactionId: '',
  sourceType: ALL,
  status: ALL,
};

/** 表单值 → 后端筛选条件（纯函数）。 */
function formToQuery(
  form: SuspenseAdjustmentFilterForm,
): SuspenseAdjustmentListQuery {
  return {
    postingDateStart: form.postingDateFrom || undefined,
    postingDateEnd: form.postingDateTo || undefined,
    suspenseTxnId: form.suspenseTxnId.trim() || undefined,
    transactionId: form.transactionId.trim() || undefined,
    sourceType: form.sourceType !== ALL ? (form.sourceType as SourceType) : undefined,
    status: form.status !== ALL ? (form.status as ClearStatus) : undefined,
  };
}

export function SuspenseAdjustmentListPage() {
  const t = useTranslations('modules.suspense-adjustment');
  const router = useRouter();

  const { register, control, handleSubmit, reset } =
    useForm<SuspenseAdjustmentFilterForm>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<SuspenseAdjustmentFilterForm>(EMPTY_FORM);
  const [page, setPage] = React.useState(1);

  const query = React.useMemo<SuspenseAdjustmentListQuery>(
    () => formToQuery(queryValues),
    [queryValues],
  );

  const listResult = useSuspenseAdjustmentListQuery(query);
  const { refetch } = listResult;
  const allRows = listResult.data?.rows ?? [];
  const isLoading = listResult.isLoading || listResult.isFetching;
  const total = allRows.length;
  const pagedRows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sourceTypeOptions = React.useMemo(
    () =>
      SOURCE_TYPE_OPTIONS.map((o) => ({
        value: o.value,
        label: o.value === ALL ? t('filter.all') : o.label,
      })),
    [t],
  );
  const statusOptions = React.useMemo(
    () =>
      CLEAR_STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: o.value === ALL ? t('filter.all') : o.label,
      })),
    [t],
  );

  const columns = React.useMemo<ColumnDef<SuspenseAdjustmentListItem>[]>(
    () => [
      {
        accessorKey: 'postingDate',
        header: t('field.postingDate'),
        cell: ({ row }) => <span>{textOrDash(row.original.postingDate)}</span>,
      },
      {
        accessorKey: 'suspenseTxnId',
        header: t('field.suspenseTxnId'),
        cell: ({ row }) =>
          row.original.suspenseTxnId ? (
            <CopyableEllipsisText value={row.original.suspenseTxnId} showCopyIcon />
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        accessorKey: 'sourceType',
        header: t('field.sourceType'),
        cell: ({ row }) => <span>{textOrDash(row.original.sourceTypeLabel)}</span>,
      },
      {
        accessorKey: 'drCr',
        header: t('field.drCr'),
        cell: ({ row }) => <span>{textOrDash(row.original.drCr)}</span>,
      },
      {
        accessorKey: 'accountDisplay',
        header: t('field.account'),
        cell: ({ row }) => <span>{textOrDash(row.original.accountDisplay)}</span>,
      },
      {
        accessorKey: 'originalAmount',
        header: () => (
          <span className="inline-flex items-center gap-2">
            {t('field.originalAmount')}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger type="button" className="rounded-full border px-1.5" aria-label={t('originalAmountHelp')}>i</TooltipTrigger>
                <TooltipContent>{t('originalAmountHelp')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
        ),
        cell: ({ row }) => (
          <span>{formatAmount(row.original.originalAmount, row.original.currency)}</span>
        ),
      },
      {
        accessorKey: 'totalAdjusted',
        header: t('field.totalAdjusted'),
        cell: ({ row }) => (
          <span>{formatAmount(row.original.totalAdjusted, row.original.currency)}</span>
        ),
      },
      {
        accessorKey: 'outstandingAmount',
        header: t('field.outstandingAmount'),
        cell: ({ row }) => (
          <span>{formatAmount(row.original.outstandingAmount, row.original.currency)}</span>
        ),
      },
      {
        accessorKey: 'age',
        header: t('field.age'),
        cell: ({ row }) => (
          <SuspenseStatusBadge
            tone={getAgeTagTone(row.original.age)}
            label={t('ageDays', { count: row.original.age })}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <SuspenseStatusBadge
            tone={CLEAR_STATUS_MAP[row.original.status]?.color ?? 'default'}
            label={row.original.statusLabel}
          />
        ),
      },
      createRowActionsColumn<SuspenseAdjustmentListItem>({
        detail: {
          label: t('action.viewDetails'),
          onClick: (r) =>
            router.push(
              `/accounting/suspense-adjustment/view?id=${r.suspenseRecordId}`,
            ),
        },
        menu: (r) =>
          r.status !== 'CLEARED' ? [{
            label: t('action.adjust'),
            disabled: !r.canAdjust,
            onClick: (row) => {
              const params = new URLSearchParams({ id: row.id, suspenseTxnId: row.suspenseTxnId, status: row.status, statusLabel: row.statusLabel, age: String(row.age) });
              router.push(`/accounting/suspense-adjustment/edit?${params}`);
            },
          }] : [],
      }),
    ],
    [t, router],
  );

  const onSubmit = (values: SuspenseAdjustmentFilterForm) => {
    setPage(1);
    if (JSON.stringify(formToQuery(values)) === JSON.stringify(query)) void refetch();
    else setQueryValues(values);
  };

  const onReset = () => {
    reset(EMPTY_FORM);
    onSubmit(EMPTY_FORM);
  };
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <QueryForm
          queryType="submit"
          fields={[
            <FormDateRangePicker
              key="postingDate"
              startName="postingDateFrom"
              endName="postingDateTo"
              control={control}
              label={t('field.postingDate')}
            />,
            <FormField
              key="suspenseTxnId"
              name="suspenseTxnId"
              label={t('field.suspenseTxnId')}
              register={register('suspenseTxnId')}
              placeholder={t('placeholder.suspenseTxnId')}
            />,
            <FormSelect
              key="status"
              name="status"
              control={control}
              label={t('field.status')}
              options={statusOptions}
              placeholder={t('filter.all')}
            />,
          ]}
          advancedFields={[
            <FormField
              key="transactionId"
              name="transactionId"
              label={t('field.transactionId')}
              register={register('transactionId')}
              placeholder={t('placeholder.transactionId')}
            />,
            <FormSelect
              key="sourceType"
              name="sourceType"
              control={control}
              label={t('field.sourceType')}
              options={sourceTypeOptions}
              placeholder={t('filter.all')}
            />,
          ]}
          onReset={onReset}
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>

      <Card>
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('list.title')}
          <p className="mt-1 font-normal text-muted-foreground">{t('list.description')}</p>
        </div>
        <div className="p-4">
          {listResult.error ? <p role="alert" className="mb-2 text-sm text-destructive">{listResult.error.message}</p> : null}
          <DataTable
            columns={columns}
            data={pagedRows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total,
              onPageChange: setPage,
              summary: t('range', { start: total ? (page - 1) * PAGE_SIZE + 1 : 0, end: Math.min(page * PAGE_SIZE, total), total }),
            }}
          />
        </div>
      </Card>
    </div>
  );
}
