'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import {
  useNormalizationHistoryListQuery,
  type NormalizationHistoryItem,
  type NormalizationHistoryListFilters,
} from '@myorg/modules/transaction-event-configuration/data-access';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  formatDate,
  formatDateTime,
  getSourceEventTypeByEventType,
  getSourceEventTypeMessageKey,
  resolveEventStatusMeta,
  statusToneClass,
} from '@myorg/modules/transaction-event-configuration/util';

const KNOWN_SOURCE_EVENTS = [
  'reserveIn',
  'mint',
  'repositoryOut',
  'transfer',
  'repositoryIn',
  'melt',
  'reserveOut',
  'fundingIn',
  'fundingOut',
] as const;

interface HistoryFilterForm {
  mappingRuleId: string;
  eventStatus: string;
  createdFrom: string;
  createdTo: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const EMPTY_FORM: HistoryFilterForm = {
  mappingRuleId: '',
  eventStatus: ALL_VALUE,
  createdFrom: '',
  createdTo: '',
  effectiveFrom: '',
  effectiveTo: '',
};

function formToFilters(
  form: HistoryFilterForm,
  normalizationEventId: number,
  eventType?: number
): NormalizationHistoryListFilters {
  return {
    normalizationEventId,
    eventType: eventType !== undefined ? String(eventType) : undefined,
    mappingRuleId: form.mappingRuleId.trim() || undefined,
    status:
      form.eventStatus && form.eventStatus !== ALL_VALUE
        ? Number(form.eventStatus)
        : undefined,
    createTimeStart: form.createdFrom
      ? startOfDay(parseISO(form.createdFrom)).getTime()
      : undefined,
    createTimeEnd: form.createdTo
      ? endOfDay(parseISO(form.createdTo)).getTime()
      : undefined,
    effectiveDateStart: form.effectiveFrom
      ? startOfDay(parseISO(form.effectiveFrom)).getTime()
      : undefined,
    effectiveDateEnd: form.effectiveTo
      ? endOfDay(parseISO(form.effectiveTo)).getTime()
      : undefined,
  };
}

/**
 * HistoricalRecords tab — 迁移自 td-manage HistoricalRecordsTab.tsx。
 * 筛选（mappingRuleId / eventStatus / 创建日期范围 / 生效日期范围）+ 历史记录表
 * （mappingRuleId / sourceEventType / creator / createdOn / effectiveDate / status / 审批跳转）。
 *
 * `active` 为 false 时不发请求（复刻源「切到本 tab 才加载」行为）。
 */
export function TxEventHistoricalRecordsTab({
  normalizationEventId,
  eventType,
  bookId,
  active,
  onBack,
}: {
  normalizationEventId: number;
  eventType?: number;
  bookId?: string;
  active?: boolean;
  onBack: () => void;
}) {
  const t = useTranslations('modules.transaction-event-configuration');
  const router = useRouter();
  const { register, control, handleSubmit, reset } =
    useForm<HistoryFilterForm>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<HistoryFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(
        queryValues,
        normalizationEventId,
        eventType
      ),
    }),
    [
      pagination.pageNum,
      pagination.pageSize,
      queryValues,
      normalizationEventId,
      eventType,
    ]
  );

  const historyResult = useNormalizationHistoryListQuery(
    params,
    Boolean(active && normalizationEventId)
  );
  const rows = historyResult.data?.rows ?? [];
  const total = historyResult.data?.page?.total ?? 0;
  const isLoading = historyResult.isLoading || historyResult.isFetching;

  const eventStatusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: '5', label: t('eventStatus.draft') },
      { value: '10', label: t('eventStatus.pendingReview') },
      { value: '15', label: t('eventStatus.rejected') },
      { value: '30', label: t('ruleStatus.pendingActivation') },
      { value: '35', label: t('ruleStatus.active') },
      { value: '45', label: t('ruleStatus.expired') },
    ],
    [t]
  );

  const columns = React.useMemo<ColumnDef<NormalizationHistoryItem>[]>(
    () => [
      {
        id: 'mappingRuleId',
        header: t('field.mappingRuleId'),
        cell: ({ row }) => {
          const id =
            row.original.mappingRuleId ||
            row.original.busCode ||
            (row.original.recordId ? String(row.original.recordId) : '');
          return id ? (
            <CopyableEllipsisText value={id} copyLabel={t('copy')} />
          ) : (
            <span>{EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'sourceEventType',
        header: t('field.sourceEventType'),
        cell: ({ row }) => {
          const raw = row.original.eventType;
          let key: string | undefined;
          if (raw && (KNOWN_SOURCE_EVENTS as readonly string[]).includes(raw)) {
            key = `sourceEvent.${raw}`;
          } else if (eventType) {
            key = getSourceEventTypeMessageKey(
              getSourceEventTypeByEventType(eventType),
              bookId
            );
          }
          return <span>{key ? t(key) : raw || EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'createdBy',
        header: t('field.creator'),
        cell: ({ row }) => {
          const v = row.original.createdBy;
          return (
            <span>
              {v === 'system-auto-generated'
                ? t('history.systemGenerated')
                : v || EMPTY_DISPLAY}
            </span>
          );
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
        accessorKey: 'effectiveDate',
        header: t('field.effectiveDate'),
        cell: ({ row }) => <span>{formatDate(row.original.effectiveDate)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const meta = resolveEventStatusMeta(row.original.status);
          if (!meta) return <span>{EMPTY_DISPLAY}</span>;
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
        cell: ({ row }) => {
          if (!row.original.taskId || !row.original.busCode) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          return (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/approval-manage/view?id=${row.original.taskId}&busCode=${row.original.busCode}`
                )
              }
            >
              {t('action.view')}
            </Button>
          );
        },
      },
    ],
    [t, bookId, eventType, router]
  );

  const onSubmit = React.useCallback((form: HistoryFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryValues(form);
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4 p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">
          {t('history.queryTitle')}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="mappingRuleId"
            label={t('field.mappingRuleId')}
            register={register('mappingRuleId')}
            placeholder={t('field.mappingRuleId')}
          />
          <FormSelect
            name="eventStatus"
            control={control}
            label={t('field.status')}
            options={eventStatusOptions}
            placeholder={t('filter.all')}
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
          <FormDatePicker
            name="effectiveFrom"
            control={control}
            label={t('field.effectiveFrom')}
          />
          <FormDatePicker
            name="effectiveTo"
            control={control}
            label={t('field.effectiveTo')}
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
          {t('history.recordsTitle')}
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

      <div className="flex justify-end">
        <Button variant="outline" onClick={onBack}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
