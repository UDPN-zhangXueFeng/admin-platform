'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';

import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';

import {
  useSuspenseAdjustmentListQuery,
  type SuspenseAdjustmentListItem,
  type SuspenseAdjustmentListQuery,
} from '@myorg/modules/suspense-adjustment/data-access';
import {
  CLEAR_STATUS_MAP,
  CLEAR_STATUS_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  formatAmount,
  getAgeTagTone,
  textOrDash,
} from '@myorg/modules/suspense-adjustment/util';
import type { ClearStatus, SourceType } from '@myorg/modules/suspense-adjustment/util';
import { SuspenseStatusBadge } from '@myorg/modules/suspense-adjustment/ui';

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

/**
 * SuspenseAdjustmentListPage — 暂记户调账列表页。
 *
 * 迁移自 td-manage src/pages/financial/adjustments/index.tsx（346 行）。
 * 保留：多维筛选（postingDate 范围 / suspenseTxnId / transactionId /
 * sourceType / status）、Adjust / View Details 操作、age 与 status 色值标签。
 *
 * 与源差异：antd Form+Table → RHF + DataTable；后端无分页（前端全量 + client-side 切片）。
 */
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
  const allRows = listResult.data?.rows ?? [];
  const isLoading = listResult.isLoading || listResult.isFetching;

  // client-side 分页（后端无分页，前端全量 + 切片，复刻源 pageSize:10 行为）。
  const total = allRows.length;
  const pagedRows = React.useMemo(
    () => allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [allRows, page],
  );

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
            <CopyableEllipsisText value={row.original.suspenseTxnId} />
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
        header: t('field.originalAmount'),
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
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-3">
              {r.canAdjust ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    router.push(
                      `/suspense-adjustment/edit?id=${r.suspenseRecordId}&suspenseTxnId=${encodeURIComponent(
                        r.suspenseTxnId,
                      )}`,
                    )
                  }
                >
                  {t('action.adjust')}
                </Button>
              ) : null}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/suspense-adjustment/view?id=${r.suspenseRecordId}`)
                }
              >
                {t('action.viewDetails')}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, router],
  );

  const onSubmit = React.useCallback((form: SuspenseAdjustmentFilterForm) => {
    setPage(1);
    setQueryValues(form);
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPage(1);
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">{t('filter.title')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormDatePicker
            name="postingDateFrom"
            control={control}
            label={t('field.postingDateFrom')}
          />
          <FormDatePicker
            name="postingDateTo"
            control={control}
            label={t('field.postingDateTo')}
          />
          <FormField
            name="suspenseTxnId"
            label={t('field.suspenseTxnId')}
            register={register('suspenseTxnId')}
            placeholder={t('placeholder.suspenseTxnId')}
          />
          <FormField
            name="transactionId"
            label={t('field.transactionId')}
            register={register('transactionId')}
            placeholder={t('placeholder.transactionId')}
          />
          <FormSelect
            name="sourceType"
            control={control}
            label={t('field.sourceType')}
            options={sourceTypeOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="status"
            control={control}
            label={t('field.status')}
            options={statusOptions}
            placeholder={t('filter.all')}
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
          {t('list.title')}
        </div>
        <div className="p-4">
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
            }}
          />
        </div>
      </div>
    </div>
  );
}
